import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { FaArrowRight, FaRedo, FaMoon, FaSun } from 'react-icons/fa';
import ClarifAILogo from './LogoAI';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css'; // Importa gli stili CSS di KaTeX

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
  const [isImageMode, setIsImageMode] = useState(false); // Aggiungi un nuovo stato per la modalità immagine

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

  // Aggiungi questa nuova funzione per estrarre il numero di pagina da una query
  const extractPageNumber = (query) => {
    // Pattern specifici con priorità più alta
    const specificPatterns = [
      /pagina\s+(\d+)/i,
      /pag\.\s*(\d+)/i,
      /pag\s+(\d+)/i,
      /p\.\s*(\d+)/i,
      /pagina numero\s+(\d+)/i,
      /numero\s+(\d+)/i,
      /figura\s+(\d+)/i,
      /fig\.\s*(\d+)/i,
      /immagine\s+(\d+)/i,
    ];
    
    // Prova prima con i pattern specifici
    for (const pattern of specificPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Fallback: cerca qualsiasi numero nella stringa
    // Cattura numero all'inizio, al centro o alla fine della stringa
    const genericNumberPattern = /\b(\d+)\b/g;
    const matches = [...query.matchAll(genericNumberPattern)];
    
    if (matches.length > 0) {
      // Se ci sono più numeri, seleziona quello che sembra più probabile essere un numero di pagina
      if (matches.length === 1) {
        return matches[0][1]; // Se c'è un solo numero, restituiscilo
      } else {
        // Se ci sono più numeri, cerca di capire qual è il numero di pagina
        // Strategia: controlla se qualcuno dei numeri è preceduto da parole che potrebbero indicare una pagina
        const pageIndicators = ["pag", "pagina", "pg", "p", "page", "fig", "figura", "immagine", "numero", "num"];
        
        for (const indicator of pageIndicators) {
          const indicatorIndex = query.toLowerCase().indexOf(indicator);
          if (indicatorIndex >= 0) {
            // Trova il numero più vicino all'indicatore
            let closestMatch = null;
            let minDistance = Infinity;
            
            for (const match of matches) {
              const matchIndex = match.index;
              const distance = Math.abs(matchIndex - indicatorIndex);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestMatch = match;
              }
            }
            
            if (closestMatch) return closestMatch[1];
          }
        }
        
        // Se non troviamo un numero vicino a un indicatore, prendiamo il primo numero
        return matches[0][1];
      }
    }
    
    return null;
  };

  // Modifica la funzione sendMessage per utilizzare extractPageNumber anche quando è richiesto un numero di pagina
  const sendMessage = async () => {
    if (!currentMessage.trim() || loading) return;
    
    try {
      setLoading(true);
      
      // Aggiungi il messaggio dell'utente alla lista
      const userMessage = currentMessage.trim();
      setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
      setCurrentMessage('');
      
      // Attiva la visualizzazione della chat
      setShowChat(true);
      
      // Verifica se stiamo aspettando il numero di pagina
      if (showPageInput) {
        // Prova prima a estrarre un numero di pagina dalla risposta 
        const detectedPageNumber = extractPageNumber(userMessage);
        
        if (detectedPageNumber) {
          // L'utente ha fornito un numero di pagina in qualche formato (pagina X, figura X, ecc.)
          await sendQueryToBackend(messages[messages.length-2].content, detectedPageNumber);
          setShowPageInput(false);
        } else if (/^\d+$/.test(userMessage)) {
          // Fallback per un semplice numero (comportamento precedente)
          await sendQueryToBackend(messages[messages.length-2].content, userMessage);
          setShowPageInput(false);
        } else {
          // Non è stato fornito un numero di pagina riconoscibile
          setLoading(false);
          setMessages(prev => [...prev, { 
            type: 'bot', 
            content: "Mi dispiace, ma non sono riuscito a identificare il numero di pagina nella tua risposta. Potresti scriverlo in formato numerico (es. '42') o con la parola pagina (es. 'pagina 42')? Grazie per la pazienza!"
          }]);
          return;
        }
      }
      // Verifica se siamo in modalità immagine (ma non stiamo già aspettando un numero di pagina)
      else if (isImageMode) {
        // Prova a estrarre il numero di pagina dal messaggio dell'utente
        const detectedPageNumber = extractPageNumber(userMessage);
        
        if (detectedPageNumber) {
          // Se è stato trovato un numero di pagina, invia direttamente la query con quel numero
          await sendQueryToBackend(userMessage, detectedPageNumber);
        } else {
          // Se non è stato trovato un numero di pagina, richiedi all'utente di inserirlo
          setShowPageInput(true);
          setLoading(false);
          setMessages(prev => [...prev, { 
            type: 'bot', 
            content: "📖 Per analizzare l'immagine che hai richiesto, avrei bisogno di sapere il numero di pagina. Potresti indicarmi quale pagina del documento desideri esaminare? Puoi scriverlo semplicemente come 'pagina 42' o solo '42', grazie!"
          }]);
          return;
        }
      }
      else {
        // Normale flusso di domanda e risposta
        await sendQueryToBackend(userMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: 'Errore di connessione al server. Riprova più tardi.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Rimuovi la funzione handlePageSubmit che non è più necessaria

  // Modifica sendQueryToBackend per gestire meglio la risposta quando serve una pagina
  const sendQueryToBackend = async (query, page = null) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query`, {
        query,
        page_number: page,
        is_image_mode: isImageMode
      });
      
      if (response.data.status === 'success') {
        setMessages(prev => [...prev, { type: 'bot', content: response.data.response }]);
      } else if (response.data.status === 'page_required') {
        // Invece di mostrare l'input separato, aggiungiamo un messaggio alla chat
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: "📖 Ho bisogno di un piccolo aiuto: potresti indicarmi il numero di pagina dell'immagine che vorresti analizzare? Grazie!" 
        }]);
        setShowPageInput(true);
      } else {
        throw new Error(response.data.message || 'Errore sconosciuto');
      }
    } catch (error) {
      console.error('API Error:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: `Errore: ${error.message}` 
      }]);
    }
  };

  // Funzione per attivare/disattivare la modalità immagine
  const toggleImageMode = () => {
    setIsImageMode(prev => !prev);
    // Se disattiviamo la modalità immagine, nascondi anche l'input della pagina
    if (isImageMode) {
      setShowPageInput(false);
      setPageNumber('');
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
          <h2>Academic Resources</h2>
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
                  <span>{book.name === "Reti e telecomunicazioni Pattavina" ? "Reti di telecomunicazioni" : book.name}</span>
                </li>
              ))
            ) : (
              <li className="no-books">Nessun libro caricato</li>
            )}
          </ul>
          
          {/* Aggiungi questa sezione per i libri fittizi */}
          <h3 className="sidebar-section-title">Available Materials</h3>
          <ul className="book-list">
            <li className="book-item">
              <div className="book-icon">📘</div>
              <span>Analisi Matematica I</span>
            </li>
            <li className="book-item">
              <div className="book-icon">📙</div>
              <span>Reti di telecomunicazioni</span> {/* Titolo modificato qui */}
            </li>
            <li className="book-item">
              <div className="book-icon">📗</div>
              <span>Fisica</span>
            </li>
            <li className="book-item">
              <div className="book-icon">📕</div>
              <span>Economia e Organizzazione Aziendale</span>
            </li>
            <li className="book-item">
              <div className="book-icon">📓</div>
              <span>Computer Networks</span>
            </li>
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
              <div className="image-mode-toggle">
                <button 
                  className={`image-mode-btn ${isImageMode ? 'active' : ''}`} 
                  onClick={toggleImageMode}
                >
                  {isImageMode ? 'Exit Image Mode' : 'Image Analysis Mode'}
                </button>
                {isImageMode && <span className="image-mode-indicator">Image Analysis Mode Active</span>}
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
                    {msg.type === 'bot' && (
                      <div className="message-header">
                        <ClarifAILogo className="message-logo" />
                        <span className="message-title">Clarif<span className="message-title-highlight">AI</span></span>
                      </div>
                    )}
                    <div className="message-content">
                      {msg.type === 'bot' ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
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
            
            {/* Message Input */}
            <div className="input-area">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isImageMode && showPageInput ? "Inserisci il numero di pagina..." : isImageMode ? "Descrivi cosa vuoi analizzare nell'immagine..." : "Scrivi la tua domanda..."}
                disabled={loading}
              />
              <button 
                className={`image-mode-btn ${isImageMode ? 'active' : ''}`}
                onClick={toggleImageMode}
                disabled={loading}
              >
                {isImageMode ? 'Exit Image Mode' : 'Image'}
              </button>
              <button 
                className="search-btn"
                onClick={sendMessage}
                disabled={!currentMessage.trim() || loading}
              >
                <FaArrowRight />
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
