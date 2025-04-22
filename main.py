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

# Inizializza l'app Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Variabili globali per mantenere lo stato
collection = None
chunks = None
pdf_path = None

def setup_rag_system():
    """Inizializza il sistema RAG con il PDF configurato"""
    global collection, chunks, pdf_path
    
    # Recupera il percorso del PDF dalla variabile d'ambiente
    pdf_path = os.environ.get("PDF_PATH")
    if not pdf_path:
        raise ValueError("La variabile d'ambiente PDF_PATH non è impostata.")
        
    # Step 1: Extract and chunk text
    logger.info(f"Starting process for PDF: {pdf_path}")
    chunks = process_pdf_with_images(pdf_path)

    # Step 2: Generate embeddings
    chunk_embeddings = generate_embeddings(chunks)

    # Step 3: Store embeddings in ChromaDB
    collection = store_embeddings_in_chromadb(chunks, chunk_embeddings)
    
    return "Sistema RAG inizializzato con successo"

@app.route('/api/books', methods=['GET'])
def get_books():
    """Restituisce l'elenco dei libri disponibili"""
    try:
        # Per ora supportiamo solo un libro, ma questo permette espansioni future
        books_dir = os.path.dirname(os.path.abspath(__file__))
        pdf_path = os.environ.get("PDF_PATH")
        
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({"status": "error", "message": "Nessun libro disponibile"}), 404
            
        # Ottieni il nome del file dal percorso
        filename = os.path.basename(pdf_path)
        book_name = os.path.splitext(filename)[0].replace("_", " ").title()
        
        books = [{
            "id": os.path.splitext(filename)[0],
            "name": book_name,
            "path": pdf_path
        }]
        
        return jsonify({"status": "success", "books": books})
    except Exception as e:
        logger.error(f"Errore nel recupero dei libri: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/select-book', methods=['POST'])
def select_book():
    """Seleziona un libro e inizializza il sistema RAG"""
    global pdf_path, collection, chunks
    
    try:
        data = request.json
        book_id = data.get('book_id')
        
        if not book_id:
            return jsonify({"status": "error", "message": "Book ID richiesto"}), 400
        
        # Per ora supportiamo solo il libro configurato
        env_pdf_path = os.environ.get("PDF_PATH")
        filename = os.path.basename(env_pdf_path)
        file_id = os.path.splitext(filename)[0]
        
        if book_id != file_id:
            return jsonify({"status": "error", "message": "Libro non disponibile"}), 404
        
        # Imposta il PDF corrente
        pdf_path = env_pdf_path
        
        # Inizializza il sistema RAG se non è già stato fatto
        if collection is None:
            setup_rag_system()
        
        return jsonify({
            "status": "success", 
            "message": f"Libro {book_id} caricato con successo"
        })
    except Exception as e:
        logger.error(f"Errore nella selezione del libro: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/query', methods=['POST'])
def process_query():
    """Elabora una query dell'utente e restituisce la risposta"""
    global collection, pdf_path
    
    try:
        # Verifica che il sistema sia inizializzato
        if collection is None:
            setup_rag_system()  # Inizializza automaticamente con il PDF predefinito
        
        data = request.json
        original_query = data.get('query')
        
        if not original_query:
            return jsonify({"status": "error", "message": "Query richiesta"}), 400
        
        # Gestione del contesto immagine
        image_context = ""
        is_image_query = re.search(r'immag|figur|schem|diagram|grafic|foto', original_query.lower()) is not None
        
        if is_image_query:
            # Verifica se è specificata la pagina nella richiesta
            page_number = data.get('page_number')
            if page_number:
                try:
                    page_to_analyze = int(page_number) - 1  # Converti in base 0
                    
                    # Renderizza e analizza la pagina specifica
                    logger.info(f"Renderizzando la pagina {page_to_analyze + 1}...")
                    rendered_pages = render_pdf_pages(pdf_path, pages=[page_to_analyze])
                    
                    if rendered_pages:
                        page_image_path, _ = rendered_pages[0]
                        logger.info(f"Analizzando la pagina {page_to_analyze + 1}...")
                        page_description = analyze_image(page_image_path)
                        image_context = f"[DESCRIZIONE PAGINA {page_to_analyze + 1}]: {page_description}"
                except Exception as e:
                    logger.error(f"Errore durante l'analisi dell'immagine: {e}")
                    return jsonify({
                        "status": "error", 
                        "message": f"Errore nell'analisi dell'immagine: {str(e)}"
                    }), 500

        # Riscrittura della query
        rewritten_query = rewrite_query(original_query)
        logger.info(f"Rewritten Query: {rewritten_query}")

        # Retrieve relevant documents using HyDE
        hyde_retriever = HyDERetriever(collection)
        similar_docs, hypothetical_doc = hyde_retriever.retrieve(rewritten_query)
        
        # Aggiungi il contesto dell'immagine se disponibile
        if image_context:
            similar_docs = [image_context] + similar_docs

        # Generate a response
        base_context = (
            "Sei un esperto che risponde a domande utilizzando le informazioni contenute nei seguenti documenti. "
            "Rispondi in modo naturale e conversazionale, come se stessi spiegando l'argomento a qualcuno, ma senza mai menzionare esplicitamente il contesto o usare frasi come 'secondo il contesto' o 'il documento dice'. "
            "Segui queste linee guida:\n"
            "1. Usa esclusivamente le informazioni presenti nei documenti forniti, senza aggiungere dettagli esterni o fare ipotesi non supportate.\n"
            "2. Non escludere mai informazioni importanti che contribuiscono alla comprensione del tema richiesto nella domanda.\n"
            "3. Usa il linguaggio tecnico appropriato presente nei documenti, mantenendo la precisione terminologica.\n"
            "4. Struttura la risposta in modo fluido e conversazionale, come una spiegazione naturale.\n"
            "5. Se i documenti non contengono informazioni sufficienti, rispondi onestamente che non hai abbastanza informazioni, ma in modo naturale.\n"
            "6. Mantieni un tono professionale ma accessibile, evitando formulazioni accademiche rigide.\n"
            "Ecco i documenti di riferimento: "
        )
        prompt = base_context + " ".join(similar_docs)

        # Controlla il numero di token del prompt
        tokens = count_tokens(prompt)
        logger.info(f"Il prompt contiene {tokens} token.")

        # Salva il contesto in un file per debug
        save_context_to_file(prompt)

        # Genera la risposta
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
    """Salva il contesto in un file di testo, sovrascrivendo il file precedente."""
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(context)
        logger.info(f"Contesto salvato in {filename}")
    except Exception as e:
        logger.error(f"Errore nel salvare il contesto: {e}")

# Modifica questa linea
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5001)  # Cambia la porta da 5000 a 5001
