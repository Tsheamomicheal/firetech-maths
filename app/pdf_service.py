import fitz  # PyMuPDF
import os
import uuid
from typing import List

def convert_pdf_to_images(pdf_path: str, output_dir: str) -> List[str]:
    """
    Converts each page of a PDF into an image and returns a list of image paths.
    """
    doc = fitz.open(pdf_path)
    image_paths = []

    # Ensure a sub-directory for this specific PDF's pages
    pdf_id = str(uuid.uuid4())
    pdf_pages_dir = os.path.join(output_dir, pdf_id)
    os.makedirs(pdf_pages_dir, exist_ok=True)

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Higher resolution
        image_name = f"page_{page_num}.png"
        image_path = os.path.join(pdf_pages_dir, image_name)
        pix.save(image_path)
        # We'll return paths relative to the uploads folder
        image_paths.append(os.path.join(pdf_id, image_name))

    doc.close()
    return image_paths
