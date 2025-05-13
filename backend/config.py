import os
from dotenv import load_dotenv

load_dotenv()

gemini_api_key = os.environ.get("GEMINI_API_KEY")

if not gemini_api_key:
    print("Error: the environment variable GEMINI_API_KEY is not set.")
    
    raise ValueError("GEMINI_API_KEY not found in environment variables.")
    exit(1)


