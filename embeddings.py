import PyPDF2
from langchain.text_splitter import RecursiveCharacterTextSplitter
import google.generativeai as genai
import chromadb
import logging
from config import gemini_api_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def extract_text_from_pdf(pdf_path):
    logger.info(f"Extracting text from PDF: {pdf_path}")
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
    logger.info("Text extraction complete.")
    return text

#TO DO: sperimentare cambiando i parametri chunk_size e chunk_overlap
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

def generate_embeddings(texts):
    logger.info("Generating embeddings for text chunks...")
    embeddings = []
    for i, text in enumerate(texts):
        logger.info(f"Generating embedding for chunk {i + 1}/{len(texts)}...")
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text
        )
        embeddings.append(result['embedding'])
    logger.info("Embeddings generated.")
    return embeddings

def store_embeddings_in_chromadb(chunks, chunk_embeddings):
    logger.info("Storing embeddings in ChromaDB...")
    client = chromadb.Client()

  
    collection = client.get_or_create_collection(name="school_book_chuncks")

    ids = [f"chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"source": "pdf"}] * len(chunks)  # TO DO: vedere come gestire più metadata e se servono per il nostro caso d'uso
    collection.add(
        documents=chunks, 
        embeddings=chunk_embeddings, 
        metadatas=metadatas, 
        ids=ids #Unique ID for each documents
    )
    logger.info("Embeddings stored in ChromaDB.")
    return collection





