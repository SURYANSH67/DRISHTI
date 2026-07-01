# 🛡️ DRISHTI Framework
### Defence Research Intelligent Study & Hybrid Tutoring Interface

DRISHTI is an enterprise-grade, hybrid LLM + RAG Educational Intelligence Platform designed for the Defence Research and Development Organisation (DRDO). It integrates advanced semantic document parsing, adaptive evaluation, dynamic assessment generation, and AI-grounded tutoring into a unified, information-dense SaaS Command Center.

---

## 🚀 Key Features & Modules

### 1. 🔐 Role-Based Authentication
* **Multi-Role Scopes**: Secure onboarding, password hashing, and dashboard segmentation for **Students**, **Teachers (Faculty)**, and **Administrators**.
* **Unified Workspace**: Tailored access control ensuring student privacy and administrative auditability.

### 2. 📊 12-Column SaaS Command Center (Dashboard)
* **Single-Viewport Layout**: A high-density dashboard optimized for standard viewports (1920x1080) displaying essential metrics, telemetry cards, and quick actions with zero layout clutter.
* **Telemetry & Analytics**: Real-time calculations of books, chapter splits, average cohort accuracy, grading distribution charts, and cohort analytics.

### 3. 📚 Subject-Tagging Knowledge Base & Library
* **Subject Grouping**: Upload textbooks categorized by subject tags (e.g., *Cloud Computing*, *Data Structures*).
* **Document Parser**: Extracts pages, chapters, mathematical equations, and diagrams.
* **Direct Downloads**: Facilitates original textbook PDF retrieval for offline study.

### 4. 💬 AI Chapter Tutor (RAG-Grounded Chat)
* **Context-Grounded Assistance**: Interactive conversation grounded strictly in the specific chapter and book text using custom vector embeddings.
* **Academic Grounding**: Automatically retrieves exact source pages, chapters, and references to verify facts.

### 5. 📑 Study Resource Hub
* **Automated Study Guides**: Dynamic compilation of structured notes, chapter summaries, key equations, and schematic diagram lists.

### 6. 🏆 Adaptive Assessment Engine
* **Custom Quizzes**: Generates tailored assessments covering MCQs, HOTS (High Order Thinking Skills), numerical problems, and short-form queries.
* **Marking Verification**: Implements robust answer grading with instant score reports.

### 7. 📥 OCR-Driven Written Evaluations
* **Handwriting Extraction**: Employs OCR tools to extract and transcribe handwritten student answer sheets.
* **Continuous Enhancement**: Identifies missing concepts, assesses formula correctness, suggests ideal explanations, and updates the knowledge base only after teacher verification.

### 8. 📝 Question Paper Generator
* **Exam Customization**: Configures mid-semester, end-semester, unit test, or custom papers under multiple patterns (CBSE, University, Standard).
* **AI Question Distribution**: Select difficulty and distribution rules to dynamically output exam layouts.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, TypeScript, HTML5.
* **Backend**: FastAPI (Python 3.10+), Uvicorn, SQLite (Database), Pydantic.
* **AI Engine**: Groq SDK, Gemini API, Chroma DB (Vector Store / Vector embeddings).

---

## 💻 Setup & Installation

### 1. Prerequisites
Ensure you have Python 3.10+ and Node.js (v18+) installed on your machine.

### 2. Project Layout
```
aiii/
├── backend/            # FastAPI python backend
│   ├── app/            # Source modules
│   ├── data/           # SQLite databases & Local JSON stores (gitignored)
│   └── requirements.txt
├── frontend/           # React TSX frontend
│   ├── src/            # Application components
│   └── package.json
├── run.sh              # Single-run startup script
└── .gitignore          # Repository filter settings
```

### 3. Environment Configuration
Create a `.env` file at the root of the project containing:
```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

### 4. Running the Application
Launch both backend and frontend servers in one command using the startup script:
```bash
./run.sh
```
The servers will spin up automatically:
* **Frontend**: `http://localhost:5173/`
* **Backend API**: `http://localhost:8000/`

---

## 🔒 Security & Data Integrity
* Credentials, uploaded textbook PDFs, vector caches, and session variables are kept private and isolated.
* A robust `.gitignore` ensures credentials are never pushed to public repositories.
