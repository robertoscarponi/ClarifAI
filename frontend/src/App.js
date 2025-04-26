import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { FaArrowRight, FaRedo, FaMoon, FaSun } from 'react-icons/fa';
import ClarifAILogo from './LogoAI';

const API_BASE_URL = 'http://127.0.0.1:5001'; // Usa la nuova porta

function App() {
  // Aggiungi stato per il tema
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Stato esistente
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

  const sidebarRef = useRef(null);

  // Carica il libro e lo imposta all'avvio
  useEffect(() => {
    fetchAndSelectDefaultBook();
  }, []);

  // Modifica l'useEffect che gestisce il tema
  useEffect(() => {
    // Controlla se c'è una preferenza salvata
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
    
    // Applica la classe all'elemento root invece che al body
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.add('light-mode');
    }
    
    // Salva la preferenza
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Aggiungi questo useEffect per gestire i clic all'esterno della sidebar
  useEffect(() => {
    function handleClickOutside(event) {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        // Verifica che non sia un clic sul pulsante della sidebar
        const isSidebarToggle = event.target.closest('.sidebar-toggle');
        
        if (!isSidebarToggle) {
          setIsSidebarOpen(false);
        }
      }
    }
    
    // Aggiungi l'event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  // Sostituisci la funzione toggleTheme con questa versione
  const toggleTheme = (event) => {
    // Previeni la propagazione dell'evento in caso di problemi
    if (event) event.stopPropagation();
    
    console.log("Toggling theme from:", isDarkMode, "to:", !isDarkMode);
    
    // Usa il form funzionale del setter per garantire che usi sempre il valore più aggiornato
    setIsDarkMode(prevMode => {
      const newMode = !prevMode;
      
      // Applica immediatamente la classe per evitare ritardi di rendering
      if (newMode) {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
      }
      
      // Salva la preferenza subito
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      
      return newMode;
    });
  };

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
      // Imposta un messaggio di errore più specifico
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
    // Funzione esistente... non modificata
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
    // Funzione esistente... non modificata
    if (!pageNumber.trim()) return;
    
    const lastUserMessage = messages[messages.length - 1].content;
    await sendQueryToBackend(lastUserMessage, pageNumber);
    
    setPageNumber('');
    setShowPageInput(false);
  };

  const sendQueryToBackend = async (query, page = null) => {
    // Funzione esistente... non modificata
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
    <div className={`clarif-ai ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      {/* Header */}
      <header className="header">
        <div className="logo">
          <ClarifAILogo className="logo-svg" />
          <h1 className="app-title">Clarif<span className="highlight-ai">AI</span></h1>
        </div>
        <nav className="navigation">
          <ul>
            <li><a href="#" className="active" onClick={(e) => {
              e.preventDefault();
              setShowChat(false);
            }}>Home</a></li>
            <li><a href="#">My Sessions</a></li>
            <li><a href="#">About</a></li>
            <li><a href="#" className="get-started-btn">Get Started</a></li>
            <li>
              <button onClick={toggleTheme} className="theme-toggle-btn">
                {isDarkMode ? <FaSun className="theme-icon" /> : <FaMoon className="theme-icon" />}
              </button>
            </li>
          </ul>
        </nav>
      </header>
      
      {/* Sidebar Toggle - Spostato fuori dalla condizione showChat */}
      <button className="sidebar-toggle" onClick={toggleSidebar}>
        {isSidebarOpen ? '✕' : '☰'}
      </button>
      
      {/* Sidebar - Spostato fuori dalla condizione showChat */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
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

      {/* Main Content */}
      <main className={`main-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        {!showChat ? (
          <>
            <section className="hero-section">
              <div className="center-logo">
                <ClarifAILogo className="hero-logo-svg" />
                <h1 className="hero-title">Clarif<span className="highlight-ai">AI</span></h1>
              </div>
              <h2 className="subtitle-heading">Your AI Study Assistant</h2>
              <p className="subtitle">
                Ask any exam question and get instant, accurate answers to help you prepare for your exams.
                <br />ClarifAI uses AI to provide comprehensive explanations tailored to your studies.
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
              <h2>How can I help you?</h2>
              <div className="search-container">
                <div className="search-icon">
                  <ClarifAILogo className="search-logo-icon" />
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
          </>
        ) : (
          <div className={`chat-section ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            <header className="chat-header">
              <h1>
                {selectedBook ? `Clarifying on: ${selectedBook.name}` : 'AI Study Assistant'}
              </h1>
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
