import json
import os
import uuid
import shutil
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Query
from fastapi.responses import FileResponse
from app.config import settings
from app.schemas import BookOverview
from app.services.pdf_parser import PDFParser
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store
from app.database import get_db_connection

router = APIRouter(prefix="/api/books", tags=["books"])

def get_book_metadata_path(book_id: str) -> str:
    return str(settings.DATA_DIR / f"{book_id}_metadata.json")

@router.post("/upload", response_model=BookOverview)
async def upload_book(
    file: UploadFile = File(...),
    uploaded_by: Optional[str] = Form(None),
    user_role: Optional[str] = Form(None),
    subject_name: Optional[str] = Form(None)
):
    """Upload textbook PDF, extract layout structure, embed text chunks, and index them."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported currently.")
        
    book_id = f"bk_{uuid.uuid4().hex[:8]}"
    file_path = settings.UPLOAD_DIR / f"{book_id}.pdf"
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save PDF upload: {str(e)}")

    # Parse structure (Chapters, text, tables, formulas, images)
    try:
        parsed_data = PDFParser.extract_structure(str(file_path), book_id)
    except Exception as e:
        # Cleanup file if parsing fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error parsing PDF layout structure: {str(e)}")

    # Prepare vector chunks for embedding indexing
    vector_docs = []
    
    # 1. Index general text pages
    for chapter_idx, chapter in enumerate(parsed_data["chapters"]):
        chapter_num = chapter_idx + 1
        for page in chapter["pages"]:
            page_text = page["text"]
            if not page_text.strip():
                continue
                
            # If text is too long, split it by paragraphs (heuristics)
            paragraphs = page_text.split("\n\n")
            for p_idx, p in enumerate(paragraphs):
                p_clean = p.strip()
                if len(p_clean) < 100:
                    continue # Skip very small fragments
                    
                chunk_id = f"{book_id}_ch{chapter_num}_p{page['page_number']}_chunk_{p_idx}"
                embedding = ai_service.get_embedding(p_clean)
                
                vector_docs.append({
                    "id": chunk_id,
                    "text": p_clean,
                    "embedding": embedding,
                    "metadata": {
                        "book_id": book_id,
                        "chapter_number": chapter_num,
                        "chapter_title": chapter["title"],
                        "page_number": page["page_number"],
                        "type": "text"
                    }
                })

    # 2. Index formulas
    for f_idx, formula in enumerate(parsed_data["formulas"]):
        chunk_id = f"{book_id}_formula_{formula['id']}"
        text_desc = f"Formula: {formula['raw_text']} (Page {formula['page_number']}, Chapter {formula['chapter_number']}: {formula['chapter_title']})"
        embedding = ai_service.get_embedding(text_desc)
        
        vector_docs.append({
            "id": chunk_id,
            "text": text_desc,
            "embedding": embedding,
            "metadata": {
                "book_id": book_id,
                "chapter_number": formula["chapter_number"],
                "chapter_title": formula["chapter_title"],
                "page_number": formula["page_number"],
                "type": "formula"
            }
        })

    # 3. Index tables
    for t_idx, table in enumerate(parsed_data["tables"]):
        # Read table file
        try:
            with open(table["file_path"], "r") as tf:
                tbl_data = json.load(tf)
            headers_clean = [str(h) for h in tbl_data['headers'] if h is not None]
            tbl_summary = f"Table on page {table['page_number']} with headers: {', '.join(headers_clean)}. Contains {len(tbl_data['rows'])} data rows."
            chunk_id = f"{book_id}_table_{table['id']}"
            embedding = ai_service.get_embedding(tbl_summary)
            
            vector_docs.append({
                "id": chunk_id,
                "text": tbl_summary,
                "embedding": embedding,
                "metadata": {
                    "book_id": book_id,
                    "chapter_number": table["chapter_number"],
                    "chapter_title": table["chapter_title"],
                    "page_number": table["page_number"],
                    "type": "table"
                }
            })
        except Exception as e:
            print(f"Skipping table embedding index due to error: {e}")

    # Add all docs to our simple vector store
    if vector_docs:
        vector_store.add_documents(vector_docs)

    # Save metadata JSON summary (excluding raw embedding weights to save space)
    metadata_summary = {
        "book_id": book_id,
        "filename": file.filename or "unknown.pdf",
        "subject_name": subject_name or "",
        "uploaded_by": uploaded_by or "",
        "total_pages": parsed_data["total_pages"],
        "chapters": [
            {
                "title": ch["title"],
                "start_page": ch["start_page"],
                "end_page": ch["end_page"],
                "page_count": len(ch["pages"])
            }
            for ch in parsed_data["chapters"]
        ],
        "image_count": len(parsed_data["images"]),
        "formula_count": len(parsed_data["formulas"]),
        "table_count": len(parsed_data["tables"]),
        "images": parsed_data["images"],
        "formulas": parsed_data["formulas"],
        "tables": parsed_data["tables"]
    }
    
    with open(get_book_metadata_path(book_id), "w") as f:
        json.dump(metadata_summary, f, indent=2)

    # Automatically approve if uploaded by Teacher or Admin, otherwise require approval (Student upload)
    approved_status = 1 if user_role in ["Teacher", "Administrator"] else 0

    # Insert into SQLite database
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO books (book_id, filename, subject_name, total_pages, image_count, formula_count, table_count, uploaded_by, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (book_id, file.filename or "unknown.pdf", subject_name or "", parsed_data["total_pages"], len(parsed_data["images"]), len(parsed_data["formulas"]), len(parsed_data["tables"]), uploaded_by, approved_status))
        conn.commit()
    except Exception as e:
        print(f"Error logging book to database: {e}")
    finally:
        conn.close()

    return BookOverview(**metadata_summary)

@router.get("/list", response_model=List[BookOverview])
async def list_books(user_role: Optional[str] = Query(None)):
    """List all parsed books. Students only see approved textbooks; teachers/admins see all."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if user_role == "Student":
        cursor.execute("SELECT book_id FROM books WHERE approved = 1")
    else:
        cursor.execute("SELECT book_id FROM books")
        
    book_rows = cursor.fetchall()
    conn.close()
    
    book_ids = [row["book_id"] for row in book_rows]
    books = []
    
    for book_id in book_ids:
        meta_path = get_book_metadata_path(book_id)
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                    meta = json.load(f)
                    books.append(BookOverview(**meta))
            except Exception as e:
                print(f"Error loading book metadata {book_id}: {e}")
    return books

