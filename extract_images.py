import fitz  # PyMuPDF
import io
from PIL import Image
import os

def extract_images_from_pdf(pdf_path, output_dir="extracted_images"):
    """Estrae tutte le immagini dal PDF e le salva nella directory specificata."""
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = []
    doc = fitz.open(pdf_path)
    
    for page_num, page in enumerate(doc):
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            
            # Crea un oggetto immagine PIL
            image = Image.open(io.BytesIO(image_bytes))
            
            # Converti CMYK in RGB se necessario
            if image.mode == 'CMYK':
                image = image.convert('RGB')
            
            # Salva l'immagine
            image_filename = f"page_{page_num+1}_img_{img_index+1}.png"
            image_path = os.path.join(output_dir, image_filename)
            image.save(image_path)
            
            # Salva il percorso e il numero di pagina
            image_paths.append((image_path, page_num))
    
    return image_paths

def render_pdf_pages(pdf_path, output_dir="rendered_pages", pages=None):
    """
    Renderizza intere pagine del PDF come immagini.
    
    Args:
        pdf_path: Percorso al file PDF
        output_dir: Directory dove salvare le immagini renderizzate
        pages: Lista di numeri di pagina da renderizzare (base 0), o None per tutte
    """
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = []
    doc = fitz.open(pdf_path)
    
    # Se pages è None, renderizza tutte le pagine
    if pages is None:
        pages = range(len(doc))
    
    for page_num in pages:
        if page_num < 0 or page_num >= len(doc):
            continue
            
        page = doc[page_num]
        
        # Renderizza pagina con risoluzione maggiorata (zoom=2.0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        
        # Salva l'immagine
        image_filename = f"page_{page_num+1}.png"
        image_path = os.path.join(output_dir, image_filename)
        pix.save(image_path)
        
        # Salva il percorso e il numero di pagina
        image_paths.append((image_path, page_num))
    
    return image_paths