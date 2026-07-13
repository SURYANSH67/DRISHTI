# 🛡️ DRISHTI AI: Comprehensive Project Handbook
### Defence Research Intelligent Study, Tutoring & Hybrid Intelligence

Welcome to the official **DRISHTI AI** Project Handbook. This document provides an exhaustive, end-to-end technical reference of the entire repository. It outlines the codebase layout, system architecture, database schemas, API routes, frontend layout systems, offline visual OCR engines, and deployment specifications.

---

## 📖 Table of Contents
1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Full System Architecture](#2-full-system-architecture)
3. [Database Dictionary & Security Schema (SQLite)](#3-database-dictionary--security-schema-sqlite)
4. [Backend Codebase & Service Specifications](#4-backend-codebase--service-specifications)
5. [Frontend Components & Style System](#5-frontend-components--style-system)
6. [Offline Pipeline & Local Fallbacks](#6-offline-pipeline--local-fallbacks)
7. [Deployment & Shareability Guides](#7-deployment--shareability-guides)

---

## 1. Executive Summary & Product Vision

**DRISHTI AI** is a research-grade, hybrid intelligence educational platform designed for structured, textbook-aligned study and automated grading. Built to support domain-specific curriculums (such as Defence Research, Physics, Computer Science, and Engineering), the system enables:
* **Interactive Tutor Chats**: Contextually locked to specific textbook chapters using vector similarity retrieval (RAG) to eliminate AI model hallucinations.
* **Automated Written Exam Evaluations**: Advanced grading that processes handwritten student response sheets using visual OCR and matches them against dynamically retrieved reference material.
* **Knowledge Verification Pipeline**: A mechanism for extracting student-derived alternative solutions or clearer analogies to update the knowledge base.
* **Hybrid Connectivity Design**: Dual operation modes allowing real-time switching between cloud-based models (Gemini, Groq) and fully offline local processors (SentenceTransformer and macOS Native Vision OCR via PyObjC).

---

## 2. Full System Architecture

The following block diagram demonstrates the lifecycle of data within DRISHTI AI, mapping from user dashboard requests down to database updates and offline vector searches:

```mermaid
graph TD
    %% Frontend UI
    subgraph Client Layer (React 18 + Vite)
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

## 3. Database Dictionary & Security Schema (SQLite)

DRISHTI AI relies on a secure SQLite database located at `backend/data/drishti.db` to log metadata, user roles, quiz metrics, and AI logs. 

### 1. `users` Table
Manages user accounts, authorization, and roles. 
* **Security Note**: Passwords are securely hashed using salt-based **PBKDF2-SHA256** prior to storage.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique user ID prefix (`usr_xxxx`) |
| `name` | TEXT | NOT NULL | User's full display name |
| `email` | TEXT | UNIQUE NOT NULL | Account login email |
| `password_hash` | TEXT | NOT NULL | PBKDF2 salt-honed password string |
| `role` | TEXT | NOT NULL | User class: `Student`, `Teacher`, `Administrator` |
| `school` | TEXT | | Registered school name |
| `department` | TEXT | | Subject major or teacher faculty specialization |
| `enrollment_number`| TEXT | | Student roll identification number |
| `profile_pic` | TEXT | | URL/path link to user avatar image |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Account creation date |

### 2. `books` Table
Tracks textbook metadata files approved by administrators.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `book_id` | TEXT | PRIMARY KEY | Unique book index string (`bk_xxxx`) |
| `filename` | TEXT | NOT NULL | Saved PDF file basename |
| `subject_name` | TEXT | DEFAULT '' | Subject domain |
| `total_pages` | INTEGER | NOT NULL | Total page length of PDF |
| `image_count` | INTEGER | NOT NULL | Evaluated figure assets found in PDF |
| `formula_count` | INTEGER | NOT NULL | Extracted math expressions found in PDF |
| `table_count` | INTEGER | NOT NULL | Parsed tabular layouts |
| `uploaded_by` | TEXT | | ID of the user who uploaded the book |
| `approved` | INTEGER | DEFAULT 0 | Approval state: `0 = Pending`, `1 = Approved` |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Database index timestamp |

### 3. `quiz_attempts` Table
Stores telemetry records of student quizzes.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique attempt identifier |
| `user_id` | TEXT | NOT NULL | Submitting Student User ID |
| `book_id` | TEXT | NOT NULL | Textbook identifier |
| `chapter_number` | INTEGER | NOT NULL | Target chapter index |
| `score` | INTEGER | NOT NULL | Final score calculated |
| `total` | INTEGER | NOT NULL | Max possible questions count |
| `timestamp` | TEXT | DEFAULT CURRENT_TIMESTAMP | Completion time |

### 4. `evaluations` Table
Tracks student handwritten/written grading card reviews.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique evaluation record ID |
| `user_id` | TEXT | NOT NULL | Student User ID |
| `question` | TEXT | NOT NULL | Extracted question sheet prompt |
| `score` | INTEGER | NOT NULL | Score awarded (scalar 0-10) |
| `concept_accuracy` | TEXT | NOT NULL | JSON metadata of matched & missing concepts |
| `feedback` | TEXT | | Grading notes generated by LLM |
| `timestamp` | TEXT | DEFAULT CURRENT_TIMESTAMP | Grading completion timestamp |

### 5. `knowledge_enhancements` Table
Maintains student-derived alternative solutions and analogies for teacher review.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique candidate ID |
| `book_id` | TEXT | NOT NULL | Reference Book ID |
| `chapter_number` | INTEGER | NOT NULL | Reference Chapter Number |
| `question` | TEXT | NOT NULL | Question text |
| `official_answer` | TEXT | NOT NULL | Reference textbook solution |
| `student_answer` | TEXT | NOT NULL | OCR student transcript |
| `feedback` | TEXT | NOT NULL | Assignment feedback remarks |
| `marks` | INTEGER | NOT NULL | Score value scored |
| `similarity_score`| REAL | NOT NULL | Similarity percentage between response & text |
| `concepts_missed` | TEXT | NOT NULL | JSON string listing missing concepts |
| `concepts_correct` | TEXT | NOT NULL | JSON string listing correct concepts |
| `improved_explanation`| TEXT | | Student's alternative analogy candidate |
| `verification_status`| TEXT | DEFAULT 'Pending' | Approvals: `Pending`, `Approved`, `Rejected` |
| `confidence_score` | REAL | DEFAULT 0.0 | Extraction confidence score |
| `subject` | TEXT | | Subject category |
| `difficulty` | TEXT | DEFAULT 'Medium' | Evaluated question difficulty level |
| `timestamp` | TEXT | DEFAULT CURRENT_TIMESTAMP | Candidate creation timestamp |

---

## 4. Backend Codebase & Service Specifications

The backend folder (`backend/`) hosts the FastAPI web server, routers, database interfaces, and NLP services.

### Core Architecture Files
* **[config.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/config.py)**: Manages environment configuration settings, API key parameters, local directory paths (Uploads, Database, and Static files directories), and CORS options.
* **[database.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/database.py)**: Establishes SQLite DB connections, initializes database tables, and handles password hashing via PBKDF2-SHA256 with dynamic salts.
* **[main.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/main.py)**: The central application controller. Registers API routers, configures CORS middleware, mounts local static folders, serves React production static builds at the root (`/`), and implements the Single Page App (SPA) fallback route for client-side React paths.

### NLP & Vector Storage Services
* **[ai_service.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/services/ai_service.py)**: Handles language model integrations. Uses Gemini for primary document tokenization and visual analyses, Groq (Llama-3.3-70b) for chat completions, and OpenAI as a fallback. Includes a local, lazy-loaded **SentenceTransformer** (`all-MiniLM-L6-v2`) class mapping 384-dimensional text embeddings in offline environments.
* **[vector_store.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/services/vector_store.py)**: A lightweight JSON-based local vector store. Implements search functions based on cosine similarity, and includes dimension-verification safety guards to prevent errors when querying with mixed 384-dim (offline) and 1536-dim (online) embeddings.
* **[pdf_parser.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/services/pdf_parser.py)**: A heuristic chapter layout parser utilizing `PyMuPDF`. Splitting textbooks by scanning headings for numeric chapters, ignoring Table of Contents, extracting images, detecting mathematical equations using OCR-level characters, and vectorizing content.

### Route Controllers (`routers/`)
* **[auth.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/routers/auth.py)**: Manages credentials verification, duplicate email checks, role registration, and user login validations.
* **[admin.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/routers/admin.py)**: Handles administration capabilities. Provides endpoints for user database overrides, system metrics monitoring, API logs audits, textbook approval toggles, and the verification of candidate knowledge base updates.
* **[books.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/routers/books.py)**: Manages book library uploads, processes parsing tasks, and reads catalog statuses.
* **[tutor.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/routers/tutor.py)**: Implements the AI RAG Chatbot. Fetches matching textbook chapters and incorporates teacher-approved student analogies to synthesize tailored replies.
* **[generator.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/routers/generator.py)**: Exposes endpoints for generating structured question papers, marking schemes, and solution sheets.
* **[dashboard.py](file:///Users/suryanshdixit/Downloads/aiii/backend/app/routers/dashboard.py)**: Dynamically computes cohort distributions, grade letters, and dashboard metrics from SQLite. It also provides the `/network-status` endpoint that pings `8.8.8.8` to toggle the frontend between online and offline modes.

---

## 5. Frontend Components & Style System

The React codebase (`frontend/`) uses TypeScript, Tailwind CSS, and Lucide icons.

### User Interface Panels
* **[AuthView.tsx](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/components/AuthView.tsx)**: The entry login and account creator view. Features a clean, centered layout with role selection drop-downs and theme controls.
* **[StudentPanel.tsx](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/components/StudentPanel.tsx)**: The student workspace. Provides tabs for browsing textbooks, asking the RAG Tutor, referencing formulas, taking adaptive quizzes, uploading handwritten answer sheets, and viewing performance telemetry.
* **[TeacherPanel.tsx](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/components/TeacherPanel.tsx)**: The faculty panel. Implements a 12-column SaaS dashboard, class metrics tracking, and a panel for approving candidate knowledge enhancements.
* **[AdminPanel.tsx](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/components/AdminPanel.tsx)**: The platform administration dashboard. Tracks user directories, handles textbook approvals, monitors database storage metrics, and views API access logs.

### Application Core & Routing
* **[App.tsx](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/App.tsx)**: Manages core state (user session, theme configurations, active book IDs, active chapters) and coordinates dashboard routing. Regularly checks connection status using the `/network-status` endpoint.
* **[api.ts](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/services/api.ts)**: The primary frontend HTTP API client. The `API_BASE_URL` dynamically adapts based on the active port: it uses port `8000` locally, and fallback-routes to `/api` on public domains to support tunnel deployments.
* **[index.css](file:///Users/suryanshdixit/Downloads/aiii/frontend/src/index.css)**: Implements custom variants for Tailwind dark mode, scrolls parameters, card layouts, and custom animations.

---

## 6. Offline Pipeline & Local Fallbacks

DRISHTI AI features a robust offline fallback system that ensures key grading and learning features continue to work without internet connectivity.

### 1. Offline Embedding Engine
* **Lazy Loading**: If online endpoints (Gemini/OpenAI) fail, `ai_service.py` dynamically loads the local PyTorch-based `SentenceTransformer` package.
* **Model Configuration**: Uses the `all-MiniLM-L6-v2` model, which generates 384-dimensional dense vectors.
* **Vector Store Compatibility**: `vector_store.py` verifies query and vector lengths before computing cosine similarity dot products, preventing dimension mismatches between 384-dim (offline) and 1536-dim (online) documents.

### 2. Hardware-Accelerated macOS Vision OCR
* **Native Integration**: Under macOS platforms, the evaluator loads the Apple Vision Framework via PyObjC bindings (`VNRecognizeTextRequest`).
* **Visual Extractions**: PDF and image answer sheets are processed page-by-page. Pages are rendered to high-resolution PNGs, and the native macOS engine extracts handwritten and printed text completely offline.
* **Resource Optimization**: This design uses the local Apple Silicon Neural Engine to run OCR with minimal latency and zero external network calls.

---

## 7. Deployment & Shareability Guides

### Local Execution
1. Install Python backend requirements:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Install Frontend Node packages:
   ```bash
   cd ../frontend
   npm install
   ```
3. Run the unified development server:
   ```bash
   cd ..
   chmod +x run.sh
   ./run.sh
   ```

### Access Port Schemas
* **Local React Development Port**: `http://localhost:5173/`
* **Local Unified Port** (serves compiled frontend and API routes): `http://localhost:8000/`

### Public Shareability Tunnel (Localtunnel / Pinggy)
To expose the unified port `8000` to the internet without installing local software, you can launch a secure SSH tunnel via Pinggy on port 443:
```bash
ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -R 80:localhost:8000 a.pinggy.io
```
This returns a public HTTPS domain (e.g. `https://xxxxx.run.pinggy-free.link`) that anyone can open to access the application.
