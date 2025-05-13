import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from embeddings import logger, extract_text_from_pdf, chunk_text, generate_embeddings
from embeddings import store_embeddings_in_chromadb, process_pdf_with_images
from retrieval import rewrite_query, HyDERetriever, generate_response
from utils import count_tokens
from extract_images import render_pdf_pages
from analyze_images import analyze_image
import logging

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Global variables to maintain state
collection = None
chunks = None
pdf_path = None

def setup_rag_system():
    """Initialize the RAG system with the configured PDF"""
    global collection, chunks, pdf_path
    
    # Get PDF path from environment variable
    pdf_path = os.environ.get("PDF_PATH")
    if not pdf_path:
        raise ValueError("The PDF_PATH environment variable is not set.")
        
    # Step 1: Extract and chunk text
    logger.info(f"Starting process for PDF: {pdf_path}")
    chunks = process_pdf_with_images(pdf_path)

    # Step 2: Generate embeddings
    chunk_embeddings = generate_embeddings(chunks)

    # Step 3: Store embeddings in ChromaDB
    collection = store_embeddings_in_chromadb(chunks, chunk_embeddings)
    
    return "RAG system successfully initialized"

@app.route('/api/books', methods=['GET'])
def get_books():
    """Returns the list of available books"""
    try:
        # Currently we only support one book, but this allows future expansions
        books_dir = os.path.dirname(os.path.abspath(__file__))
        pdf_path = os.environ.get("PDF_PATH")
        
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({"status": "error", "message": "No books available"}), 404
            
        # Get filename from path
        filename = os.path.basename(pdf_path)
        book_name = os.path.splitext(filename)[0].replace("_", " ").title()
        
        books = [{
            "id": os.path.splitext(filename)[0],
            "name": book_name,
            "path": pdf_path
        }]
        
        return jsonify({"status": "success", "books": books})
    except Exception as e:
        logger.error(f"Error retrieving books: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/select-book', methods=['POST'])
def select_book():
    """Select a book and initialize the RAG system"""
    global pdf_path, collection, chunks
    
    try:
        data = request.json
        book_id = data.get('book_id')
        
        if not book_id:
            return jsonify({"status": "error", "message": "Book ID required"}), 400
        
        # Currently we only support the configured book
        env_pdf_path = os.environ.get("PDF_PATH")
        filename = os.path.basename(env_pdf_path)
        file_id = os.path.splitext(filename)[0]
        
        if book_id != file_id:
            return jsonify({"status": "error", "message": "Book not available"}), 404
        
        # Set current PDF
        pdf_path = env_pdf_path
        
        # Initialize the RAG system if it hasn't been done already
        if collection is None:
            setup_rag_system()
        
        return jsonify({
            "status": "success", 
            "message": f"Book {book_id} successfully loaded"
        })
    except Exception as e:
        logger.error(f"Error selecting book: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/query', methods=['POST'])
def process_query():
    """Process a user query and return the response"""
    global collection, pdf_path
    
    try:
        # Check that the system is initialized
        if collection is None:
            setup_rag_system()  # Automatically initialize with the default PDF
        
        data = request.json
        original_query = data.get('query')
        
        if not original_query:
            return jsonify({"status": "error", "message": "Query required"}), 400
        
        # Image context handling
        image_context = ""
        
        is_image_mode = data.get('is_image_mode', False)
        
        if is_image_mode:
            # Check if page is specified in the request
            page_number = data.get('page_number')
            if page_number:
                try:
                    page_to_analyze = int(page_number) - 1  
                    
                    # Render and analyze specific page
                    logger.info(f"Rendering page {page_to_analyze + 1}...")
                    rendered_pages = render_pdf_pages(pdf_path, pages=[page_to_analyze])
                    
                    if rendered_pages:
                        page_image_path, _ = rendered_pages[0]
                        logger.info(f"Analyzing page {page_to_analyze + 1}...")
                        page_description = analyze_image(page_image_path)
                        image_context = f"[PAGE DESCRIPTION {page_to_analyze + 1}]: {page_description}"
                except Exception as e:
                    logger.error(f"Error analyzing image: {e}")
                    return jsonify({
                        "status": "error", 
                        "message": f"Error analyzing image: {str(e)}"
                    }), 500
            else:
                # If in image mode but no page is specified, ask the client to provide it
                return jsonify({
                    "status": "page_required",
                    "message": "To analyze an image, please specify the page number."
                })

        # Query rewriting
        rewritten_query = rewrite_query(original_query)
        logger.info(f"Rewritten Query: {rewritten_query}")

        # Retrieve relevant documents using HyDE
        hyde_retriever = HyDERetriever(collection)
        similar_docs, hypothetical_doc = hyde_retriever.retrieve(rewritten_query)
        
        # Add image context if available
        if image_context:
            similar_docs = [image_context] + similar_docs

        # Generate a response
        base_context = (
            "You're an expert who answers questions using information from the following documents. "
            "Answer naturally and conversationally, as if you're explaining the topic to someone, but never explicitly mention the context or use phrases like 'according to the context' or 'the document says'. "
            "Format your answer using Markdown syntax to improve readability. Use **bold** for important concepts, bullet or numbered lists for items, and headings where appropriate. "
            "For mathematical formulas, use LaTeX notation enclosed in $ symbols for inline formulas or $$ for block formulas. "
            "Example: $D_j = D_k + d_{kj}$ for an inline formula or $$D_j = D_k + d_{kj}$$ for a separate block formula. "
            "Follow these guidelines:\n"
            "1. Use exclusively information from the provided documents, without adding external details or making unsupported assumptions.\n"
            "2. Never exclude important information that contributes to understanding the topic requested in the question.\n"
            "3. Always answer in detail without ever limiting the length of your response.\n"
            "4. Use appropriate technical language from the documents, maintaining terminological precision.\n"
            "5. Structure the response in a fluid and conversational way, like a natural explanation.\n"
            "6. If the documents don't contain sufficient information, honestly answer that you don't have enough information, but do so naturally.\n"
            "7. Maintain a professional but accessible tone, avoiding rigid academic formulations.\n"

            "Here are the reference documents: "
        )
        prompt = base_context + " ".join(similar_docs)

        # Check number of tokens in the prompt
        tokens = count_tokens(prompt)
        logger.info(f"The prompt contains {tokens} tokens.")

        # Save context to file for debugging
        save_context_to_file(prompt)

        # Generate the response
        response = generate_response(original_query, prompt)
        logger.info(f"Generated Response: {response}")
        
        return jsonify({
            "status": "success", 
            "response": response,
            "tokenCount": tokens
        })
        
    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

def save_context_to_file(context, filename="last_context.txt"):
    """Save context to a text file, overwriting the previous file."""
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(context)
        logger.info(f"Context saved in {filename}")
    except Exception as e:
        logger.error(f"Error saving context: {e}")


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5001)  
