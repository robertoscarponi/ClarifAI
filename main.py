import os
import re
from embeddings import logger, extract_text_from_pdf, chunk_text, generate_embeddings, store_embeddings_in_chromadb, process_pdf_with_images
from retrieval import rewrite_query, HyDERetriever, generate_response
from utils import count_tokens  # Importa la funzione di conteggio token

def main():
    try:
        # Recupera il percorso del PDF dalla variabile d'ambiente
        pdf_path = os.environ.get("PDF_PATH")
        if not pdf_path:
            raise ValueError("La variabile d'ambiente PDF_PATH non è impostata.")
            
        # Step 1: Extract and chunk text (with images)
        logger.info(f"Starting process for PDF: {pdf_path}")
        chunks = process_pdf_with_images(pdf_path)

        # Step 2: Generate embeddings
        chunk_embeddings = generate_embeddings(chunks)

        # Step 3: Store embeddings in ChromaDB
        collection = store_embeddings_in_chromadb(chunks, chunk_embeddings)

        # Step 4: Gestione input utente
        original_query = input("Inserisci la tua domanda: ")
        
        # Verifica se la query riguarda un'immagine
        is_image_query = re.search(r'immag|figur|schem|diagram', original_query.lower()) is not None
        image_context = ""
        
        # Se riguarda un'immagine, verifica se è specificata la pagina
        if is_image_query:
            page_match = re.search(r'pagina\s+(\d+)', original_query.lower())
            
            # Se non è specificata la pagina, chiedi all'utente
            if not page_match:
                page_number = input("La tua domanda riguarda un'immagine. Quale pagina? ")
                try:
                    page_to_analyze = int(page_number) - 1  # Converti in base 0
                    original_query += f" a pagina {page_number}"
                except ValueError:
                    logger.error("Numero di pagina non valido")
                    return
            else:
                page_to_analyze = int(page_match.group(1)) - 1
                
            # Renderizza e analizza la pagina specifica
            from extract_images import render_pdf_pages
            from analyze_images import analyze_image
            
            try:
                logger.info(f"Renderizzando la pagina {page_to_analyze + 1}...")
                rendered_pages = render_pdf_pages(pdf_path, pages=[page_to_analyze])
                
                if rendered_pages:
                    page_image_path, _ = rendered_pages[0]
                    logger.info(f"Analizzando la pagina {page_to_analyze + 1}...")
                    page_description = analyze_image(page_image_path)
                    image_context = f"[DESCRIZIONE PAGINA {page_to_analyze + 1}]: {page_description}"
            except Exception as e:
                logger.error(f"Errore durante l'analisi dell'immagine: {e}")

        # Riscrittura della query
        rewritten_query = rewrite_query(original_query)
        logger.info(f"Rewritten Query: {rewritten_query}")

        # Step 5: Retrieve relevant documents using HyDE
        hyde_retriever = HyDERetriever(collection)
        similar_docs, hypothetical_doc = hyde_retriever.retrieve(rewritten_query)
        logger.info(f"Hypothetical Document: {hypothetical_doc}")
        logger.info(f"Similar Documents: {similar_docs}")

        # Aggiungi il contesto dell'immagine se disponibile
        if image_context:
            similar_docs = [image_context] + similar_docs

        # Step 6: Generate a response
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

        # Salva il contesto in un file
        save_context_to_file(prompt)

        response = generate_response(original_query, prompt)
        logger.info(f"Generated Response: {response}")

    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)

def save_context_to_file(context, filename="last_context.txt"):
    """Salva il contesto in un file di testo, sovrascrivendo il file precedente."""
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(context)
        logger.info(f"Contesto salvato in {filename}")
    except Exception as e:
        logger.error(f"Errore nel salvare il contesto: {e}")

if __name__ == "__main__":
    main()
