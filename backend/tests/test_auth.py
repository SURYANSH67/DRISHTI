import pytest
from app.database import get_db_connection, setup_database, hash_password, verify_password

def test_database_and_password_auth():
    # 1. Setup database structures (creates tables in drishti.db)
    setup_database()
    
    # 2. Test password hashing
    pw = "drishtiPass789"
    pw_hash = hash_password(pw)
    
    assert pw_hash != pw
    assert verify_password(pw, pw_hash) == True
    assert verify_password("wrongPass", pw_hash) == False

    # 3. Test user creation query
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Clean previous test entries
    cursor.execute("DELETE FROM users WHERE email = 'test_user@drishti.org'")
    
    # Insert test user
    test_id = "usr_test_123"
    cursor.execute("""
    INSERT INTO users (id, name, email, password_hash, role, school, department)
    VALUES (?, 'Test Student', 'test_user@drishti.org', ?, 'Student', 'Test School', 'CS')
    """, (test_id, pw_hash))
    conn.commit()
    
    # Verify retrieval
    cursor.execute("SELECT name, role FROM users WHERE email = 'test_user@drishti.org'")
    user = cursor.fetchone()
    assert user is not None
    assert user["name"] == "Test Student"
    assert user["role"] == "Student"
    
    # Cleanup test entry
    cursor.execute("DELETE FROM users WHERE email = 'test_user@drishti.org'")
    conn.commit()
    conn.close()
