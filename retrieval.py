from embeddings import logger
import google.generativeai as genai
from embeddings import generate_embeddings

def rewrite_query(original_query):
    logger.info("Rewriting query...")
    
    query_rewrite_template = """You are an AI assistant tasked with reformulating user queries to improve retrieval in a RAG system.
    Given the original query, rewrite it to be more specific, detailed, and likely to retrieve relevant information.
    Original query: {original_query}
    Rewritten query:"""

    # Use Gemini to rewrite the query
    model = genai.GenerativeModel("gemini-1.5-flash")

    # Generate and return our response
    response = model.generate_content(query_rewrite_template.format(original_query=original_query))
    logger.info("Query rewritten.")
    return response.text


class HyDERetriever:
    def __init__(self, collection, chunk_size=500):
        self.collection = collection
        self.chunk_size = chunk_size

    def generate_hypothetical_document(self, query):
        logger.info("Generating hypothetical document...")

        hyde_prompt = """Given the question '{query}', generate a hypothetical document that directly answers this question. The document should be detailed and in-depth.
        The document size should be approximately {chunk_size} characters."""

        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(hyde_prompt.format(query=query, chunk_size=self.chunk_size))
        logger.info("Hypothetical document generated.")
        return response.text

    def retrieve(self, query, max_tokens=8000, k=10):  # Modificato da 15 a 10
        logger.info("Retrieving relevant documents using HyDE...")
        hypothetical_doc = self.generate_hypothetical_document(query)
        hypothetical_embedding = generate_embeddings([hypothetical_doc])[0]
        
        # Recupera più documenti di quelli che potrebbero servire
        results = self.collection.query(
            query_embeddings=[hypothetical_embedding],
            n_results=k
        )
        candidate_docs = results["documents"][0]
        
        # Calcola quanto spazio abbiamo per i documenti nel contesto
        from utils import count_tokens
        
        # Considera il prompt di base (ad es. le istruzioni al modello)
        base_context_tokens = 500  # Stima per le istruzioni al modello
        
        # Seleziona documenti fino a raggiungere il limite di token
        selected_docs = []
        current_tokens = base_context_tokens
        
        for doc in candidate_docs:
            doc_tokens = count_tokens(doc)
            if current_tokens + doc_tokens > max_tokens - 500:  # 500 token buffer per la risposta
                break
            selected_docs.append(doc)
            current_tokens += doc_tokens
        
        logger.info(f"Retrieved {len(selected_docs)} relevant documents within token budget. Total tokens: {current_tokens}")
        return selected_docs, hypothetical_doc


def generate_response(query, context):
    logger.info("Generating response...")
    prompt = f"Context: {context}\n\nQuestion: {query}\n\nAnswer:"
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    logger.info("Response generated.")
    return response.text


