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

    def retrieve(self, query, k=3):
        logger.info("Retrieving relevant documents using HyDE...")
        hypothetical_doc = self.generate_hypothetical_document(query)
        hypothetical_embedding = generate_embeddings([hypothetical_doc])[0]
        results = self.collection.query(
            query_embeddings=[hypothetical_embedding],
            n_results=k
        )
        similar_docs = results["documents"][0] 
        logger.info(f"Retrieved {len(similar_docs)} relevant documents.")
        return similar_docs, hypothetical_doc


def generate_response(query, context):
    logger.info("Generating response...")
    prompt = f"Context: {context}\n\nQuestion: {query}\n\nAnswer:"
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    logger.info("Response generated.")
    return response.text


