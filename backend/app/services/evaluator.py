import os
import json
from typing import Dict, Any, Optional
from app.services.ai_service import ai_service
import fitz # PyMuPDF

class AnswerEvaluator:
    @staticmethod
    def evaluate(
        question: str, 
        reference_answer: str, 
        student_answer_text: Optional[str] = None, 
        student_answer_file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates a student's answer against a reference answer.
        Supports direct text input, PDF file uploads, or Image file uploads (for handwritten answers).
        """
        extracted_text = ""
        is_image = False
        
        # 1. Handle file upload (Image vs PDF)
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
            else:
                # Text/DOCX fallback (read raw text if possible, assuming txt)
                try:
                    with open(student_answer_file_path, "r", encoding="utf-8") as f:
                        extracted_text = f.read()
                except Exception as e:
                    print(f"Error reading student text file: {e}")

        # 2. Build AI prompts
        evaluation_prompt = f"""
Evaluate the student's answer to the question below. Compare it with the reference answer.

Question:
{question}

Reference Answer:
{reference_answer}

{f"Student Answer (Extracted text):" if not is_image else ""}
{extracted_text if not is_image else "The student's answer is uploaded as the attached image containing handwriting. Perform handwriting OCR and extract the answer text."}

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
