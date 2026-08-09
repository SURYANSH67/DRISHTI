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

# SPA routing fallback for frontend pages
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    raise exc

# Serve static frontend files if built
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

@app.get("/")
def read_root():
    # If frontend is built, serve index.html directly
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "status": "online",
        "service": "EduMind AI API",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
