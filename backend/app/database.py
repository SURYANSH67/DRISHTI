import sqlite3
import os
import hashlib
import uuid
from typing import Dict, Any, List, Optional
from pathlib import Path

DB_FILE = Path(__file__).resolve().parent.parent / "data" / "drishti.db"
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    """Create all required tables for the DRISHTI if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL, -- Student, Teacher, Administrator
        school TEXT,
        department TEXT,
        enrollment_number TEXT,
        profile_pic TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Books table (with uploaded_by and approved status)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS books (
        book_id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        subject_name TEXT DEFAULT '',
        total_pages INTEGER NOT NULL,
        image_count INTEGER NOT NULL,
        formula_count INTEGER NOT NULL,
        table_count INTEGER NOT NULL,
        uploaded_by TEXT,
        approved INTEGER DEFAULT 0, -- 0 = Pending, 1 = Approved
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 3. Quiz attempts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 4. Evaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question TEXT NOT NULL,
        score INTEGER NOT NULL,
        concept_accuracy TEXT NOT NULL,
        feedback TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 5. API logs table (for auditing AI usage)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS api_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        endpoint TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 6. Knowledge enhancements table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_enhancements (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        question TEXT NOT NULL,
        official_answer TEXT NOT NULL,
        student_answer TEXT NOT NULL,
        feedback TEXT NOT NULL,
        marks INTEGER NOT NULL,
        similarity_score REAL NOT NULL,
        concepts_missed TEXT NOT NULL,
        concepts_correct TEXT NOT NULL,
        improved_explanation TEXT,
        verification_status TEXT DEFAULT 'Pending',
        confidence_score REAL DEFAULT 0.0,
        subject TEXT,
        difficulty TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 7. Question papers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS question_papers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        google_form_url TEXT,
        student_content TEXT,
        answer_key TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)
    try:
        cursor.execute("ALTER TABLE question_papers ADD COLUMN student_content TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists
    try:
        cursor.execute("ALTER TABLE question_papers ADD COLUMN answer_key TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists

    # 8. Google Form Responses and AI Grading Evaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS form_responses (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        submission_time TEXT NOT NULL,
        overall_percentage REAL NOT NULL,
        marks_obtained INTEGER NOT NULL,
        total_marks INTEGER NOT NULL,
        ai_feedback TEXT,
        question_analysis TEXT NOT NULL,
        FOREIGN KEY(paper_id) REFERENCES question_papers(id)
    )
    """)
    
    # Insert default Administrator if not exists
    cursor.execute("SELECT id FROM users WHERE role = 'Administrator'")
    admin = cursor.fetchone()
    if not admin:
        admin_id = "usr_" + uuid.uuid4().hex[:8]
        admin_pass_hash = hash_password("admin123")
        cursor.execute("""
        INSERT INTO users (id, name, email, password_hash, role, school, department)
        VALUES (?, 'DRISHTI Admin', 'admin@drishti.org', ?, 'Administrator', 'DRDO', 'HQ')
        """, (admin_id, admin_pass_hash))
        print("Inserted default administrator: admin@drishti.org / admin123")

    conn.commit()
    conn.close()

# Password Hashing Helpers using PBKDF2
def hash_password(password: str) -> str:
    """Hash password using PBKDF2 SHA256."""
    salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode('utf-8'), 
        salt, 
        100000
    )
    return salt.hex() + ":" + pw_hash.hex()

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password matches hashed password."""
    try:
        salt_hex, hash_hex = hashed_password.split(":")
        salt = bytes.fromhex(salt_hex)
        pw_hash = hashlib.pbkdf2_hmac(
            'sha256', 
            password.encode('utf-8'), 
            salt, 
            100000
        )
        return pw_hash.hex() == hash_hex
    except Exception:
        return False
