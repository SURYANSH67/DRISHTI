import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

BASE_DIR_PATH = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR_PATH / ".env")
load_dotenv(BASE_DIR_PATH.parent / ".env")

class Settings(BaseSettings):
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    UPLOAD_DIR: Path = DATA_DIR / "uploads"
    EXTRACTED_DIR: Path = DATA_DIR / "extracted"
    EXTRACTED_IMAGES_DIR: Path = EXTRACTED_DIR / "images"
    EXTRACTED_TABLES_DIR: Path = EXTRACTED_DIR / "tables"
    CHROMA_DIR: Path = DATA_DIR / "chroma"
    
    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.EXTRACTED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
settings.EXTRACTED_TABLES_DIR.mkdir(parents=True, exist_ok=True)
settings.CHROMA_DIR.mkdir(parents=True, exist_ok=True)
