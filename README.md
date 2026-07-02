# 🛡️ DRISHTI AI: Educational Intelligence Command Center
### Defence Research Intelligent Study, Tutoring & Hybrid Intelligence
DRISHTI AI is an enterprise-grade, hybrid LLM + RAG Educational Intelligence Platform designed for structured and specialized curriculum training (e.g., Defence Research, Engineering, Science). It integrates advanced semantic document parsing, adaptive evaluation, dynamic assessment generation, and AI-grounded tutoring into a unified, information-dense SaaS Command Center.

---

## 🚀 System Architecture Overview

Below is the conceptual architecture of the DRISHTI platform, illustrating how uploaded syllabus documents are vectorized, stored, and utilized across the RAG-grounded Tutor, Adaptive Quiz, and OCR Evaluation modules.

```mermaid
graph TD
    %% Files & Upload Client
    subgraph Client Layer (React + Vite)
        UI[SaaS Dashboard Command Center]
        StudentPanel[Student Panel UI]
        TeacherPanel[Teacher Panel UI]
    end

    %% Backend Server
    subgraph Server Layer (FastAPI)
        API[FastAPI Router Engine]
        DB[(SQLite DB)]
        
        subgraph NLP & Vector DB Pipeline
            V_DB[(Chroma Vector Store JSON)]
            Parser[Heuristic PDF Chapter & Layout Parser]
            Embedder[Gemini models/gemini-embedding-001]
        end
        
        subgraph Evaluation & OCR Engine
            OCR[Visual OCR / Page Render Engine]
            Evaluator[AnswerEvaluator Engine]
            LLM_Service[LLM / Chat Completion Engine]
        end
    end

    %% Connections
    UI -->|API Requests| API
    Parser -->|Vector Embeddings| Embedder
    Embedder -->|Store Vector JSON| V_DB
    
    %% Evaluation path
    TeacherPanel -->|Question Paper + Answer Sheet| API
    API -->|Save Uploads| OCR
    OCR -->|Page Images / Extracted Text| Evaluator
    Evaluator -->|RAG Queries| V_DB
    Evaluator -->|Prompts + Context| LLM_Service
    LLM_Service -->|Grading Report Card JSON| API
    API -->|Log Scores & Metrics| DB
    API -->|Response JSON| UI
```

---

## 🌟 Key Modules & Implementations

### 1. 📚 Subject-Grouped Textbook Library
* **Horizontal Grid Dashboard**: A dense grid layout that fits up to 3 textbook cards per row on standard desktop viewports, minimizing vertical scroll clutter.
* **Interactive Subject Filters**: A quick-toggle pill bar (`ALL`, `12TH PHYSICS`, `CLOUD COMPUTING`, etc.) at the top that filters the active library instantly.
* **Granular Chapter Index**: Each card exposes direct chapter shortcuts. Clicking any chapter immediately loads it as the active textbook and redirects the student to the AI Tutor.
* **Resource Count Badges**: Displays extracted pages, parsed chapter counts, formulas, and diagrams for each volume.

### 2. 📑 Study Resource Hub
* **Structured Summaries**: Synthesizes complex chapters into clear summary guides.
* **Mathematical Reference Cards**: Extracts and renders equations, derivations, and formulas from the active textbook.
* **Diagram Directory**: Lists schematic charts, graphs, and illustrations with page references for quick inspection.

### 3. 💬 AI Chapter Tutor (RAG Chat)
* **Textbook-Grounded LLM**: Answers are strictly scoped to the active textbook and active chapter, preventing model hallucinations.
* **Deep Page Citations**: Every response lists precise pages and chapter locations, allowing users to verify facts directly in the original book.

