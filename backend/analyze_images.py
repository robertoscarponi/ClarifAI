import google.generativeai as genai
import PIL.Image
from tenacity import retry, stop_after_attempt, wait_exponential
import time

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=20))
def analyze_image(image_path):
    """Analizza un'immagine con Gemini e genera una descrizione dettagliata."""
    # Add a 6-second delay before each API call
    time.sleep(6)
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    img = PIL.Image.open(image_path)
    
    prompt = """Analizza questa immagine che proviene da un libro di reti di telecomunicazioni.
    Se è un diagramma tecnico, descrivi in dettaglio cosa rappresenta, i componenti presenti e i concetti illustrati.
    Se è una figura con testo, includi il testo nella tua descrizione.
    Fornisci una spiegazione tecnica e completa che possa essere utilizzata come contesto per un sistema RAG."""
    
    response = model.generate_content([prompt, img])
    return response.text