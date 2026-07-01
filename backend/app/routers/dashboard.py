import os
import json
import shutil
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from app.config import settings
from app.schemas import EvaluationResponse
from app.services.evaluator import evaluator
from app.database import get_db_connection

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_stats(user_id: str = Query(...)):
    """Retrieve learning statistics and aggregate logs for a specific user from SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. System counts
    cursor.execute("SELECT COUNT(book_id) FROM books WHERE approved = 1")
    approved_books = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(book_id) FROM books")
    total_books = cursor.fetchone()[0]
    
    # Estimate total formulas and diagrams from metadata
    cursor.execute("SELECT SUM(formula_count), SUM(image_count), SUM(table_count) FROM books WHERE approved = 1")
    row = cursor.fetchone()
    total_formulas = row[0] or 0
    total_diagrams = row[1] or 0
    total_tables = row[2] or 0

    # 2. User quiz attempts count and avg accuracy
    cursor.execute("SELECT COUNT(id), AVG(CAST(score AS REAL) / total) FROM quiz_attempts WHERE user_id = ?", (user_id,))
    q_count, q_avg = cursor.fetchone()
    q_avg_pct = round(q_avg * 100, 1) if q_avg is not None else 0.0

    # 3. User evaluations count and avg score
    cursor.execute("SELECT COUNT(id), AVG(score) FROM evaluations WHERE user_id = ?", (user_id,))
    e_count, e_avg = cursor.fetchone()
    e_avg_pct = round(e_avg * 10, 1) if e_avg is not None else 0.0

    # 4. Recent activities (Join Quiz attempts and Evaluations)
    cursor.execute("""
    SELECT 'Quiz' as type, book_id, chapter_number, score, total, timestamp, '' as detail 
    FROM quiz_attempts 
    WHERE user_id = ?
    UNION ALL
    SELECT 'Evaluation' as type, '' as book_id, 0 as chapter_number, score, 10 as total, timestamp, question as detail 
    FROM evaluations 
    WHERE user_id = ?
    ORDER BY timestamp DESC LIMIT 8
    """, (user_id, user_id))
    activities = [dict(row) for row in cursor.fetchall()]

    # 5. Identify weak chapters (attempts with average accuracy < 70%)
    cursor.execute("""
    SELECT book_id, chapter_number, AVG(CAST(score AS REAL) / total) * 100 as avg_score 
    FROM quiz_attempts 
    WHERE user_id = ?
    GROUP BY book_id, chapter_number 
    HAVING avg_score < 70
    ORDER BY avg_score ASC LIMIT 5
    """, (user_id,))
    weak_chapters = [dict(row) for row in cursor.fetchall()]
    
    conn.close()

    return {
        "book_count": approved_books,
        "total_books_registered": total_books,
        "total_formulas": total_formulas,
        "total_diagrams": total_diagrams,
        "total_tables": total_tables,
        "quizzes_taken_count": q_count,
        "evaluations_completed_count": e_count,
        "average_quiz_accuracy": q_avg_pct,
        "average_evaluation_score": e_avg_pct,
        "weak_chapters": weak_chapters,
        "recent_activity": activities
    }

@router.post("/log-quiz")
async def log_quiz_attempt(
    user_id: str = Form(...),
    book_id: str = Form(...),
    chapter_number: int = Form(...),
    score: int = Form(...),
    total: int = Form(...)
):
    """Log a completed student quiz attempt in SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    attempt_id = f"qz_{uuid.uuid4().hex[:6]}"
    timestamp = datetime.now().isoformat()
    
    try:
        cursor.execute("""
        INSERT INTO quiz_attempts (id, user_id, book_id, chapter_number, score, total, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (attempt_id, user_id, book_id, chapter_number, score, total, timestamp))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database log error: {str(e)}")
        
    conn.close()
    return {"status": "success", "attempt_id": attempt_id}

@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_student_answer(
    question: str = Form(...),
    reference_answer: str = Form(...),
    student_answer_text: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    book_id: Optional[str] = Form(None),
    chapter_number: Optional[int] = Form(None)
):
    """
    Grades a student's answer using OCR and multimodal LLM logic.
    Persists evaluation metrics inside SQLite database for student analytics.
    """
    file_path = None
    if file:
        file_id = uuid.uuid4().hex[:8]
        filename = file.filename or f"answer_{file_id}.jpg"
        file_path = str(settings.UPLOAD_DIR / f"student_{file_id}_{filename}")
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save student answer upload: {e}")

    try:
        # Run vision OCR and grading completion
        result = evaluator.evaluate(
            question=question,
            reference_answer=reference_answer,
            student_answer_text=student_answer_text,
            student_answer_file_path=file_path
        )
        
        timestamp = datetime.now().isoformat()

        # Log to evaluations database table for student profile overview
        if user_id:
            conn = get_db_connection()
            cursor = conn.cursor()
            eval_id = f"ev_{uuid.uuid4().hex[:6]}"
            try:
                cursor.execute("""
                INSERT INTO evaluations (id, user_id, question, score, concept_accuracy, feedback, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (eval_id, user_id, question[:150], result["score"], result["concept_accuracy"], result["overall_feedback"], timestamp))
                conn.commit()
            except Exception as db_err:
                print(f"Error logging grading assessment to SQLite: {db_err}")
            finally:
                conn.close()

        # Check if there is a verified knowledge candidate explanation to store for teacher review
        if result.get("improved_explanation"):
            ke_id = f"ke_{uuid.uuid4().hex[:8]}"
            bk_id = book_id or "general"
            ch_num = chapter_number or 0
            student_ans = result.get("handwriting_ocr_text") or student_answer_text or ""
            
            # Fetch subject name (filename)
            subject_name = "General"
            if bk_id != "general":
                try:
                    meta_path = settings.DATA_DIR / f"{bk_id}_metadata.json"
                    if meta_path.exists():
                        with open(meta_path, "r") as f:
                            meta = json.load(f)
                            subject_name = meta.get("filename", "General")
                except Exception:
                    pass

            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                INSERT INTO knowledge_enhancements (
                    id, book_id, chapter_number, question, official_answer, student_answer, 
                    feedback, marks, similarity_score, concepts_missed, concepts_correct, 
                    improved_explanation, verification_status, confidence_score, subject, difficulty, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 'Medium', ?)
                """, (
                    ke_id,
                    bk_id,
                    ch_num,
                    question,
                    reference_answer,
                    student_ans,
                    result.get("overall_feedback") or "",
                    result.get("score") or 0,
                    result.get("similarity_score") or 0.0,
                    json.dumps(result.get("concepts_missed") or []),
                    json.dumps(result.get("concepts_correct") or []),
                    result.get("improved_explanation"),
                    result.get("confidence_score") or 0.0,
                    subject_name,
                    timestamp
                ))
                conn.commit()
            except Exception as ke_err:
                print(f"Error logging knowledge enhancement candidate: {ke_err}")
            finally:
                conn.close()
                
        return EvaluationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Answer evaluation failed: {str(e)}")
