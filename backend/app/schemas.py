from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Book schemas
class BookOverview(BaseModel):
    book_id: str
    filename: str
    subject_name: str = ""
    total_pages: int
    chapters: List[Dict[str, Any]]
    image_count: int
    formula_count: int
    table_count: int
    uploaded_by: str = ""
    approved: int = 0

# Chat schemas
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    book_id: str
    chapter_number: Optional[int] = None
    message: str
    history: Optional[List[ChatMessage]] = []

class ContextSource(BaseModel):
    text: str
    page_number: int
    chapter_title: str
    chapter_number: int
    type: str  # text, formula, table, diagram

class ChatResponse(BaseModel):
    answer: str
    sources: List[ContextSource]

# Generator schemas
class GenerateRequest(BaseModel):
    book_id: str
    chapter_number: int
    resource_type: str  # notes, summary, formulas, diagrams

class GenerateResponse(BaseModel):
    title: str
    content: str  # Markdown text
    metadata: Dict[str, Any]

# Quiz schemas
class QuizGenerateRequest(BaseModel):
    book_id: str
    chapter_number: int
    question_count: int = 10
    difficulty: str = "Medium"  # Easy, Medium, Hard
    question_types: List[str] = ["MCQ", "Numerical", "HOTS", "Short Answer"]

class QuizQuestion(BaseModel):
    id: str
    text: str
    type: str  # MCQ, Numerical, HOTS, Short Answer
    options: Optional[List[str]] = None  # populated if MCQ
    reference_answer: str
    page_number: int
    topic: str

class QuizResponse(BaseModel):
    book_id: str
    chapter_number: int
    questions: List[QuizQuestion]

# Evaluation schemas
class EvaluationRequest(BaseModel):
    question: str
    reference_answer: str
    student_answer_text: Optional[str] = None

class EvaluationResponse(BaseModel):
    handwriting_ocr_text: Optional[str] = None
    score: int
    concept_accuracy: str
    missing_elements: List[str]
    mistakes: List[str]
    suggestions: str
    overall_feedback: str
    concepts_correct: Optional[List[str]] = None
    concepts_missed: Optional[List[str]] = None
    similarity_score: Optional[float] = None
    improved_explanation: Optional[str] = None
    confidence_score: Optional[float] = None

# Question Paper schemas
class QuestionPaperGenerateRequest(BaseModel):
    book_id: str
    chapter_number: int
    exam_type: str
    pattern: str
    total_marks: int
    duration_hours: float
    difficulty: str
    question_types: List[str]
    auto_distribute: bool = True
    custom_distribution: Optional[Dict[str, int]] = None
    ai_options: Optional[List[str]] = None

class QuestionPaperResponse(BaseModel):
    id: str
    title: str
    content: str
    metadata: Dict[str, Any]
