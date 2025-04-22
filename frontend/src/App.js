import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { FaArrowRight, FaBook, FaRedo } from 'react-icons/fa';

const API_BASE_URL = 'http://127.0.0.1:5001'; // Usa la nuova porta

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageNumber, setPageNumber] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Carica il libro e lo imposta all'avvio, ma non blocca l'applicazione se fallisce
  useEffect(() => {
    fetchAndSelectDefaultBook();
  }, []);

  const fetchAndSelectDefaultBook = async () => {
    try {
      setLoading(true);
      // Verifica prima che il server sia raggiungibile
      const response = await axios.get(`${API_BASE_URL}/api/books`, { timeout: 3000 });
      
      if (response.data.status === 'success' && response.data.books.length > 0) {
        setBooks(response.data.books);
        
        // Seleziona automaticamente il primo libro
        const defaultBook = response.data.books[0];
        
        // Invia la richiesta per caricare il libro di default
        await axios.post(`${API_BASE_URL}/api/select-book`, {
          book_id: defaultBook.id
        });
        
        setSelectedBook(defaultBook);
        setInitialized(true);
        setError(null);
      } else {
        setError('Nessun libro disponibile nel server');
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      // Imposta un messaggio di errore più specifico in base al tipo di errore
      if (error.code === 'ECONNABORTED') {
        setError('Timeout di connessione al server. Verifica che il backend sia in esecuzione.');
      } else if (error.response) {
        setError(`Errore dal server: ${error.response.data.message || error.response.status}`);
      } else if (error.request) {
        setError('Impossibile connettersi al server. Verifica che il backend sia in esecuzione su localhost:5001.');
      } else {
        setError(`Errore durante l'inizializzazione: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const isImageQuery = (query) => {
    return /immag|figur|schem|diagram|grafic|foto/i.test(query);
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    const userMessage = currentMessage;
    setCurrentMessage('');
    
    // Mostra la chat quando l'utente invia un messaggio
    setShowChat(true);
    
    // Aggiungi il messaggio dell'utente alla chat
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    
    // Se il sistema non è inizializzato, prova a inizializzarlo
    if (!initialized) {
      setMessages(prev => [...prev, { 
        type: 'system', 
        content: 'Inizializzazione del sistema in corso...' 
      }]);
      
      try {
        await fetchAndSelectDefaultBook();
        if (!initialized) {
          setMessages(prev => [...prev, { 
            type: 'error', 
            content: 'Impossibile inizializzare il sistema. Riprova più tardi.' 
          }]);
          return;
        }
      } catch (err) {
        setMessages(prev => [...prev, { 
          type: 'error', 
          content: 'Errore di connessione al server. Riprova più tardi.' 
        }]);
        return;
      }
    }
    
    // Verifica se è una query relativa a un'immagine
    if (isImageQuery(userMessage) && !pageNumber) {
      setShowPageInput(true);
      return;
    }
    
    await sendQueryToBackend(userMessage, pageNumber);
    
    // Reset del numero di pagina
    if (pageNumber) {
      setPageNumber('');
      setShowPageInput(false);
    }
  };

  const handlePageSubmit = async () => {
    if (!pageNumber.trim()) return;
    
    const lastUserMessage = messages[messages.length - 1].content;
    await sendQueryToBackend(lastUserMessage, pageNumber);
    
    setPageNumber('');
    setShowPageInput(false);
  };

  const sendQueryToBackend = async (query, page = null) => {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/api/query`, { 
        query: query,
        page_number: page
      });
      
      if (response.data.status === 'success') {
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: response.data.response 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          type: 'error', 
          content: response.data.message || 'Si è verificato un errore' 
        }]);
      }
    } catch (error) {
      console.error('Error sending query:', error);
      let errorMsg = 'Errore di connessione al server';
      if (error.response) {
        errorMsg = `Errore: ${error.response.data.message || error.response.status}`;
      }
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: errorMsg
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="exam-buddy">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <FaBook className="book-logo" />
          <h1>Exam Buddy</h1>
        </div>
        <nav className="navigation">
          <ul>
            <li><a href="#" className="active">Home</a></li>
            <li><a href="#">My Sessions</a></li>
            <li><a href="#">About</a></li>
            <li><a href="#" className="get-started-btn">Get Started</a></li>
          </ul>
        </nav>
      </header>

      {/* Main Content */}
      <main className="main-container">
        {!showChat ? (
          <>
            <section className="hero-section">
              <h1>Your AI Study Assistant</h1>
              <p className="subtitle">
                Ask any exam question and get instant, accurate answers to help you prepare for your exams.
                <br />Exam Buddy uses AI to provide comprehensive explanations tailored to your studies.
              </p>
              {error && (
                <div className="init-error">
                  <p>{error}</p>
                  <button onClick={fetchAndSelectDefaultBook} className="retry-btn">
                    <FaRedo className="retry-icon" /> Riprova connessione
                  </button>
                </div>
              )}
            </section>
            
            <section className="question-box">
              <h2>Ask Your Question</h2>
              <div className="search-container">
                <div className="search-icon">
                  <FaBook />
                </div>
                <input
                  type="text"
                  placeholder="Ask any exam question... (e.g., 'What are the key principles of thermodynamics?')"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button 
                  className="search-btn"
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || loading}
                >
                  <FaArrowRight />
                </button>
              </div>
            </section>

            <section className="bottom-section">
              <div className="book-icon-container">
                <FaBook className="big-book-icon" />
              </div>
              <h2>Ask Your Exam Questions</h2>
              <p>
                Enter any exam-related question above and get an instant, AI-powered answer to help with your studies.
              </p>
            </section>
          </>
        ) : (
          <>
            {/* Sidebar Toggle - manteniamo la barra laterale come elemento estetico */}
            <button className="sidebar-toggle" onClick={toggleSidebar}>
              {isSidebarOpen ? '✕' : '☰'}
            </button>
            
            {/* Sidebar - puramente estetica */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header">
                <h2>Materiale di Studio</h2>
                <button className="close-btn" onClick={toggleSidebar}>×</button>
              </div>
              <div className="sidebar-content">
                <ul className="book-list">
                  {books.length > 0 ? (
                    books.map((book) => (
                      <li 
                        key={book.id} 
                        className="book-item selected"
                      >
                        <div className="book-icon">📚</div>
                        <span>{book.name}</span>
                      </li>
                    ))
                  ) : (
                    <li className="no-books">Nessun libro caricato</li>
                  )}
                </ul>
                {error && (
                  <div className="sidebar-error">
                    <p>{error}</p>
                    <button onClick={fetchAndSelectDefaultBook} className="reload-btn">
                      <FaRedo /> Riprova
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Section */}
            <div className={`chat-section ${isSidebarOpen ? 'sidebar-open' : ''}`}>
              <header className="chat-header">
                <h1>{selectedBook ? selectedBook.name : 'AI Study Assistant'}</h1>
              </header>
              
              <div className="messages-area">
                {messages.length === 0 ? (
                  <div className="welcome-message">
                    <h2>Benvenuto nel tuo assistente di studio</h2>
                    <p>Fai qualsiasi domanda sul materiale di studio</p>
                    {error && (
                      <div className="init-error">
                        <p>{error}</p>
                        <button onClick={fetchAndSelectDefaultBook} className="retry-btn">
                          <FaRedo className="retry-icon" /> Riprova connessione
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.type}`}>
                      <div className="message-content">
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="message bot loading">
                    <div className="loading-indicator">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Page Input for Image Queries */}
              {showPageInput && (
                <div className="page-input-container">
                  <p>La tua domanda sembra riferirsi ad un'immagine. Specifica il numero di pagina:</p>
                  <div className="page-input-row">
                    <input
                      type="number"
                      min="1"
                      value={pageNumber}
                      onChange={(e) => setPageNumber(e.target.value)}
                      placeholder="Numero pagina"
                    />
                    <button onClick={handlePageSubmit}>Invia</button>
                  </div>
                </div>
              )}
              
              {/* Message Input */}
              <div className="input-area">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Scrivi la tua domanda..."
                  disabled={loading || showPageInput}
                />
                <button 
                  className="send-btn"
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || loading || showPageInput}
                >
                  Invia
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Error Notification */}
      {error && !showChat && (
        <div className="error-notification">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Chiudi</button>
        </div>
      )}
    </div>
  );
}

export default App;
