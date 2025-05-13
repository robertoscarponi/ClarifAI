# 📚 ClarifAI

A modern, document-grounded Q&A web application for students. Upload your study PDFs and ask questions—get accurate, contextual answers *anchored in your own material*.

---

## 🚀 Project Overview

This project leverages **Retrieval-Augmented Generation (RAG)** to deliver precise, context-aware answers based on your uploaded documents. It combines Information Retrieval (IR) with the power of Large Language Models (LLMs), ensuring that responses are relevant and directly tied to your study materials.

---

## 🛠️ Core Technologies

- **PDF Parsing:** Extracts text and metadata from PDFs (PyPDF2, PyMuPDF).
- **Text Chunking:** Splits extracted text into manageable “chunks” for embedding (by semantics).
- **Embedding Model:** Transforms text chunks and questions into semantic vectors (Gemini API).
- **Vector Store:** Database optimized for similarity search (ChromaDB).
- **LLM (Large Language Model):** Generates final answers based on user question and relevant context.
- **Orchestration:** Frameworks like Langchain or LlamaIndex simplify integration and RAG workflow management.
- **Web Backend:** Flask and Node.js.
- **Web Frontend:** React/CSS/JS.

---

## 🧩 Typical User Flow

1. **Web Interface:** The user accesses the demo interface.
2. **Upload PDF:** The user uploads a single PDF document to the system.  
   *(Note: As this is a demo, only one PDF can be uploaded at a time.)*
3. **Processing Pipeline (Async):**  
   - Extract text from the uploaded PDF.  
   - Split the extracted text into manageable chunks.  
   - Generate embeddings for each chunk using the embedding model.  
   - Index the embeddings in the vector store (linked to the uploaded document).  
4. **Ask a Question:** The user submits a question related to the uploaded PDF.  
5. **Query Pipeline:**  
   - Generate an embedding for the user's question.  
   - Search the vector store to retrieve the top-K most relevant chunks (“context”).  
   - Construct a prompt for the LLM, including the user’s question and the retrieved context.  
   - The LLM generates a final answer based on the provided context.  
6. **Display Answer:** The backend sends the generated answer to the frontend, and the user sees the response.

---

## 🎯 Target Audience & Value Proposition

- **Who:** University & high school students.
- **Problem Solved:** Quickly find specific answers and review concepts within large study PDFs—no more endless scrolling or unfocused AI replies.
- **Value:** A digital “study buddy”:
    - Understands key concepts in your own documents.
    - Finds precise answers fast.
    - Enables interactive review.
    - Keeps your study focused on what matters.

---

## 📝 Getting Started

> ⚒️ **Instructions will vary based on your tech stack choices (see above).**  
> Below is a generic outline; adapt as needed for your implementation.

### 1. Clone the Repository

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
```

### 2. Install Dependencies

- **Backend:**  
  ```bash
  pip install -r requirements.txt
  ```
- **Frontend:**  
  ```bash
  cd frontend
  npm install
  ```

### 3. Configure Environment

- Set API keys for LLM/embedding services (e.g., OpenAI).
- Configure vector store (local or remote).
- Adjust settings in `.env` or config files.

### 4. Run the Application

- **Backend:**  
  ```bash
  uvicorn app:app --reload
  ```
- **Frontend:**  
  ```bash
  npm start
  ```

### 5. Use It!

- Open your browser, log in, upload/select a PDF, and start asking questions!


---

## 📄 License

[MIT](LICENSE)

---

**Made for students, by students. Happy studying!**
