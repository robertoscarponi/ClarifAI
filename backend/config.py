import os
from dotenv import load_dotenv

load_dotenv()

gemini_api_key = os.environ.get("GEMINI_API_KEY")

if not gemini_api_key:
    print("Errore: la variabile d'ambiente GEMINI_API_KEY non è impostata.")
    # Potresti anche voler sollevare un'eccezione o uscire dal programma qui
    raise ValueError("GEMINI_API_KEY non trovata nelle variabili d'ambiente.")
    exit(1)


