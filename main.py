from embeddings import logger, extract_text_from_pdf, chunk_text, generate_embeddings, store_embeddings_in_chromadb
from retrieval import rewrite_query, HyDERetriever, generate_response

def main():
    try:
        # Step 1: Extract and chunk text
        pdf_path = r"/Users/robertoscarponi/Documents/Python_Projects/Dispense_EIF.pdf"
        logger.info(f"Starting process for PDF: {pdf_path}")
        text = extract_text_from_pdf(pdf_path)
        chunks = chunk_text(text)

        # Step 2: Generate embeddings
        chunk_embeddings = generate_embeddings(chunks)

        # Step 3: Store embeddings in ChromaDB
        collection = store_embeddings_in_chromadb(chunks, chunk_embeddings)

        # Step 4: Rewrite the query
        original_query = "Cos'è un titolo di stato?"
        rewritten_query = rewrite_query(original_query)
        logger.info(f"Rewritten Query: {rewritten_query}")

        # Step 5: Retrieve relevant documents using HyDE
        hyde_retriever = HyDERetriever(collection)
        similar_docs, hypothetical_doc = hyde_retriever.retrieve(rewritten_query)
        logger.info(f"Hypothetical Document: {hypothetical_doc}")
        logger.info(f"Similar Documents: {similar_docs}")

        # Step 6: Generate a response
        base_context = (
            "Sei un esperto nel campo di riferimento del contesto fornito. La tua risposta deve essere precisa, dettagliata e basata esclusivamente sulle informazioni presenti nel contesto. "
            "Segui queste linee guida:\n"
            "1. Contesto Primario: Utilizza solo le informazioni presenti nel contesto fornito. Non inventare dettagli o fare ipotesi al di fuori di esso.\n"
            "2. Linguaggio Tecnico: Mantieni esattamente il linguaggio tecnico e i termini specifici presenti nel contesto. Non modificare o semplificare i termini tecnici.\n"
            "3. Struttura della Risposta: Fornisci una risposta ben organizzata, con una breve introduzione, un corpo dettagliato e una conclusione riassuntiva (se applicabile).\n"
            "4. Precisione: Se il contesto non fornisce informazioni sufficienti per rispondere alla domanda, rispondi con: 'Il contesto non fornisce informazioni sufficienti per rispondere alla domanda.'\n"
            "5. Evita Generalizzazioni: Non fare affermazioni generiche o vaghe. Ogni punto della risposta deve essere supportato dal contesto.\n"
            "6. Coerenza: Assicurati che la risposta sia coerente con il contesto e non contraddica le informazioni fornite.\n"
            "Contesto: "
        )
        prompt = base_context + " ".join(similar_docs)
        response = generate_response(original_query, prompt)
        logger.info(f"Generated Response: {response}")

    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)

 
if __name__ == "__main__":
    main()