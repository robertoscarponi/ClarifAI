import google.generativeai as genai

def count_tokens(text, model_name="gemini-1.5-flash"):
    """
    Counts tokens using the official Google API for Gemini's tokenizer.
    Provides an accurate count specific to the model being used.
    """
    model = genai.GenerativeModel(model_name)
    response = model.count_tokens(text)
    return response.total_tokens