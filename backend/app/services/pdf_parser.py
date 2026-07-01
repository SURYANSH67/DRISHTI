import re
import os
import uuid
import fitz  # PyMuPDF
from typing import List, Dict, Any, Tuple
from pathlib import Path
from app.config import settings
from app.services.ai_service import ai_service

class PDFParser:
    @staticmethod
    def extract_structure(pdf_path: str, book_id: str) -> Dict[str, Any]:
        """
        Parses the PDF, extracts chapters, images, tables, formulas, and text blocks.
        """
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        # 1. Extract TOC (Table of Contents)
        toc = doc.get_toc()
        chapters = []
        
        # Determine chapters from TOC if available
        if toc:
            # First try to filter for only Level 1 entries (actual chapters)
            chapter_entries = [entry for entry in toc if entry[0] == 1]
            # If that yields fewer than 3 chapters, fall back to Level 1 and 2 entries
            if len(chapter_entries) < 3:
                chapter_entries = [entry for entry in toc if entry[0] in (1, 2)]
                
            for i, entry in enumerate(chapter_entries):
                level, title, start_page = entry
                # Make pages 1-indexed
                start_page = int(start_page)
                
                # Determine end page
                if i < len(chapter_entries) - 1:
                    end_page = int(chapter_entries[i+1][2]) - 1
                else:
                    end_page = total_pages
                
                # Check for "chapter" or "unit" in title (or default if it's the first level)
                chapters.append({
                    "title": title.strip(),
                    "start_page": max(1, start_page),
                    "end_page": min(total_pages, max(start_page, end_page)),
                    "pages": []
                })
        
        # Heuristic fallback if TOC is empty or too short
        if len(chapters) < 3:
            chapters = PDFParser._detect_chapters_heuristically(doc, total_pages)
            
        # Ensure we cover the entire book. If no chapters detected, make a single default chapter.
        if not chapters:
            chapters = [{
                "title": "Full Document",
                "start_page": 1,
                "end_page": total_pages,
                "pages": []
            }]

        # Create output directories for this book
        book_img_dir = settings.EXTRACTED_IMAGES_DIR / book_id
        book_img_dir.mkdir(parents=True, exist_ok=True)
        
        book_tbl_dir = settings.EXTRACTED_TABLES_DIR / book_id
        book_tbl_dir.mkdir(parents=True, exist_ok=True)

        extracted_images = []
        extracted_tables = []
        extracted_formulas = []

        # 2. Process page by page
        for page_num in range(1, total_pages + 1):
            page = doc[page_num - 1]
            
            # Find which chapter this page belongs to
            chapter_index = -1
            for idx, ch in enumerate(chapters):
                if ch["start_page"] <= page_num <= ch["end_page"]:
                    chapter_index = idx
                    break
            
            if chapter_index == -1:
                # Assign to the closest chapter
                chapter_index = 0
                
            chapter_title = chapters[chapter_index]["title"]
            chapter_num = chapter_index + 1

            # Extract Text Blocks
            text_blocks = []
            blocks = page.get_text("blocks")
            for b in blocks:
                # b = (x0, y0, x1, y1, "text", block_no, block_type)
                text = b[4].strip()
                if text and b[6] == 0:  # Text block
                    text_blocks.append({
                        "text": text,
                        "bbox": [b[0], b[1], b[2], b[3]]
                    })
                    
            # Try to detect formulas (Regex on block text)
            for b in text_blocks:
                text = b["text"]
                # Heuristics: contains math operators, symbols or standard equation pattern
                # e.g., "E = mc^2" or variables with equals
                if PDFParser._is_math_formula(text):
                    formula_id = f"frm_{uuid.uuid4().hex[:8]}"
                    # Clean up formula string or format
                    extracted_formulas.append({
                        "id": formula_id,
                        "raw_text": text,
                        "latex": text, # Will be refined later by AI if needed
                        "page_number": page_num,
                        "chapter_number": chapter_num,
                        "chapter_title": chapter_title
                    })

            # Extract Tables using PyMuPDF Table Finder
            try:
                tables = page.find_tables()
                for t_idx, table in enumerate(tables):
                    table_data = table.extract()
                    if table_data:
                        table_id = f"tbl_{uuid.uuid4().hex[:8]}"
                        table_file = book_tbl_dir / f"page_{page_num}_table_{t_idx}.json"
                        
                        # Convert table to JSON structure
                        structured_table = {
                            "id": table_id,
                            "headers": table_data[0] if len(table_data) > 0 else [],
                            "rows": table_data[1:] if len(table_data) > 1 else [],
                            "page_number": page_num,
                            "chapter_number": chapter_num,
                            "chapter_title": chapter_title
                        }
                        
                        with open(table_file, "w") as f:
                            import json
                            json.dump(structured_table, f, indent=2)
                            
                        extracted_tables.append({
                            "id": table_id,
                            "file_path": str(table_file),
                            "page_number": page_num,
                            "chapter_number": chapter_num,
                            "chapter_title": chapter_title
                        })
            except Exception as e:
                print(f"Error extracting tables on page {page_num}: {e}")

            # Extract Images/Diagrams
            img_list = page.get_images(full=True)
            for img_idx, img_info in enumerate(img_list):
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    img_filename = f"page_{page_num}_img_{img_idx}.{image_ext}"
                    img_path = book_img_dir / img_filename
                    
                    with open(img_path, "wb") as f:
                        f.write(image_bytes)
                        
                    # Find surrounding text (heuristic: text blocks close to this image position)
                    # For simplicity, grab text blocks on the same page
                    surrounding_text = " ".join([b["text"] for b in text_blocks[:3]])
                    
                    extracted_images.append({
                        "id": f"img_{uuid.uuid4().hex[:8]}",
                        "file_path": str(img_path),
                        "page_number": page_num,
                        "chapter_number": chapter_num,
                        "chapter_title": chapter_title,
                        "surrounding_text": surrounding_text[:500], # Keep description context manageable
                        "caption": f"Figure/Diagram on Page {page_num}",
                        "description": "" # Will be populated by AI Vision
                    })
                except Exception as e:
                    print(f"Error extracting image {xref} on page {page_num}: {e}")
            
            # Map page text
            full_page_text = page.get_text("text").strip()
            chapters[chapter_index]["pages"].append({
                "page_number": page_num,
                "text": full_page_text,
                "blocks": text_blocks
            })

        doc.close()

        # Clean empty chapters
        chapters = [ch for ch in chapters if len(ch["pages"]) > 0]

        return {
            "book_id": book_id,
            "total_pages": total_pages,
            "chapters": chapters,
            "images": extracted_images,
            "tables": extracted_tables,
            "formulas": extracted_formulas
        }

    @staticmethod
    def _detect_chapters_heuristically(doc, total_pages: int) -> List[Dict[str, Any]]:
        """Identify chapters based on heading patterns (e.g. Chapter 1, Introduction)."""
        chapters = []
        pattern = re.compile(r'^(chapter|unit|part|section)\s+\d+|introduction|conclusion|appendix', re.IGNORECASE)
        
        detected_points = []
        
        for page_num in range(1, total_pages + 1):
            page = doc[page_num - 1]
            text = page.get_text("text").split('\n')
            
            # Look at first few lines for headings
            for line in text[:5]:
                line_clean = line.strip()
                if len(line_clean) < 60 and pattern.search(line_clean):
                    detected_points.append((line_clean, page_num))
                    break
                    
        # Filter duplicates/close headings and duplicate titles (running page headers)
        filtered_points = []
        last_page = -10
        seen_normalized_titles = set()
        for title, p_num in detected_points:
            # Normalize title to prevent running page headers from triggering duplicate chapters
            norm_title = re.sub(r'\s+', ' ', title.lower().strip())
            # If it starts with a chapter/unit identifier, group by that identifier (e.g. "chapter 1")
            chapter_match = re.search(r'^(chapter|unit|part)\s+\d+', norm_title)
            title_key = chapter_match.group(0) if chapter_match else norm_title
            
            if p_num - last_page >= 3 and title_key not in seen_normalized_titles:
                filtered_points.append((title, p_num))
                seen_normalized_titles.add(title_key)
                last_page = p_num

        # Re-build chapters with start and end pages
        for i, (title, start_page) in enumerate(filtered_points):
            if i < len(filtered_points) - 1:
                end_page = filtered_points[i+1][1] - 1
            else:
                end_page = total_pages
            
            chapters.append({
                "title": title,
                "start_page": start_page,
                "end_page": end_page,
                "pages": []
            })
            
        return chapters

    @staticmethod
    def _is_math_formula(text: str) -> bool:
        """Check if a block of text resembles a mathematical equation."""
        text_clean = text.strip()
        if len(text_clean) > 200 or len(text_clean) < 3:
            return False
            
        # Check for equals or inequality signs and typical operators
        has_eq = '=' in text_clean or '≠' in text_clean or '<' in text_clean or '>' in text_clean
        has_symbols = any(sym in text_clean for sym in ['+', '-', '*', '/', '^', '√', 'π', 'θ', 'λ', '∫', '∑', 'Δ', 'α', 'β', 'γ', '\\'])
        
        # Check if text is mostly digits, operators, math symbols, and single-letter variables
        letters = re.findall(r'[a-zA-Z]', text_clean)
        # Standard english text usually has longer words. Math formulas typically have single/double-letter variables.
        words = text_clean.split()
        avg_word_len = sum(len(w) for w in words) / len(words) if words else 0
        
        return has_eq and (has_symbols or avg_word_len < 3.5)
