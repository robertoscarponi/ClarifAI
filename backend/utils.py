import google.generativeai as genai

def count_tokens(text, model_name="gemini-1.5-flash"):
    """
    Conta i token usando l'API ufficiale di Google per il tokenizer di Gemini.
    Fornisce un conteggio preciso specifico per il modello utilizzato.
    """
    model = genai.GenerativeModel(model_name)
    response = model.count_tokens(text)
    return response.total_tokens