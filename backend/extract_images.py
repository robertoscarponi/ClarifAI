import fitz  # PyMuPDF
import io
from PIL import Image
import os

def render_pdf_pages(pdf_path, output_dir="rendered_pages", pages=None):
    """
    Renders entire PDF pages as images.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory where to save the rendered images
        pages: List of page numbers to render (0-based), or None for all pages
    """
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = []
    doc = fitz.open(pdf_path)
    
    # If pages is None, render all pages
    if pages is None:
        pages = range(len(doc))
    
    for page_num in pages:
        if page_num < 0 or page_num >= len(doc):
            continue
            
        page = doc[page_num]
        
        # Render page with increased resolution (zoom=2.0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        
        # Save the image
        image_filename = f"page_{page_num+1}.png"
        image_path = os.path.join(output_dir, image_filename)
        pix.save(image_path)
        
        # Save the path and page number
        image_paths.append((image_path, page_num))
    
    return image_paths