import os
import json
from typing import Dict, Any, Optional
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store
import fitz # PyMuPDF

class AnswerEvaluator:
    @staticmethod
    def evaluate(
        question: Optional[str] = None, 
        reference_answer: Optional[str] = None, 
        student_answer_text: Optional[str] = None, 
        student_answer_file_path: Optional[str] = None,
        book_id: Optional[str] = None,
        chapter_number: Optional[int] = None,
        question_paper_file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates a student's answer sheet.
        Supports standard grading, auto-grading via textbook search, or auto-grading via uploaded question paper.
        """
        extracted_text = ""
        is_image = False
        
        # 1. Handle student answer sheet file upload (Image vs PDF)
        if student_answer_file_path:
            ext = os.path.splitext(student_answer_file_path)[1].lower()
            if ext in [".pdf"]:
                # Extract text from PDF
                try:
                    doc = fitz.open(student_answer_file_path)
                    extracted_text = " ".join([page.get_text("text") for page in doc])
                    doc.close()
                except Exception as e:
                    print(f"Error reading student PDF answer: {e}")
                    extracted_text = "[Failed to parse PDF content]"
            elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
                is_image = True
                # Perform OCR on the image to get text for RAG retrieval
                try:
                    extracted_text = ai_service.analyze_image(
                        student_answer_file_path,
                        "Perform raw handwriting OCR on this student's response. Return only the extracted text exactly as written, with no explanations, formatting or notes."
                    )
                except Exception as e:
                    print(f"OCR image preprocessing failed: {e}")
                    extracted_text = "[Failed to run OCR on student handwriting]"
            else:
                # Text/DOCX fallback
                try:
                    with open(student_answer_file_path, "r", encoding="utf-8") as f:
                        extracted_text = f.read()
                except Exception as e:
                    print(f"Error reading student text file: {e}")

        # 2. Handle Question Paper file upload if provided
        question_paper_text = ""
        if question_paper_file_path:
            qp_ext = os.path.splitext(question_paper_file_path)[1].lower()
            if qp_ext in [".pdf"]:
                try:
                    doc = fitz.open(question_paper_file_path)
                    question_paper_text = " ".join([page.get_text("text") for page in doc])
                    doc.close()
                except Exception as e:
                    print(f"Error reading question paper PDF: {e}")
            elif qp_ext in [".png", ".jpg", ".jpeg", ".webp"]:
                try:
                    question_paper_text = ai_service.analyze_image(
                        question_paper_file_path,
                        "Perform OCR on this question paper. Extract and list all questions clearly. Do not answer them."
                    )
                except Exception as e:
                    print(f"Error reading question paper image: {e}")

        # Set up auto-detect or RAG retrieval based on inputs
        if question_paper_text:
            # Overwrite question to use the extracted question paper
            question = f"Questions from uploaded Question Paper:\n{question_paper_text}"
            
            # Retrieve model answers for the questions from the textbook
            if book_id:
                try:
                    # Query textbook with a combination of the question paper topics and student answer concepts
                    combined_query = (question_paper_text[:500] + "\n\n" + (extracted_text or student_answer_text or "")[:500]).strip()
                    emb_query = ai_service.get_embedding(combined_query[:800])
                    meta_filter = {"book_id": book_id}
                    if chapter_number and chapter_number > 0:
                        meta_filter["chapter_number"] = chapter_number
                    
                    matches = vector_store.search(emb_query, k=6, filter_metadata=meta_filter)
                    if matches:
                        reference_answer = "\n\n".join([m["text"] for m in matches])
                    else:
                        reference_answer = "[No matching textbook content found in database.]"
                except Exception as e:
                    print(f"Error retrieving textbook context for question paper: {e}")
                    reference_answer = "[Failed to retrieve textbook context from database.]"
            else:
                reference_answer = "[No textbook active for grading syllabus context.]"

        elif not question or not question.strip() or question.strip().lower() == "auto-detected":
            # Auto-detect questions mode (no prompt, no question paper)
            question = "Auto-Detected Questions from uploaded answer sheet"
            query_text = (extracted_text or student_answer_text or "").strip()
            
            # Query vector store with concepts from student answer text
            if query_text:
                try:
                    emb_query = ai_service.get_embedding(query_text[:800])
                    meta_filter = {"book_id": book_id} if book_id else {}
                    if chapter_number and chapter_number > 0:
                        meta_filter["chapter_number"] = chapter_number
                    
                    matches = vector_store.search(emb_query, k=6, filter_metadata=meta_filter)
                    if matches:
                        reference_answer = "\n\n".join([m["text"] for m in matches])
                    else:
                        reference_answer = "[No relevant textbook context found for the concepts in the student answer sheet.]"
                except Exception as e:
                    print(f"Error doing RAG auto-detect textbook search: {e}")
                    reference_answer = "[Failed to retrieve textbook context from database.]"
            else:
                reference_answer = "[No student text or answers found in submission to query textbook syllabus.]"
        
        elif not reference_answer or not reference_answer.strip():
            # Question prompt is typed, but reference answer is missing. Retrieve it using the question prompt
            if book_id:
                try:
                    emb_query = ai_service.get_embedding(question)
                    meta_filter = {"book_id": book_id}
                    if chapter_number and chapter_number > 0:
                        meta_filter["chapter_number"] = chapter_number
                    
                    matches = vector_store.search(emb_query, k=5, filter_metadata=meta_filter)
                    if matches:
                        reference_answer = "\n\n".join([m["text"] for m in matches])
                    else:
                        reference_answer = "[No matching textbook content found in database.]"
                except Exception as e:
                    print(f"Error retrieving textbook context for question: {e}")
                    reference_answer = "[Failed to retrieve textbook context from database.]"
            else:
                reference_answer = "[No reference answer key or textbook syllabus context was provided.]"

        # 3. Build AI prompts based on whether we are grading a specific question paper
        is_auto_detect = not question_paper_text and (not question or question.strip() == "Auto-Detected Questions from uploaded answer sheet")
        
        if question_paper_text:
            evaluation_prompt = f"""
You are an expert academic evaluator. The teacher has uploaded a Question Paper and the student's answer sheet.
We want to grade the student's answers to the questions listed in the Question Paper against their textbook.

Question Paper Text:
---
{question_paper_text}
---

Student's Answer Text (Handwritten/Typed):
---
{extracted_text or student_answer_text or "[Empty student submission]"}
---

And we have retrieved the matching reference sections from their textbook:
---
{reference_answer}
---

Evaluate the student's submission by doing the following:
1. Extract and map each question from the Question Paper to the student's corresponding answer.
2. Grade the student's answer to each question out of 10 based on technical correctness, completeness, and accuracy against the textbook reference.
3. Combine these individual scores into a single overall score out of 10 for the entire sheet.
4. List all missing elements (critical keywords, equations, formulas) they should have included.
5. List specific mistakes or misconceptions found in their answers.
6. Provide actionable suggestions pointing to textbook concepts/sections they should review.
7. Pedagogical insights:
   - List key concepts they successfully answered (`concepts_correct`).
   - List key concepts they missed or got wrong (`concepts_missed`).
   - Calculate a similarity score (0.0 to 1.0) between their answers and reference.

You MUST return your response as a valid JSON object matching this structure EXACTLY:
{{
  "handwriting_ocr_text": "extracted text",
  "score": 8, // Integer out of 10
  "concept_accuracy": "brief description (e.g. High, Medium, Low)",
  "missing_elements": ["list of missing keywords, formulas, or diagrams"],
  "mistakes": ["list of errors, math mistakes, or misconceptions found"],
  "suggestions": "actionable feedback telling them exactly what textbook topics, sections, or formulas they missed and how to fix it",
  "overall_feedback": "encouraging general summary of performance",
  "concepts_correct": ["list of correct concepts"],
  "concepts_missed": ["list of missed concepts"],
  "similarity_score": 0.8,
  "improved_explanation": null,
  "confidence_score": 0.0
}}
"""
        elif is_auto_detect:
            evaluation_prompt = f"""
You are an expert academic evaluator. The student has uploaded a handwritten answer sheet, and we want to grade it against their textbook.
We have extracted the student's handwritten answer text:
---
{extracted_text or student_answer_text or "[Empty student submission]"}
---

And we have retrieved the matching reference sections from their textbook:
---
{reference_answer}
---

Evaluate the student's submission by doing the following:
1. Identify all individual questions/topics/problems the student has written answers for in their text.
2. Grade the student's answer to each of these topics out of 10 based on technical correctness, completeness, and accuracy against the textbook reference.
3. Combine these individual scores into a single overall score out of 10 for the entire sheet.
4. List all missing elements (critical keywords, equations, formulas) they should have included.
5. List specific mistakes or misconceptions found in their answers.
6. Provide actionable suggestions pointing to textbook concepts/sections they should review.
7. Pedagogical insights:
   - List key concepts they successfully answered (`concepts_correct`).
   - List key concepts they missed or got wrong (`concepts_missed`).
   - Calculate a similarity score (0.0 to 1.0) between their answers and reference.

You MUST return your response as a valid JSON object matching this structure EXACTLY:
{{
  "handwriting_ocr_text": "extracted text",
  "score": 8, // Integer out of 10
  "concept_accuracy": "brief description (e.g. High, Medium, Low)",
  "missing_elements": ["list of missing keywords, formulas, or diagrams"],
  "mistakes": ["list of errors, math mistakes, or misconceptions found"],
  "suggestions": "actionable feedback telling them exactly what textbook topics, sections, or formulas they missed and how to fix it",
  "overall_feedback": "encouraging general summary of performance",
  "concepts_correct": ["list of correct concepts"],
  "concepts_missed": ["list of missed concepts"],
  "similarity_score": 0.8,
  "improved_explanation": null,
  "confidence_score": 0.0
}}
"""
        else:
            evaluation_prompt = f"""
Evaluate the student's answer to the question below. Compare it with the reference answer.

Question:
{question}

Reference Answer:
{reference_answer}

{f"Student Answer (Extracted text):" if not is_image else ""}
{extracted_text or student_answer_text or "The student's answer is uploaded as the attached image containing handwriting. Perform handwriting OCR and extract the answer text."}

Evaluate the response strictly based on the following:
1. Marks: Award a score out of 10.
2. Concept Accuracy: Is the fundamental concept explained correctly?
3. Missing Keywords/Formulas/Diagram references: Check if they missed any critical keywords, equations, or figures that exist in the reference answer.
4. Specific Mistakes: List exact errors, misconceptions, or calculations they got wrong.
5. Actionable Suggestions: Clear page references or explanations of what they should read or revise.
6. Pedagogical Insights:
   - Identify which key concepts the student got correct (`concepts_correct`).
   - Identify which key concepts they missed (`concepts_missed`).
   - Calculate a `similarity_score` between 0.0 and 1.0 comparing technical correctness.
7. Continuous Knowledge Enhancement Check:
   - Analyze if the student's answer contains: a clearer analogy, a valid alternative solution/proof, a better presentation, or an additional verified example.
   - If it contains a valuable addition that is factually correct and improves explanation quality, generate an `improved_explanation` that merges the reference answer with the student's addition.
   - If there is no improvement or the answer is incorrect/incomplete, set `improved_explanation` to null.
   - Assign a `confidence_score` between 0.0 and 1.0 reflecting the validity of the improvement.

You MUST return your response as a valid JSON object matching this structure EXACTLY:
{{
  "handwriting_ocr_text": "text extracted from image or empty string if text input was used",
  "score": 8, // Integer out of 10
  "concept_accuracy": "brief description (e.g. High, Medium, Low)",
  "missing_elements": ["list of missing keywords, formulas, or diagrams"],
  "mistakes": ["list of errors, math mistakes, or misconceptions found"],
  "suggestions": "actionable feedback telling them exactly what page, diagram, or formula they missed and how to fix it",
  "overall_feedback": "encouraging general summary of performance",
  "concepts_correct": ["list of correct concepts"],
  "concepts_missed": ["list of missed concepts"],
  "similarity_score": 0.8,
  "improved_explanation": "Improved version incorporating the student's clear analogy/explanation or null if no improvement",
  "confidence_score": 0.85
}}
"""

        try:
            if is_image and student_answer_file_path:
                # Use Multimodal image analysis
                raw_response = ai_service.analyze_image(student_answer_file_path, evaluation_prompt)
            else:
                # Standard chat completion
                messages = [
                    {"role": "system", "content": "You are an expert academic evaluator. You assess student answers objectively, precisely, and return structured JSON."},
                    {"role": "user", "content": evaluation_prompt}
                ]
                raw_response = ai_service.chat_completion(messages, temperature=0.1, response_format={"type": "json_object"})

            # Clean JSON formatting block markers if LLM vision returns it wrapped in ```json ... ```
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            parsed = json.loads(cleaned)
            # Ensure all keys are populated
            if "concepts_correct" not in parsed:
                parsed["concepts_correct"] = []
            if "concepts_missed" not in parsed:
                parsed["concepts_missed"] = []
            if "similarity_score" not in parsed:
                parsed["similarity_score"] = 0.0
            if "improved_explanation" not in parsed:
                parsed["improved_explanation"] = None
            if "confidence_score" not in parsed:
                parsed["confidence_score"] = 0.0
            if is_image and ("handwriting_ocr_text" not in parsed or not parsed["handwriting_ocr_text"] or parsed["handwriting_ocr_text"] == "extracted text"):
                parsed["handwriting_ocr_text"] = extracted_text
            elif is_auto_detect and ("handwriting_ocr_text" not in parsed or not parsed["handwriting_ocr_text"] or parsed["handwriting_ocr_text"] == "extracted text"):
                parsed["handwriting_ocr_text"] = extracted_text
            elif question_paper_text and ("handwriting_ocr_text" not in parsed or not parsed["handwriting_ocr_text"] or parsed["handwriting_ocr_text"] == "extracted text"):
                parsed["handwriting_ocr_text"] = extracted_text

            return parsed
        except Exception as e:
            print(f"Error in answer evaluation pipeline: {e}")
            return {
                "handwriting_ocr_text": extracted_text or "",
                "score": 0,
                "concept_accuracy": "Unresolved",
                "missing_elements": ["Error during evaluation pipeline"],
                "mistakes": [str(e)],
                "suggestions": "Please resubmit your answer.",
                "overall_feedback": "The grading pipeline encountered an error processing your submission.",
                "concepts_correct": [],
                "concepts_missed": [],
                "similarity_score": 0.0,
                "improved_explanation": None,
                "confidence_score": 0.0
            }

evaluator = AnswerEvaluator()
