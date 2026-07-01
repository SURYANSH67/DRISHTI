import json
import os
import uuid
from typing import List
from fastapi import APIRouter, HTTPException
from app.config import settings
from app.schemas import (
    GenerateRequest, 
    GenerateResponse, 
    QuizGenerateRequest, 
    QuizResponse, 
    QuizQuestion, 
    QuestionPaperGenerateRequest, 
    QuestionPaperResponse
)
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store

router = APIRouter(prefix="/api/generator", tags=["generator"])

def load_book_metadata(book_id: str):
    meta_path = settings.DATA_DIR / f"{book_id}_metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book metadata not found")
    with open(meta_path, "r") as f:
        return json.load(f)

@router.post("/resource", response_model=GenerateResponse)
async def generate_resource(request: GenerateRequest):
    """
    Generate study resources (Notes, Summaries, Formulas, Diagrams) for a specific chapter.
    """
    metadata = load_book_metadata(request.book_id)
    
    # Locate chapter details
    chapter = None
    for idx, ch in enumerate(metadata["chapters"]):
        if idx + 1 == request.chapter_number:
            chapter = ch
            break
            
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {request.chapter_number} not found.")

    # Retrieve relevant text chunks for this chapter to feed the generator
    emb_query = ai_service.get_embedding(f"Chapter overview of {chapter['title']}")
    matches = vector_store.search(
        emb_query, 
        k=12, 
        filter_metadata={"book_id": request.book_id, "chapter_number": request.chapter_number}
    )
    
    context_text = "\n\n".join([m["text"] for m in matches])

    # Load and filter specific elements like formulas and images
    chapter_formulas = [f for f in metadata.get("formulas", []) if f["chapter_number"] == request.chapter_number]
    chapter_images = [img for img in metadata.get("images", []) if img["chapter_number"] == request.chapter_number]
    chapter_tables = [tbl for tbl in metadata.get("tables", []) if tbl["chapter_number"] == request.chapter_number]

    prompt = ""
    title = f"Chapter {request.chapter_number}: {chapter['title']}"

    if request.resource_type == "notes":
        title += " - Revision Notes"
        prompt = f"""
Generate comprehensive, teacher-grade revision notes for this chapter based on the textbook context below.

Chapter Title: {chapter['title']}

TEXTBOOK CONTEXT:
{context_text}

Formulas in this chapter:
{json.dumps(chapter_formulas, indent=2)}

Include the following sections in a clean, beautifully formatted Markdown file:
1. **Core Concept Overview**: Main themes of the chapter.
2. **Detailed Topic-wise Explanations**: Elaborated breakdown of main subtopics found in the text.
3. **Formulas and Equations**: Explain the equations found, define variables, and show key units.
4. **Key Definitions**: Glossary of technical terms.
5. **Solved Examples**: Explain the logic clearly.
6. **Study Tips**: Common student misconceptions or areas to focus on.
"""

    elif request.resource_type == "summary":
        title += " - Executive Summary & Flashcards"
        prompt = f"""
Generate a concise summary and flashcard deck for this chapter based on the textbook context below.

Chapter Title: {chapter['title']}

TEXTBOOK CONTEXT:
{context_text}

Generate:
1. **One-Line Summary**: A single sentence summarizing the entire chapter.
2. **Executive Summary**: 3 bulleted paragraphs outlining the key takeaways.
3. **Exam Summary**: Fast-paced revision pointers focusing on what's highly testable.
4. **Flashcards**: Provide exactly 8 Q&A style flashcards. Format them cleanly as Markdown cards:
   - **Front (Question)**: ...
   - **Back (Answer)**: ...
"""

    elif request.resource_type == "formulas":
        title += " - Formula Cheat-Sheet"
        formula_context = "\n".join([f"- {f['raw_text']} (Page {f['page_number']})" for f in chapter_formulas])
        prompt = f"""
Generate a mathematically rigorous formula cheat-sheet for this chapter.

Chapter Title: {chapter['title']}

Extracted Formulas in Chapter:
{formula_context}

For each formula, structure the output using clean Markdown containing:
1. **The Formula**: Format with LaTeX (e.g. \\( E = mc^2 \\) or \\[ F = ma \\]).
2. **Variable Dictionary**: Define every variable, symbol, and its SI units.
3. **Core Concept**: Explain the physics/math meaning behind the equation.
4. **Typical Numerical Context**: How is this formula used in exam questions? Give a mock calculation example with solution.
"""

    elif request.resource_type == "diagrams":
        title += " - Visual Diagram Handbook"
        image_context = "\n".join([f"- Figure on Page {img['page_number']}: Surrounding text: {img['surrounding_text']}" for img in chapter_images])
        prompt = f"""
Generate a detailed visual diagram guide and workbook for this chapter.

Chapter Title: {chapter['title']}

Extracted Figures/Images:
{image_context}

Format the output as a Markdown guide detailing:
1. **List of Diagrams & Figures**: Walk through each figure.
2. **Visual Explanation**: Describe what is represented (e.g. human heart cross-section, electric circuit layout, architecture flowchart). Explain how to draw or interpret it.
3. **Related Formula Integration**: Link any diagram elements to formulas (e.g., matching a circuit diagram to Ohm's Law).
4. **Practice Questions**: 3 diagram-labelling or explanatory drawing exercises for study preparation.
"""
    else:
        raise HTTPException(status_code=400, detail="Invalid resource type specified.")

    messages = [
        {"role": "system", "content": "You are a professional educational content developer. You convert raw textbook context into clear, helpful, and beautifully formatted study resources in Markdown."},
        {"role": "user", "content": prompt}
    ]
    
    content = ai_service.chat_completion(messages, temperature=0.3)
    
    return GenerateResponse(
        title=title,
        content=content,
        metadata={
            "book_id": request.book_id,
            "chapter_number": request.chapter_number,
            "resource_type": request.resource_type,
            "formulas_count": len(chapter_formulas),
            "images_count": len(chapter_images),
            "tables_count": len(chapter_tables)
        }
    )

