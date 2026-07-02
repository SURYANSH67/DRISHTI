import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.config import settings
from app.routers import books, tutor, generator, dashboard, auth, admin
from app.database import setup_database

app = FastAPI(
    title="DRISHTI AI Framework API",
    description="Defence Research Intelligent Study, Tutoring & Hybrid Intelligence",
    version="1.0.0"
)

@app.on_event("startup")
def startup_db():
    setup_database()

# CORS configurations for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router modules
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(books.router)
app.include_router(tutor.router)
app.include_router(generator.router)
app.include_router(dashboard.router)

# Mount extracted images folder to serve static image files directly to the frontend
if settings.EXTRACTED_IMAGES_DIR.exists():
    app.mount(
        "/api/static/images", 
        StaticFiles(directory=str(settings.EXTRACTED_IMAGES_DIR)), 
        name="images"
    )

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "EduMind AI API",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
