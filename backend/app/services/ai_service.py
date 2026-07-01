import base64
import json
import os
from typing import Dict, Any, List, Optional
from pathlib import Path
from openai import OpenAI
from PIL import Image as PILImage
from app.config import settings

# Attempt imports for Groq and Gemini
try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

class AIService:
    def __init__(self):
        # Initialize OpenAI client as fallback
        self.openai_client = None
        if settings.OPENAI_API_KEY:
            try:
                self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                print(f"Error initializing OpenAI: {e}")

        # Initialize Groq client
        self.groq_client = None
        if HAS_GROQ and settings.GROQ_API_KEY:
            try:
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
                print("Groq service initialized successfully.")
            except Exception as e:
                print(f"Error initializing Groq: {e}")

        # Initialize Gemini SDK
        self.gemini_enabled = False
        if HAS_GEMINI and settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.gemini_enabled = True
                print("Gemini service initialized successfully.")
            except Exception as e:
                print(f"Error configuring Gemini: {e}")

    def get_embedding(self, text: str) -> List[float]:
        """Generate text embedding using Gemini (primary) or OpenAI (fallback)."""
        # 1. Try Gemini Embeddings
        if self.gemini_enabled:
            try:
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    contents=text,
                    task_type="retrieval_document"
                )
                return result["embedding"]
            except Exception as e:
                print(f"Gemini embedding failed: {e}. Falling back...")

        # 2. Try OpenAI Embeddings
        if self.openai_client:
            try:
                response = self.openai_client.embeddings.create(
                    input=[text],
                    model="text-embedding-3-small"
                )
                return response.data[0].embedding
            except Exception as e:
                print(f"OpenAI embedding failed: {e}")

        # 3. Fallback dummy embedding
        return [0.0] * 1536

    def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = 0.2, 
        response_format: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate text completions using Groq (primary), Gemini (secondary), or OpenAI (fallback)."""
        # 1. Try Groq (Llama-3.3) for lightning-fast text generation
        if self.groq_client:
            try:
                # Map standard message formats
                # Use llama-3.3-70b-specdec on Groq
                kwargs = {
                    "model": "llama-3.3-70b-specdec",
                    "messages": messages,
                    "temperature": temperature
                }
                # Groq supports JSON response format
                if response_format and response_format.get("type") == "json_object":
                    kwargs["response_format"] = {"type": "json_object"}
                    
                response = self.groq_client.chat.completions.create(**kwargs)
                return response.choices[0].message.content or ""
            except Exception as e:
                print(f"Groq chat completion failed: {e}. Falling back...")

        # 2. Try Gemini (gemini-2.5-flash)
        if self.gemini_enabled:
            try:
                # Format messages for Gemini
                gemini_model = genai.GenerativeModel("gemini-2.5-flash")
                
                # Simple conversion from message list to prompt text
                prompt_parts = []
                for msg in messages:
                    role = "Teacher/System" if msg["role"] == "system" else msg["role"].capitalize()
                    prompt_parts.append(f"{role}: {msg['content']}")
                prompt_text = "\n\n".join(prompt_parts) + "\n\nAssistant (Please response matching the requested format):"

                response = gemini_model.generate_content(prompt_text)
                return response.text
            except Exception as e:
                print(f"Gemini chat completion failed: {e}. Falling back...")

        # 3. Try OpenAI (gpt-4o-mini)
        if self.openai_client:
            try:
                kwargs = {
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "temperature": temperature
                }
                if response_format:
                    kwargs["response_format"] = response_format
                response = self.openai_client.chat.completions.create(**kwargs)
                return response.choices[0].message.content or ""
            except Exception as e:
                print(f"OpenAI chat completion failed: {e}")
                return f"Error: All completion APIs failed. {str(e)}"

        return "Error: No LLM API keys configured. Please configure GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY."

    def analyze_image(self, image_path: str, prompt: str) -> str:
        """Perform multimodal image analysis using Gemini (primary) or OpenAI (fallback)."""
        # 1. Try Gemini Vision (exceptionally strong at layouts/OCR)
        if self.gemini_enabled:
            try:
                img = PILImage.open(image_path)
                model = genai.GenerativeModel("gemini-2.5-flash")
                response = model.generate_content([prompt, img])
                return response.text
            except Exception as e:
                print(f"Gemini image analysis failed: {e}. Falling back...")

        # 2. Try OpenAI Multimodal
        if self.openai_client:
            try:
                with open(image_path, "rb") as image_file:
                    base64_image = base64.b64encode(image_file.read()).decode("utf-8")
                
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                  "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ]
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.2
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                print(f"OpenAI image analysis failed: {e}")
                return f"Error: Image analysis failed. {str(e)}"

        return "Error: Multimodal vision requires either GEMINI_API_KEY or OPENAI_API_KEY configured."

ai_service = AIService()
