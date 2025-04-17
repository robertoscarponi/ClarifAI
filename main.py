import os
from embeddings import logger, extract_text_from_pdf, chunk_text, generate_embeddings, store_embeddings_in_chromadb
from retrieval import rewrite_query, HyDERetriever, generate_response

def main():
    try:
        # Recupera il percorso del PDF dalla variabile d'ambiente
        pdf_path = os.environ.get("PDF_PATH")
        if not pdf_path:
            raise ValueError("La variabile d'ambiente PDF_PATH non è impostata.")
            
        # Step 1: Extract and chunk text
        logger.info(f"Starting process for PDF: {pdf_path}")
        text = extract_text_from_pdf(pdf_path)
        chunks = chunk_text(text)

        # Step 2: Generate embeddings
        chunk_embeddings = generate_embeddings(chunks)

        # Step 3: Store embeddings in ChromaDB
        collection = store_embeddings_in_chromadb(chunks, chunk_embeddings)

        # Step 4: Rewrite the query
        original_query = "Cos'è il machine learning?"
        rewritten_query = rewrite_query(original_query)
        logger.info(f"Rewritten Query: {rewritten_query}")

        # Step 5: Retrieve relevant documents using HyDE
        hyde_retriever = HyDERetriever(collection)
        similar_docs, hypothetical_doc = hyde_retriever.retrieve(rewritten_query)
        logger.info(f"Hypothetical Document: {hypothetical_doc}")
        logger.info(f"Similar Documents: {similar_docs}")

        # Step 6: Generate a response
        base_context = (
            "Sei un esperto che risponde a domande utilizzando le informazioni contenute nei seguenti documenti. "
            "Rispondi in modo naturale e conversazionale, come se stessi spiegando l'argomento a qualcuno, ma senza mai menzionare esplicitamente il contesto o usare frasi come 'secondo il contesto' o 'il documento dice'. "
            "Segui queste linee guida:\n"
            "1. Usa esclusivamente le informazioni presenti nei documenti forniti, senza aggiungere dettagli esterni o fare ipotesi non supportate.\n"
            "2. Usa il linguaggio tecnico appropriato presente nei documenti, mantenendo la precisione terminologica.\n"
            "3. Struttura la risposta in modo fluido e conversazionale, come una spiegazione naturale.\n"
            "4. Se i documenti non contengono informazioni sufficienti, rispondi onestamente che non hai abbastanza informazioni, ma in modo naturale.\n"
            "5. Mantieni un tono professionale ma accessibile, evitando formulazioni accademiche rigide.\n"
            "Ecco i documenti di riferimento: "
        )
        prompt = base_context + " ".join(similar_docs)
        response = generate_response(original_query, prompt)
        logger.info(f"Generated Response: {response}")

    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)

if __name__ == "__main__":
    main()
