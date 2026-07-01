from app.services.pdf_parser import PDFParser

def test_math_formula_heuristic():
    # Valid formulas
    assert PDFParser._is_math_formula("E = mc^2") == True
    assert PDFParser._is_math_formula("F = ma") == True
    assert PDFParser._is_math_formula("PV = nRT") == True
    assert PDFParser._is_math_formula("a^2 + b^2 = c^2") == True
    assert PDFParser._is_math_formula("I = V / R") == True
    
    # Regular sentences (invalid formulas)
    assert PDFParser._is_math_formula("This is a physics textbook explanation of general relativity.") == False
    assert PDFParser._is_math_formula("Chapter 3: Electric Currents and Circuit Design rules.") == False
    assert PDFParser._is_math_formula("A table of contents lists chapters.") == False
