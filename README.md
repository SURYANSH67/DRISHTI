# 🛡️ DRISHTI AI: Educational Intelligence Command Center
### Defence Research Intelligent Study, Tutoring & Hybrid Intelligence

DRISHTI AI is an enterprise-grade, hybrid LLM + RAG (Retrieval-Augmented Generation) Educational Intelligence Platform designed for structured and specialized curriculum training (e.g., Defence Research, Engineering, Science). It integrates advanced semantic document parsing, adaptive evaluation, dynamic assessment generation, hardware-accelerated offline OCR, and local sentence embedding models into a unified, information-dense SaaS Command Center.

---

## 🚀 System Architecture Overview

Below is the conceptual architecture of the DRISHTI AI platform, illustrating how uploaded syllabus documents are vectorized, stored, and utilized across the RAG-grounded Tutor, Adaptive Quiz, and OCR Evaluation modules, featuring automated offline fallbacks:

```mermaid
graph TD
    %% Client & UI Layer
    subgraph Client Layer (React + Vite)
        UI[SaaS Dashboard Command Center]
        StudentPanel[Student Panel UI]
        TeacherPanel[Faculty Panel UI]
        AdminPanel[Admin Panel UI]
    end

    %% Backend Server
    subgraph Server Layer (FastAPI)
        API[FastAPI Router Engine]
        DB[(SQLite Database)]
        
        subgraph NLP & Vector DB Pipeline
            V_DB[(Simple Vector Store JSON)]
            Parser[Heuristic PDF Chapter & Layout Parser]
            Embedder_Online[Gemini models/gemini-embedding-001]
            Embedder_Offline[Local SentenceTransformer all-MiniLM-L6-v2]
        end
        
        subgraph Evaluation & OCR Engine
            OCR_Page[Page Render Engine PyMuPDF]
            OCR_Online[Online Gemini Vision API]
            OCR_Offline[Local macOS Vision Framework via PyObjC]
            Evaluator[AnswerEvaluator Engine]
            LLM_Service[Groq Llama-3.3-70b Engine]
        end
    end

    %% Connections
    UI -->|API Requests| API
    Parser -->|Vector Embeddings| Embedder_Online
    API -->|Offline Fallback| Embedder_Offline
    Embedder_Online -->|Store Vectors| V_DB
    Embedder_Offline -->|Store Vectors| V_DB
    
    %% Evaluation path
    TeacherPanel -->|Question Paper + Answer Sheet| API
    API -->|Save Uploads| OCR_Page
    OCR_Page -->|Scanned PNGs| OCR_Offline
    OCR_Page -->|API Fallback| OCR_Online
    OCR_Offline -->|Extracted Text| Evaluator
    OCR_Online -->|Extracted Text| Evaluator
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

### 2. 💬 AI Chapter Tutor (RAG Chat)
* **Textbook-Grounded LLM**: Answers are strictly scoped to the active textbook and active chapter, preventing model hallucinations.
* **Deep Page Citations**: Every response lists precise pages and chapter locations, allowing users to verify facts directly in the original book.
* **Optimized Markdown Typography**: Adapts contrast and font colors dynamically across Light/Dark modes, ensuring optimal readability.

### 3. 📥 OCR-Driven Written Evaluations (Grading Desk)
* **Dual Upload Streams**: Accepts both the **Question Paper** PDF/image and the **Student's Handwritten Answer Sheet** PDF/image.
* **Auto-Extraction**: Disables the manual question prompt when a Question Paper is uploaded, letting the AI extract questions directly from the file.
* **Knowledge Enhancement Pipeline**: Detects if a student has provided a superior analogy or correct alternative solution, generating a merged "improved explanation" for faculty review to update the syllabus.
* **Teacher Review Portal**: Implemented the "Knowledge Desk" tab in `TeacherPanel.tsx` allowing teachers to browse pending optimizations, read OCR student transcripts, inspect concept match lists, and approve/reject enhancements.

### 4. ⚙️ Offline Pipeline Strengthening
* **Local Offline Text Embeddings**: Configured a local embedding model using `sentence-transformers`. When the server is offline or online APIs (Gemini/OpenAI) are unavailable, it lazy-loads `all-MiniLM-L6-v2` locally to generate 384-dimensional text embeddings, guaranteeing that RAG and textbook searching work seamlessly without internet connectivity.
* **Dimension-Aware Search**: Configured vector searching to automatically filter out database records that do not match the dimensionality of the query vector (e.g. 1536-dim online vectors vs 384-dim offline vectors). This prevents shape mismatch runtime errors.
* **Hardware-Accelerated macOS Vision OCR**: Designed a native macOS OCR pipeline utilizing Apple's **Vision Framework via PyObjC** (`VNRecognizeTextRequest`). This performs high-resolution handwriting and scanned PDF text recognition locally on your Mac's Neural Engine with **zero extra downloads**, near-zero latency, and is 100% offline-capable.

---

## 📊 Database Schema (SQLite)

DRISHTI AI uses a secure SQLite database file (`backend/data/drishti.db`) for system data storage.

### 1. `users` Table
Stores registered student, teacher, and administrator accounts. Password hashes are calculated using salt-based **PBKDF2-SHA256**.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique user identifier (`usr_xxxx`) |
| `name` | TEXT | NOT NULL | User's full name |
| `email` | TEXT | UNIQUE NOT NULL | Account email (used for login) |
| `password_hash` | TEXT | NOT NULL | Hashed credentials with urandom salt |
| `role` | TEXT | NOT NULL | Permission role (`Student`, `Teacher`, `Administrator`) |
| `school` | TEXT | | Registered school name |
| `department` | TEXT | | Department / cohort division |
| `enrollment_number`| TEXT | | Student roll number or registration ID |
| `profile_pic` | TEXT | | Link path to profile picture |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |

### 2. `books` Table
Tracks textbook metadata files approved by administrators.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `book_id` | TEXT | PRIMARY KEY | Unique book identifier (`bk_xxxx`) |
| `filename` | TEXT | NOT NULL | PDF filename |
| `subject_name` | TEXT | DEFAULT '' | Subject field category |
| `total_pages` | INTEGER | NOT NULL | Total page count |
| `image_count` | INTEGER | NOT NULL | Number of parsed figures |
| `formula_count` | INTEGER | NOT NULL | Number of parsed equations |
| `table_count` | INTEGER | NOT NULL | Number of parsed tables |
| `uploaded_by` | TEXT | | User ID who uploaded the book |
| `approved` | INTEGER | DEFAULT 0 | Library visibility status (`0 = Pending`, `1 = Approved`) |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | File upload timestamp |

### 3. `quiz_attempts` Table
Records adaptive student quiz scores.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique quiz score identifier |
| `user_id` | TEXT | NOT NULL | Student User ID |
| `book_id` | TEXT | NOT NULL | Textbook Book ID |
| `chapter_number` | INTEGER | NOT NULL | Chapter number |
| `score` | INTEGER | NOT NULL | Marks scored |
| `total` | INTEGER | NOT NULL | Maximum marks |
| `timestamp` | TEXT | DEFAULT CURRENT_TIMESTAMP | Completion timestamp |

### 4. `evaluations` Table
Logs written assignment grading evaluations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique evaluation record ID |
| `user_id` | TEXT | NOT NULL | Student User ID |
| `question` | TEXT | NOT NULL | Question prompt |
| `score` | INTEGER | NOT NULL | Evaluated score (out of 10) |
| `concept_accuracy` | TEXT | NOT NULL | JSON string listing matched concepts |
| `feedback` | TEXT | | AI feedback comments |
| `timestamp` | TEXT | DEFAULT CURRENT_TIMESTAMP | Evaluation timestamp |

### 5. `knowledge_enhancements` Table
Archives candidate analogies or explanation optimizations derived from student responses for teacher review.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique candidate identifier |
| `book_id` | TEXT | NOT NULL | Associated book ID |
| `chapter_number` | INTEGER | NOT NULL | Associated chapter |
| `question` | TEXT | NOT NULL | Question prompt |
| `official_answer` | TEXT | NOT NULL | Reference solution |
| `student_answer` | TEXT | NOT NULL | Extracted student transcript |
| `feedback` | TEXT | NOT NULL | Evaluator comments |
| `marks` | INTEGER | NOT NULL | Marks scored |
| `similarity_score`| REAL | NOT NULL | Semantic similarity index |
| `concepts_missed` | TEXT | NOT NULL | JSON string listing missed concepts |
| `concepts_correct` | TEXT | NOT NULL | JSON string listing correct concepts |
| `improved_explanation`| TEXT | | Student's alternative analogy candidate |
| `verification_status`| TEXT | DEFAULT 'Pending' | Review status (`Pending`, `Approved`, `Rejected`) |
| `confidence_score` | REAL | DEFAULT 0.0 | Extraction confidence score |
| `subject` | TEXT | | Subject category |
| `difficulty` | TEXT | DEFAULT 'Medium' | Question difficulty level |
| `timestamp` | TEXT | DEFAULT CURRENT_TIMESTAMP | Candidate creation timestamp |

---

## ⚙️ Setup, Installation & Verification

### 1. Prerequisites
Ensure you have the following installed on your system:
* **Node.js** (v18+) & **npm**
* **Python** (3.10+) & **pip**
* **macOS** (For hardware-accelerated offline Vision OCR fallback)

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

### 4. Running Offline Verifications
To verify offline embedding and local macOS Vision OCR performance:
```bash
backend/venv/bin/python3 backend/app/services/evaluator.py
```
This runs a test simulation that confirms local OCR page extractions and SentenceTransformer models load and execute completely offline on your local host.

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
│   │   │   ├── admin.py      # Admin panels router
│   │   │   ├── books.py      # Syllabus book management & PDF parsing router
│   │   │   └── dashboard.py  # Grading evaluations, network checking & analytics router
│   │   └── services/
│   │       ├── ai_service.py # Gemini, Groq, & local SentenceTransformer embedding fallbacks
│   │       ├── evaluator.py  # AnswerEvaluator engine & macOS Vision OCR helper
│   │       ├── pdf_parser.py # Heuristic chapter layout parser
│   │       └── vector_store.py # Local dimension-aware JSON vector store
│   ├── data/                 # SQLite database file & book metadata store
│   └── requirements.txt      # Python dependencies list
│
├── frontend/                 # React TSX Application Codebase
│   ├── src/
│   │   ├── components/
│   │   │   ├── StudentPanel.tsx # Student dashboard & Study library
│   │   │   ├── TeacherPanel.tsx # Teacher grading, analytics & uploads
│   │   │   ├── AdminPanel.tsx   # Admin overview panels
│   │   │   └── AuthView.tsx     # Login/registration view
│   │   └── services/
│   │       └── api.ts        # Frontend API fetch services client
│   └── package.json          # Node dependencies list
│
└── run.sh                    # Unified dev server bootstrapper script
```

---

## 🔒 Security & Policy
* **Local Offline Engine**: When disconnected, student grading transcripts and text embeddings are handled locally in-memory, ensuring zero exposure to external networks.
* **Safe Reloader**: The FastAPI watcher excludes directory data files to prevent hot-reload loops during vector store updates.
