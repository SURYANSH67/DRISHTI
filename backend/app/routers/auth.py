import uuid
import re
from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel, EmailStr
from app.database import get_db_connection, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str  # Student, Teacher, Administrator
    school: str
    department: str
    enrollment_number: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

@router.post("/register")
async def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    school: str = Form(...),
    department: str = Form(...),
    enrollment_number: str = Form("")
):
    """Register a new user account with role assignment."""
    # Email format validation
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        raise HTTPException(status_code=400, detail="Invalid email format.")
        
    # Password strength check
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    if role not in ["Student", "Teacher", "Administrator"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check duplicate account
    cursor.execute("SELECT id FROM users WHERE email = ?", (email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
        
    user_id = "usr_" + uuid.uuid4().hex[:8]
    pw_hash = hash_password(password)
    
    try:
        cursor.execute("""
        INSERT INTO users (id, name, email, password_hash, role, school, department, enrollment_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, name, email.lower(), pw_hash, role, school, department, enrollment_number))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database registration error: {str(e)}")
        
    conn.close()
    return {
        "status": "success",
        "user": {
            "id": user_id,
            "name": name,
            "email": email.lower(),
            "role": role,
            "school": school,
            "department": department,
            "enrollment_number": enrollment_number
        }
    }

@router.post("/login")
async def login(
    email: str = Form(...),
    password: str = Form(...)
):
    """Authenticate credentials and return user profile details."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT id, name, email, password_hash, role, school, department, enrollment_number 
    FROM users WHERE email = ?
    """, (email.lower(),))
    
    user = cursor.fetchone()
    conn.close()
    
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email address or password.")
        
    return {
        "status": "success",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "school": user["school"],
            "department": user["department"],
            "enrollment_number": user["enrollment_number"]
        }
    }
