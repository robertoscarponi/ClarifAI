import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { FaArrowRight, FaRedo, FaMoon, FaSun } from 'react-icons/fa';
import ClarifAILogo from './LogoAI';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS styles

const API_BASE_URL = 'http://127.0.0.1:5001'; // Use the new port

function App() {
  // Add theme state
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Existing state
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
  const [isImageMode, setIsImageMode] = useState(false); // Add a new state for image mode

  const sidebarRef = useRef(null);

  // Load and set the book on startup
  useEffect(() => {
    fetchAndSelectDefaultBook();
  }, []);

  // Modify the useEffect that manages the theme
  useEffect(() => {
    // Check if there is a saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
    
    // Apply the class to the root element instead of the body
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.add('light-mode');
    }
    
    // Save the preference
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Add this useEffect to handle clicks outside the sidebar
  useEffect(() => {
    function handleClickOutside(event) {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        // Check if it's not a click on the sidebar button
        const isSidebarToggle = event.target.closest('.sidebar-toggle');
        
        if (!isSidebarToggle) {
          setIsSidebarOpen(false);
        }
      }
    }
    
    // Add the event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  // Replace the toggleTheme function with this version
  const toggleTheme = (event) => {
    // Prevent event propagation in case of problems
    if (event) event.stopPropagation();
    
    console.log("Toggling theme from:", isDarkMode, "to:", !isDarkMode);
    
    // Use the functional form of the setter to ensure it always uses the most updated value
    setIsDarkMode(prevMode => {
      const newMode = !prevMode;
      
      // Immediately apply the class to avoid rendering delays
      if (newMode) {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
      }
      
      // Save the preference immediately
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      
      return newMode;
    });
  };

  const fetchAndSelectDefaultBook = async () => {
    try {
      setLoading(true);
      // First check if the server is reachable
      const response = await axios.get(`${API_BASE_URL}/api/books`, { timeout: 3000 });
      
      if (response.data.status === 'success' && response.data.books.length > 0) {
        setBooks(response.data.books);
        
        // Automatically select the first book
        const defaultBook = response.data.books[0];
        
        // Send the request to load the default book
        await axios.post(`${API_BASE_URL}/api/select-book`, {
          book_id: defaultBook.id
        });
        
        setSelectedBook(defaultBook);
        setInitialized(true);
        setError(null);
      } else {
        setError('No books available on the server');
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      // Set a more specific error message
      if (error.code === 'ECONNABORTED') {
        setError('Connection timeout to server. Verify that the backend is running.');
      } else if (error.response) {
        setError(`Error from server: ${error.response.data.message || error.response.status}`);
      } else if (error.request) {
        setError('Unable to connect to server. Verify that the backend is running on localhost:5001.');
      } else {
        setError(`Error during initialization: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const isImageQuery = (query) => {
    return /image|figure|schema|diagram|graphic|photo/i.test(query);
  };

  // Add this new function to extract page number from a query
  const extractPageNumber = (query) => {
    // Specific patterns with higher priority
    const specificPatterns = [
      /page\s+(\d+)/i,
      /pg\.\s*(\d+)/i,
      /pg\s+(\d+)/i,
      /p\.\s*(\d+)/i,
      /page number\s+(\d+)/i,
      /number\s+(\d+)/i,
      /figure\s+(\d+)/i,
      /fig\.\s*(\d+)/i,
      /image\s+(\d+)/i,
    ];
    
    // Try first with specific patterns
    for (const pattern of specificPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Fallback: look for any number in the string
    // Capture number at the beginning, middle, or end of the string
    const genericNumberPattern = /\b(\d+)\b/g;
    const matches = [...query.matchAll(genericNumberPattern)];
    
    if (matches.length > 0) {
      // If there are multiple numbers, select the one that seems most likely to be a page number
      if (matches.length === 1) {
        return matches[0][1]; // If there's only one number, return it
      } else {
        // If there are multiple numbers, try to figure out which is the page number
        // Strategy: check if any of the numbers is preceded by words that might indicate a page
        const pageIndicators = ["pg", "page", "p", "fig", "figure", "image", "number", "num"];
        
        for (const indicator of pageIndicators) {
          const indicatorIndex = query.toLowerCase().indexOf(indicator);
          if (indicatorIndex >= 0) {
            // Find the number closest to the indicator
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
        
        // If we don't find a number near an indicator, take the first number
        return matches[0][1];
      }
    }
    
    return null;
  };

  // Modify the sendMessage function to use extractPageNumber also when a page number is required
  const sendMessage = async () => {
    if (!currentMessage.trim() || loading) return;
    
    try {
      setLoading(true);
      
      // Add the user message to the list
      const userMessage = currentMessage.trim();
      setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
      setCurrentMessage('');
      
      // Activate chat display
      setShowChat(true);
      
      // Check if we are waiting for a page number
      if (showPageInput) {
        // First try to extract a page number from the response 
        const detectedPageNumber = extractPageNumber(userMessage);
        
        if (detectedPageNumber) {
          // The user has provided a page number in some format (page X, figure X, etc.)
          await sendQueryToBackend(messages[messages.length-2].content, detectedPageNumber);
          setShowPageInput(false);
        } else if (/^\d+$/.test(userMessage)) {
          // Fallback for a simple number (previous behavior)
          await sendQueryToBackend(messages[messages.length-2].content, userMessage);
          setShowPageInput(false);
        } else {
          // No recognizable page number was provided
          setLoading(false);
          setMessages(prev => [...prev, { 
            type: 'bot', 
            content: "I'm sorry, but I couldn't identify a page number in your response. Could you write it in numeric format (e.g. '42') or with the word page (e.g. 'page 42')? Thank you for your patience!"
          }]);
          return;
        }
      }
      // Check if we are in image mode (but not already waiting for a page number)
      else if (isImageMode) {
        // Try to extract the page number from the user's message
        const detectedPageNumber = extractPageNumber(userMessage);
        
        if (detectedPageNumber) {
          // If a page number was found, send the query directly with that number
          await sendQueryToBackend(userMessage, detectedPageNumber);
        } else {
          // If no page number was found, ask the user to enter one
          setShowPageInput(true);
          setLoading(false);
          setMessages(prev => [...prev, { 
            type: 'bot', 
            content: "📖 To analyze the image you requested, I would need to know the page number. Could you tell me which page of the document you want to examine? You can write it simply as 'page 42' or just '42', thanks!"
          }]);
          return;
        }
      }
      else {
        // Normal question and answer flow
        await sendQueryToBackend(userMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: 'Connection error to the server. Try again later.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Remove the handlePageSubmit function which is no longer needed

  // Modify sendQueryToBackend to better handle the response when a page is needed
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
        // Instead of showing the separate input, add a message to the chat
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: "📖 I need a little help: could you tell me the page number of the image you would like to analyze? Thank you!" 
        }]);
        setShowPageInput(true);
      } else {
        throw new Error(response.data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('API Error:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: `Error: ${error.message}` 
      }]);
    }
  };

  // Function to activate/deactivate image mode
  const toggleImageMode = () => {
    setIsImageMode(prev => !prev);
    // If we deactivate image mode, also hide the page input
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
      
      {/* Sidebar Toggle - Moved outside the showChat condition */}
      <button className="sidebar-toggle" onClick={toggleSidebar}>
        {isSidebarOpen ? '✕' : '☰'}
      </button>
      
      {/* Sidebar - Moved outside the showChat condition */}
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
                  <span>{book.name === "Reti e telecomunicazioni Pattavina" ? "Telecommunications Networks" : book.name}</span>
                </li>
              ))
            ) : (
              <li className="no-books">No books loaded</li>
            )}
          </ul>
          
          {/* Add this section for fictitious books */}
          <h3 className="sidebar-section-title">Available Materials</h3>
          <ul className="book-list">
            <li className="book-item">
              <div className="book-icon">📘</div>
              <span>Mathematical Analysis I</span>
            </li>
            <li className="book-item">
              <div className="book-icon">📙</div>
              <span>Telecommunications Networks</span> {/* Modified title here */}
            </li>
            <li className="book-item">
              <div className="book-icon">📗</div>
              <span>Physics</span>
            </li>
            <li className="book-item">
              <div className="book-icon">📕</div>
              <span>Business Economics and Organization</span>
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
                <FaRedo /> Retry
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
                    <FaRedo className="retry-icon" /> Retry connection
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
                  <h2>Welcome to your study assistant</h2>
                  <p>Ask any question about the study material</p>
                  {error && (
                    <div className="init-error">
                      <p>{error}</p>
                      <button onClick={fetchAndSelectDefaultBook} className="retry-btn">
                        <FaRedo className="retry-icon" /> Retry connection
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
                placeholder={isImageMode && showPageInput ? "Enter the page number..." : isImageMode ? "Describe what you want to analyze in the image..." : "Write your question..."}
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
          <button onClick={() => setError(null)}>Close</button>
        </div>
      )}
    </div>
  );
}

export default App;
