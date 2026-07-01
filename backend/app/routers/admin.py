import os
from fastapi import APIRouter, HTTPException, Form, Query
from app.database import get_db_connection, DB_FILE

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users")
async def list_users():
    """List all registered user accounts (excluding passwords)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, name, email, role, school, department, enrollment_number, created_at 
    FROM users ORDER BY created_at DESC
    """)
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a user account."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"User {user_id} deleted."}

@router.post("/users/role")
async def update_user_role(
    user_id: str = Form(...),
    role: str = Form(...)
):
    """Update a user's role (Student, Teacher, Administrator)."""
    if role not in ["Student", "Teacher", "Administrator"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"User role updated to {role}."}

@router.post("/books/approve/{book_id}")
async def approve_book(book_id: str, approved: int = Form(...)):
    """Approve or reject an uploaded book."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE books SET approved = ? WHERE book_id = ?", (approved, book_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Book approval status set to {approved}."}

@router.get("/system/logs")
async def get_system_logs(limit: int = 100):
    """Retrieve system usage logs for audit checks."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, user_id, endpoint, timestamp 
    FROM api_logs ORDER BY timestamp DESC LIMIT ?
    """, (limit,))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

@router.get("/system/health")
async def get_system_health():
    """Retrieve system health metrics (database size, book statistics, user stats)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # User counts
    cursor.execute("SELECT COUNT(id) FROM users")
    total_users = cursor.fetchone()[0]
    
    # Book counts
    cursor.execute("SELECT COUNT(book_id) FROM books")
    total_books = cursor.fetchone()[0]
    
    # Approved counts
    cursor.execute("SELECT COUNT(book_id) FROM books WHERE approved = 1")
    approved_books = cursor.fetchone()[0]
    
    # Quiz attempts
    cursor.execute("SELECT COUNT(id) FROM quiz_attempts")
    total_quizzes = cursor.fetchone()[0]
    
    # Database size
    db_size_bytes = 0
    if os.path.exists(DB_FILE):
        db_size_bytes = os.path.getsize(DB_FILE)
        
    conn.close()
    
    return {
        "db_size_kb": round(db_size_bytes / 1024, 2),
        "total_users": total_users,
        "total_books": total_books,
        "approved_books": approved_books,
        "pending_books": total_books - approved_books,
        "total_quizzes_taken": total_quizzes,
        "system_status": "Healthy",
        "storage_path": str(DB_FILE)
    }

@router.get("/knowledge/candidates")
async def list_knowledge_candidates(status: str = Query("Pending")):
    """List all student-derived explanation candidates of a specific status."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, book_id, chapter_number, question, official_answer, student_answer, 
           feedback, marks, similarity_score, concepts_missed, concepts_correct, 
           improved_explanation, verification_status, confidence_score, subject, difficulty, timestamp
    FROM knowledge_enhancements 
    WHERE verification_status = ? 
    ORDER BY timestamp DESC
    """, (status,))
    candidates = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return candidates

@router.post("/knowledge/verify/{candidate_id}")
async def verify_knowledge_candidate(candidate_id: str, status: str = Form(...)):
    """Approve or reject a student-derived explanation candidate."""
    if status not in ["Approved", "Rejected", "Pending"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'Approved', 'Rejected', or 'Pending'.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE knowledge_enhancements 
    SET verification_status = ? 
    WHERE id = ?
    """, (status, candidate_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Candidate {candidate_id} status updated to {status}."}
