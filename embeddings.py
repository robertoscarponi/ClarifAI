import PyPDF2
from langchain.text_splitter import RecursiveCharacterTextSplitter
import google.generativeai as genai
import chromadb
from chromadb.config import Settings
import logging
import os
import hashlib
import json
from config import gemini_api_key
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Directory per la cache e la persistenza
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
PERSIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chromadb_store")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(PERSIST_DIR, exist_ok=True)

def compute_chunk_hash(chunk):
    """Calcola un hash univoco per il chunk."""
    return hashlib.sha256(chunk.encode("utf-8")).hexdigest()

def extract_text_from_pdf(pdf_path):
    logger.info(f"Extracting text from PDF: {pdf_path}")
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
    logger.info("Text extraction complete.")
    return text

def chunk_text(text):
    logger.info("Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,  # Modificato da 350 a 450
        chunk_overlap=50,  
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_text(text)
    logger.info(f"Text split into {len(chunks)} chunks.")
    return chunks

genai.configure(api_key=gemini_api_key) 

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def call_embed_api(chunk):
    """Funzione con retry automatico per chiamare l'API di embedding"""
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=chunk
    )
    return result

def generate_embeddings(texts):
    """Genera embeddings per tutti i chunks usando cache locale."""
    logger.info("Generating embeddings for text chunks...")
    
    embeddings = []
    new_embeddings_count = 0
    
    for i, chunk in enumerate(texts):
        chunk_hash = compute_chunk_hash(chunk)
        cache_file = os.path.join(CACHE_DIR, f"{chunk_hash}.json")
        
        # Verifica se l'embedding è già in cache
        if os.path.exists(cache_file):
            logger.info(f"Embedding for chunk {i+1}/{len(texts)} found in cache")
            with open(cache_file, 'r') as f:
                cache_data = json.load(f)
                embeddings.append(cache_data["embedding"])
        else:
            logger.info(f"Generating embedding for chunk {i+1}/{len(texts)}...")
            # Usa la funzione con retry
            result = call_embed_api(chunk) 
            embedding = result['embedding']
            embeddings.append(embedding)
            new_embeddings_count += 1
            
            # Salva in cache
            cache_data = {
                "chunk": chunk,
                "embedding": embedding,
                "hash": chunk_hash
            }
            with open(cache_file, 'w') as f:
                json.dump(cache_data, f)
    
    logger.info(f"Embeddings generated: {new_embeddings_count} new, {len(texts) - new_embeddings_count} from cache.")
    return embeddings

def store_embeddings_in_chromadb(chunks, chunk_embeddings):
    """Salva gli embeddings in ChromaDB con persistenza e gestione dei duplicati."""
    logger.info("Storing embeddings in ChromaDB with persistence...")
    
    # Usa un client persistente
    client = chromadb.Client(Settings(persist_directory=PERSIST_DIR))
    collection = client.get_or_create_collection(name="school_book_chuncks")
    
    # Calcola hash per ogni chunk
    ids = [compute_chunk_hash(chunk) for chunk in chunks]
    
    # Rimuovi duplicati dalla lista di chunk prima di provare ad aggiungerli
    unique_data = {}
    for chunk, embedding, chunk_id in zip(chunks, chunk_embeddings, ids):
        if chunk_id not in unique_data:
            unique_data[chunk_id] = (chunk, embedding)
    
    # Recupera gli ID esistenti
    existing_ids = set()
    try:
        result = collection.get()
        if result and "ids" in result:
            existing_ids = set(result["ids"])
            logger.info(f"Found {len(existing_ids)} existing IDs in ChromaDB")
    except Exception as e:
        logger.warning(f"Error retrieving existing IDs: {e}")
    
    # Filtra solo i chunk nuovi
    new_chunks = []
    new_embeddings = []
    new_ids = []
    new_metadatas = []
    
    for chunk_id, (chunk, embedding) in unique_data.items():
        if chunk_id not in existing_ids:
            new_chunks.append(chunk)
            new_embeddings.append(embedding)
            new_ids.append(chunk_id)
            new_metadatas.append({"source": "pdf"})
    
    # Aggiungi solo i nuovi chunk
    if new_chunks:
        logger.info(f"Adding {len(new_chunks)} new chunks to ChromaDB.")
        collection.add(
            documents=new_chunks,
            embeddings=new_embeddings,
            metadatas=new_metadatas,
            ids=new_ids
        )
        logger.info("ChromaDB updated.")
    else:
        logger.info("No new chunks to add to ChromaDB.")
    
    return collection