@router.get("/{book_id}", response_model=BookOverview)
async def get_book(book_id: str):
    """Get metadata for a specific book."""
    meta_path = get_book_metadata_path(book_id)
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Book metadata not found.")
    with open(meta_path, "r") as f:
        meta = json.load(f)
    return BookOverview(**meta)

@router.get("/{book_id}/download")
async def download_book(book_id: str):
    """Download the original PDF file for a book."""
    pdf_path = settings.UPLOAD_DIR / f"{book_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found.")
    meta_path = get_book_metadata_path(book_id)
    filename = f"{book_id}.pdf"
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as f:
                meta = json.load(f)
                filename = meta.get("filename", filename)
        except Exception:
            pass
    return FileResponse(str(pdf_path), filename=filename, media_type="application/pdf")

@router.delete("/{book_id}")
async def delete_book(book_id: str):
    """Delete a book and its vector indexes."""
    # Delete from database
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM books WHERE book_id = ?", (book_id,))
        conn.commit()
    except Exception as e:
        print(f"Error deleting book from SQLite: {e}")
    finally:
        conn.close()

    meta_path = get_book_metadata_path(book_id)
    if os.path.exists(meta_path):
        os.remove(meta_path)
        
    # Delete PDF file
    pdf_path = settings.UPLOAD_DIR / f"{book_id}.pdf"
    if pdf_path.exists():
        pdf_path.unlink()
        
    # Delete vector items
    vector_store.delete_by_book(book_id)
    
    # Delete extracted files
    img_dir = settings.EXTRACTED_IMAGES_DIR / book_id
    if img_dir.exists():
        shutil.rmtree(img_dir)
        
    tbl_dir = settings.EXTRACTED_TABLES_DIR / book_id
    if tbl_dir.exists():
        shutil.rmtree(tbl_dir)
        
    return {"status": "success", "message": f"Book {book_id} deleted."}
