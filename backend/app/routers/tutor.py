from fastapi import APIRouter, HTTPException
from app.schemas import ChatRequest, ChatResponse, ContextSource
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store

router = APIRouter(prefix="/api/tutor", tags=["tutor"])

@router.post("/chat", response_model=ChatResponse)
async def tutor_chat(request: ChatRequest):
    """
    Intelligent chatbot that retrieves textbook context filtered by book and optionally chapter.
    Generates answers grounded strictly in the retrieved context.
    """
    # 1. Embed query
    query_emb = ai_service.get_embedding(request.message)
    
    # 2. Build metadata filter
    meta_filter = {"book_id": request.book_id}
    if request.chapter_number is not None:
        meta_filter["chapter_number"] = request.chapter_number
        
    # 3. Retrieve relevant chunks
    matches = vector_store.search(query_emb, k=5, filter_metadata=meta_filter)
    
    if not matches:
        # Fallback to general search without chapter filter if nothing found in specific chapter
        if request.chapter_number is not None:
            matches = vector_store.search(query_emb, k=3, filter_metadata={"book_id": request.book_id})
            
    # 3.5 Retrieve verified knowledge enhancements (Continuous Knowledge Enhancement Strategy)
    from app.database import get_db_connection
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.chapter_number is not None:
        cursor.execute("""
        SELECT question, official_answer, student_answer, improved_explanation, confidence_score
        FROM knowledge_enhancements
        WHERE book_id = ? AND chapter_number = ? AND verification_status = 'Approved'
        """, (request.book_id, request.chapter_number))
    else:
        cursor.execute("""
        SELECT question, official_answer, student_answer, improved_explanation, confidence_score
        FROM knowledge_enhancements
        WHERE book_id = ? AND verification_status = 'Approved'
        """, (request.book_id,))
        
    enhancement_rows = cursor.fetchall()
    conn.close()
    
    enhancements_str = ""
    if enhancement_rows:
        enhancement_list = []
        for row in enhancement_rows:
            enhancement_list.append(
                f"--- VERIFIED KNOWLEDGE OPTIMIZATION ---\n"
                f"Question: {row['question']}\n"
                f"Original Reference Answer: {row['official_answer']}\n"
                f"Verified Improved Analogy/Explanation: {row['improved_explanation']}\n"
                f"Confidence Score: {row['confidence_score']}"
            )
        enhancements_str = "\n\n".join(enhancement_list)

    # 4. Construct context summary and source references
    context_chunks = []
    sources = []
    
    for match in matches:
        meta = match["metadata"]
        context_chunks.append(
            f"[Source: Chapter {meta.get('chapter_number')}: {meta.get('chapter_title')}, Page {meta.get('page_number')}, Type: {meta.get('type')}]\n{match['text']}"
        )
        sources.append(
            ContextSource(
                text=match["text"],
                page_number=meta.get("page_number", 0),
                chapter_title=meta.get("chapter_title", "Unknown"),
                chapter_number=meta.get("chapter_number", 0),
                type=meta.get("type", "text")
            )
        )
        
    context_str = "\n\n".join(context_chunks)

    # 5. Build LLM messages
    system_instruction = """You are EduMind AI, a highly intelligent and supportive AI tutor. 
Your goal is to answer the student's question based strictly on the textbook context and verified improved explanations provided. 

Guidelines:
1. Ground your answers completely in the provided context. If the concept is not explained in the context, clearly and politely say: "I'm sorry, but that concept is not covered in the selected chapter of this textbook."
2. Provide page numbers, figure numbers, or chapter citations inside your responses (e.g. "[Page 24]") when you reference facts.
3. INTEGRATE VERIFIED EXPLANATIONS: You have access to a list of 'Verified Knowledge Optimizations'. If the student's question matches or is closely related to one of these optimizations, use the improved explanation, analogy, or alternative solution details to enrich and complete your final response. Never present unverified content.
4. Be explanation-oriented. Explain the 'why' behind concepts clearly, exactly like a teacher.
5. If the context contains math formulas or LaTeX equations, format them properly in LaTeX block/inline tags (\\( ... \\) or \\[ ... \\]).
"""

    messages = [
        {"role": "system", "content": system_instruction}
    ]
    
    # Append conversation history
    for msg in request.history[-6:]: # Keep last 6 messages for context
        messages.append({"role": msg.role, "content": msg.content})
        
    # Append user prompt with context
    user_prompt = f"""TEXTBOOK CONTEXT:
{context_str}

VERIFIED KNOWLEDGE ENHANCEMENTS:
{enhancements_str if enhancements_str else "No verified explanations or high-scoring analogy enhancements exist for this chapter yet."}

STUDENT QUESTION:
{request.message}

Provide a comprehensive, accurate, and step-by-step response based on the context and verified improvements above:"""

    messages.append({"role": "user", "content": user_prompt})

    # 6. Generate Completion
    answer = ai_service.chat_completion(messages, temperature=0.3)
    
    return ChatResponse(answer=answer, sources=sources)