@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizGenerateRequest):
    """
    Generate a dynamic, adaptive quiz of customizable difficulty and type from a specific chapter.
    """
    metadata = load_book_metadata(request.book_id)
    
    # Locate chapter details
    chapter = None
    for idx, ch in enumerate(metadata["chapters"]):
        if idx + 1 == request.chapter_number:
            chapter = ch
            break
            
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {request.chapter_number} not found.")

    # Fetch context
    emb_query = ai_service.get_embedding(f"Key technical concepts, problems and questions in chapter {chapter['title']}")
    matches = vector_store.search(
        emb_query, 
        k=10, 
        filter_metadata={"book_id": request.book_id, "chapter_number": request.chapter_number}
    )
    context_text = "\n\n".join([m["text"] for m in matches])

    quiz_prompt = f"""
Create a highly professional quiz based on the textbook chapter context.

Chapter Title: {chapter['title']}
Difficulty Level: {request.difficulty}
Total Questions: {request.question_count}
Question Types to Include: {', '.join(request.question_types)}

TEXTBOOK CONTEXT:
{context_text}

For each question:
- Make sure the question is directly based on the context.
- MCQs must have exactly 4 choices (labeled Option A, Option B, etc.).
- Numerical questions should include values and units from the chapter.
- HOTS (Higher Order Thinking Skills) questions should test deep concept synthesis based on Bloom's Taxonomy.
- Provide the detailed reference answer and specify the exact subtopic.

You MUST return your response as a valid JSON object matching this structure EXACTLY:
{{
  "questions": [
    {{
      "id": "q_1",
      "text": "Question text here...",
      "type": "MCQ", // one of MCQ, Numerical, HOTS, Short Answer
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"], // only populated if MCQ, otherwise empty list/null
      "reference_answer": "Detailed solution or correct option",
      "page_number": {chapter["start_page"]}, // Estimate page number based on context or chapter start page
      "topic": "Subtopic name"
    }}
  ]
}}
"""

    messages = [
        {"role": "system", "content": "You are an academic test maker. You design rigorous assessments (MCQs, numericals, HOTS) and output valid, structured JSON."},
        {"role": "user", "content": quiz_prompt}
    ]
    
    try:
        raw_response = ai_service.chat_completion(messages, temperature=0.5, response_format={"type": "json_object"})
        
        # Clean markdown formatting if any
        cleaned = raw_response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        quiz_data = json.loads(cleaned)
        
        # Parse into response schema
        questions_list = []
        for idx, q in enumerate(quiz_data.get("questions", [])):
            questions_list.append(
                QuizQuestion(
                    id=f"q_{idx+1}_{uuid.uuid4().hex[:4]}",
                    text=q.get("text", "Question missing"),
                    type=q.get("type", "Short Answer"),
                    options=q.get("options") if q.get("type") == "MCQ" else None,
                    reference_answer=q.get("reference_answer", ""),
                    page_number=q.get("page_number", chapter["start_page"]),
                    topic=q.get("topic", "General")
                )
            )
            
        return QuizResponse(
            book_id=request.book_id,
            chapter_number=request.chapter_number,
            questions=questions_list
        )
    except Exception as e:
        print(f"Error generating quiz: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate structured quiz: {str(e)}")