### 4. 📥 OCR-Driven Written Evaluations (Grading Desk)
* **Dual Upload Streams**: Accepts both the **Question Paper** PDF/image and the **Student's Handwritten Answer Sheet** PDF/image.
* **Auto-Extraction**: Disables the manual question prompt when a Question Paper is uploaded, letting the AI extract questions directly from the file.
* **Scanned PDF Visual OCR Fallback**: If a PDF file has no digital text layer (scanned copies), the backend uses `PyMuPDF` to render pages to high-resolution PNGs and performs page-by-page visual handwriting OCR.
* **Textbook RAG Auto-Grading**: When toggled, the platform searches the vector store using the extracted questions to retrieve reference paragraphs from the textbook, removing the need for manual model answer keys.
* **Knowledge Enhancement Pipeline**: Detects if a student has provided a superior analogy or correct alternative solution, generating a merged "improved explanation" for faculty review to update the syllabus.

### 5. 📑 Question Paper Generator
* **Parameters Configurator**: Select book, chapters, difficulty distribution, marking pattern (e.g. CBSE, Standard University), and question types (HOTS, MCQs, Numericals).
* **Direct Export**: Compiles exam layouts into download-ready PDF and Markdown question sheets.

---

## 🛠️ Technology Stack & Integrations

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, TypeScript.
* **Backend**: FastAPI (Python 3.10+), Uvicorn, PyMuPDF (`fitz`), Pydantic.
* **Database**: SQLite (Grades, Analytics, Logs), JSON-based Local Chroma Vector Store.
* **AI Providers**:
  * **Gemini API**: Used for multimodal vision analysis, handwriting OCR, and `models/gemini-embedding-001` document vectorization.
  * **Groq API**: Primary chat handler utilizing high-performance models (`llama-3.3-70b-specdec` / `llama3-70b-8192`) with standard fallback handlers.

---

## ⚙️ Setup, Installation & Verification

### 1. Prerequisites
Ensure you have the following installed on your system:
* **Node.js** (v18+) & **npm**
* **Python** (3.10+) & **pip**

### 2. Environment Configuration
Create a `.env` file in the root workspace directory with your credentials:
```env
GEMINI_API_KEY=your_google_gemini_api_key
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key (optional fallback)
```

### 3. Startup & Service Execution
Launch both FastAPI (Port `8000`) and Vite dev server (Port `5173`) in one command using the startup wrapper:
```bash
chmod +x run.sh
./run.sh
```

---

## 📁 Repository Structure

```
aiii/
├── backend/                  # FastAPI Application Codebase
│   ├── app/
│   │   ├── config.py         # Global application configuration settings
│   │   ├── database.py       # SQLite database initialization & tables schema
│   │   ├── main.py           # FastAPI entrypoint & middleware configuration
│   │   ├── schemas.py        # Pydantic request & response type definitions
│   │   ├── routers/
│   │   │   ├── auth.py       # Authentication router
│   │   │   ├── books.py      # Syllabus book management & PDF parsing router
│   │   │   └── dashboard.py  # Grading evaluations & analytics router
│   │   └── services/
│   │       ├── ai_service.py # Gemini, Groq, & OpenAI API wrappers
│   │       ├── evaluator.py  # AnswerEvaluator engine & scanned PDF OCR fallback
│   │       ├── pdf_parser.py # Heuristic chapter layout parser
│   │       └── vector_store.py # Local Chroma-like JSON vector store
│   ├── data/                 # SQLite database & book metadata store
│   └── requirements.txt      # Python dependencies list
│
├── frontend/                 # React TSX Application Codebase
│   ├── src/
│   │   ├── components/
│   │   │   ├── StudentPanel.tsx # Student dashboard & Study library
│   │   │   ├── TeacherPanel.tsx # Teacher grading, analytics & uploads
│   │   │   └── AdminPanel.tsx   # Admin overview panels
│   │   └── services/
│   │       └── api.ts        # Frontend API fetch services client
│   └── package.json          # Node dependencies list
│
└── run.sh                    # Unified dev server bootstrapper script
```

---

## 🔒 Security & Policy
* **Data Privacy**: Uploaded student submissions and textbooks are cached locally in the backend directory.
* **Safe Reloader**: The FastAPI watcher excludes data cache files to prevent hot-reload loops during vector store updates.
