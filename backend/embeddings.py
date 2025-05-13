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

# Directories for cache and persistence
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
PERSIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chromadb_store")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(PERSIST_DIR, exist_ok=True)

def compute_chunk_hash(chunk):
    """Computes a unique hash for the chunk."""
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
        chunk_size=500,  
        chunk_overlap=50,  
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = text_splitter.split_text(text)
    logger.info(f"Text split into {len(chunks)} chunks.")
    return chunks

genai.configure(api_key=gemini_api_key) 

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def call_embed_api(chunk):
    """Function with automatic retry to call the embedding API"""
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=chunk
    )
    return result

def generate_embeddings(texts):
    """Generates embeddings for all chunks using local cache."""
    logger.info("Generating embeddings for text chunks...")
    
    embeddings = []
    new_embeddings_count = 0
    
    for i, chunk in enumerate(texts):
        chunk_hash = compute_chunk_hash(chunk)
        cache_file = os.path.join(CACHE_DIR, f"{chunk_hash}.json")
        
        # Check if the embedding is already in cache
        if os.path.exists(cache_file):
            logger.info(f"Embedding for chunk {i+1}/{len(texts)} found in cache")
            with open(cache_file, 'r') as f:
                cache_data = json.load(f)
                embeddings.append(cache_data["embedding"])
        else:
            logger.info(f"Generating embedding for chunk {i+1}/{len(texts)}...")
            # Use function with retry
            result = call_embed_api(chunk) 
            embedding = result['embedding']
            embeddings.append(embedding)
            new_embeddings_count += 1
            
            # Save to cache
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
    """Saves embeddings in ChromaDB with persistence and duplicate handling."""
    logger.info("Storing embeddings in ChromaDB with persistence...")
    
    # Use a persistent client
    client = chromadb.Client(Settings(persist_directory=PERSIST_DIR))
    collection = client.get_or_create_collection(name="school_book_chunks")
    
    # Calculate hash for each chunk
    ids = [compute_chunk_hash(chunk) for chunk in chunks]
    
    # Remove duplicates from the chunk list before trying to add them
    unique_data = {}
    for chunk, embedding, chunk_id in zip(chunks, chunk_embeddings, ids):
        if chunk_id not in unique_data:
            unique_data[chunk_id] = (chunk, embedding)
    
    # Retrieve existing IDs
    existing_ids = set()
    try:
        result = collection.get()
        if result and "ids" in result:
            existing_ids = set(result["ids"])
            logger.info(f"Found {len(existing_ids)} existing IDs in ChromaDB")
    except Exception as e:
        logger.warning(f"Error retrieving existing IDs: {e}")
    
    # Filter only new chunks
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
    
    # Add only new chunks
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

def process_pdf_with_images(pdf_path):
    """Process a PDF by extracting text or loading it from cache."""
    # Try to load chunks from cache
    cached_chunks = get_pdf_cached_chunks(pdf_path)
    if (cached_chunks):
        logger.info(f"Using {len(cached_chunks)} chunks from cache")
        return cached_chunks
    
    # If there are no chunks in cache, extract the text
    logger.info(f"No cache chunks found for {os.path.basename(pdf_path)}, proceeding with extraction")
    text = extract_text_from_pdf(pdf_path)
    text_chunks = chunk_text(text)
    
    # Save chunks for future use
    save_pdf_chunks(pdf_path, text_chunks)
    
    return text_chunks

import os
import hashlib
import json
import pathlib

# Add this new function
def get_pdf_cached_chunks(pdf_path):
    """Retrieves saved chunks for a specific PDF or returns None if they don't exist."""
    pdf_filename = os.path.basename(pdf_path)
    pdf_name = os.path.splitext(pdf_filename)[0]
    pdf_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:10]
    
    # Directory for chunks of this specific PDF
    pdf_chunks_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdf_chunks")
    os.makedirs(pdf_chunks_dir, exist_ok=True)
    
    chunks_file = os.path.join(pdf_chunks_dir, f"{pdf_name}_{pdf_hash}.json")
    
    if os.path.exists(chunks_file):
        logger.info(f"Found stored chunks for {pdf_filename}, loading from cache...")
        with open(chunks_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

# Add this new function
def save_pdf_chunks(pdf_path, chunks):
    """Saves chunks extracted from a specific PDF."""
    pdf_filename = os.path.basename(pdf_path)
    pdf_name = os.path.splitext(pdf_filename)[0]
    pdf_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:10]
    
    # Directory for chunks of this specific PDF
    pdf_chunks_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdf_chunks")
    os.makedirs(pdf_chunks_dir, exist_ok=True)
    
    chunks_file = os.path.join(pdf_chunks_dir, f"{pdf_name}_{pdf_hash}.json")
    
    logger.info(f"Saving {len(chunks)} chunks for {pdf_filename}...")
    with open(chunks_file, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, ensure_ascii=False)