@router.post("/paper", response_model=QuestionPaperResponse)
async def generate_question_paper(request: QuestionPaperGenerateRequest):
    """
    Generate a professional question paper for teachers matching university/school patterns,
    distribution maps, and visual/answer-key options.
    """
    metadata = load_book_metadata(request.book_id)
    
    chapter = None
    for idx, ch in enumerate(metadata["chapters"]):
        if idx + 1 == request.chapter_number:
            chapter = ch
            break
            
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {request.chapter_number} not found.")

    # Search textbook context
    emb_query = ai_service.get_embedding(f"Exam questions, numericals, conceptual theories, exercises in {chapter['title']}")
    matches = vector_store.search(
        emb_query, 
        k=15, 
        filter_metadata={"book_id": request.book_id, "chapter_number": request.chapter_number}
    )
    context_text = "\n\n".join([m["text"] for m in matches])

    # Formulate question distribution prompt instructions
    distribution_details = ""
    if request.auto_distribute:
        distribution_details = "Automatically determine the best question distribution based on the total marks and chapter coverage."
    elif request.custom_distribution:
        dist_items = [f"- {k}: {v} questions" for k, v in request.custom_distribution.items() if v > 0]
        distribution_details = "Adhere STRICTLY to this custom question count distribution:\n" + "\n".join(dist_items)

    ai_options_prompt = ""
    if request.ai_options:
        opt_items = [f"- {opt}" for opt in request.ai_options]
        ai_options_prompt = "Apply these pedagogical options:\n" + "\n".join(opt_items)

    paper_prompt = f"""
Create a highly professional academic Question Paper based on the textbook context provided below.

Chapter Title: {chapter['title']}
Exam Type: {request.exam_type}
Pattern Style: {request.pattern}
Total Marks: {request.total_marks} Marks
Duration: {request.duration_hours} Hours
Difficulty Level: {request.difficulty}
Question Types allowed: {', '.join(request.question_types)}

DISTRIBUTION DETAILS:
{distribution_details}

PEDAGOGICAL OPTIONS:
{ai_options_prompt}

TEXTBOOK CONTEXT:
{context_text}

---

INSTRUCTIONS:
1. Generate a beautifully structured question paper. Use clear sections (e.g. Section A: MCQs, Section B: Short Answers, Section C: Long Answers, Section D: Numerical Problems/HOTS).
2. For each question, display marks clearly in brackets (e.g., "[2 Marks]" or "[5 Marks]").
3. All questions must align directly with academic topics in the context.
4. If "Generate Answer Key" is selected in options, generate a distinct, clear Answer Key at the very bottom of the document.
5. If "Generate Detailed Solutions" is selected, provide step-by-step math derivations, reasoning, or diagrams descriptions.
6. If "Generate Marking Scheme" is selected, outline point-by-point marks breakdown (e.g. "1 mark for formula, 2 marks for substitution, 1 mark for calculation").
7. Ensure all headings and sections are outputted as clean, readable Markdown. Do not include markdown code block blocks around the output.

Format the header exactly like this:
# {request.exam_type.upper()} EXAMINATION
**Subject**: {metadata.get("filename", "Defence Studies")}
**Chapter**: {chapter['title']}
**Total Marks**: {request.total_marks} | **Duration**: {request.duration_hours} Hours
**Difficulty**: {request.difficulty} | **Pattern**: {request.pattern}

---
"""

    messages = [
        {"role": "system", "content": "You are a senior university professor and exam board setter. You build rigorous, professional question papers with clean section distributions and exact answer keys."},
        {"role": "user", "content": paper_prompt}
    ]

    try:
        content = ai_service.chat_completion(messages, temperature=0.4)
        title = f"{request.exam_type} - Chapter {request.chapter_number} Question Paper ({request.total_marks} Marks)"
        
        return QuestionPaperResponse(
            title=title,
            content=content,
            metadata={
                "book_id": request.book_id,
                "chapter_number": request.chapter_number,
                "exam_type": request.exam_type,
                "pattern": request.pattern,
                "total_marks": request.total_marks,
                "duration_hours": request.duration_hours,
                "difficulty": request.difficulty,
                "question_types": request.question_types,
                "ai_options": request.ai_options or []
            }
        )
    except Exception as e:
        print(f"Error generating question paper: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate question paper: {str(e)}")
