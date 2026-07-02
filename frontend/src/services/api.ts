const API_BASE_URL = `http://${window.location.hostname}:8000/api`;

export interface BookOverview {
  book_id: string;
  filename: string;
  subject_name?: string;
  total_pages: number;
  chapters: {
    title: string;
    start_page: number;
    end_page: number;
    page_count: number;
  }[];
  image_count: number;
  formula_count: number;
  table_count: number;
  uploaded_by?: string;
  images?: any[];
  formulas?: any[];
  tables?: any[];
  approved?: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ContextSource {
  text: string;
  page_number: number;
  chapter_title: string;
  chapter_number: number;
  type: string;
}

export interface ChatResponse {
  answer: string;
  sources: ContextSource[];
}

export interface GenerateResponse {
  title: string;
  content: string;
  metadata: Record<string, any>;
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: string;
  options: string[] | null;
  reference_answer: string;
  page_number: number;
  topic: string;
}

export interface QuizResponse {
  book_id: string;
  chapter_number: number;
  questions: QuizQuestion[];
}

export interface EvaluationResponse {
  handwriting_ocr_text: string | null;
  score: number;
  concept_accuracy: string;
  missing_elements: string[];
  mistakes: string[];
  suggestions: string;
  overall_feedback: string;
}

export const api = {
  // Books API
  async listBooks(userRole?: string): Promise<BookOverview[]> {
    const url = userRole ? `${API_BASE_URL}/books/list?user_role=${userRole}` : `${API_BASE_URL}/books/list`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch books list");
    return res.json();
  },

  async getBook(bookId: string): Promise<BookOverview> {
    const res = await fetch(`${API_BASE_URL}/books/${bookId}`);
    if (!res.ok) throw new Error("Failed to fetch book details");
    return res.json();
  },

  async uploadBook(file: File, uploadedBy?: string, userRole?: string, subjectName?: string): Promise<BookOverview> {
    const formData = new FormData();
    formData.append("file", file);
    if (uploadedBy) formData.append("uploaded_by", uploadedBy);
    if (userRole) formData.append("user_role", userRole);
    if (subjectName) formData.append("subject_name", subjectName);

    const res = await fetch(`${API_BASE_URL}/books/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Failed to upload book");
    }
    return res.json();
  },

  getBookDownloadUrl(bookId: string): string {
    return `${API_BASE_URL}/books/${bookId}/download`;
  },

  async deleteBook(bookId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/books/${bookId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete book");
  },

  // Tutor API
  async tutorChat(
    bookId: string,
    chapterNumber: number | null,
    message: string,
    history: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE_URL}/tutor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book_id: bookId,
        chapter_number: chapterNumber,
        message,
        history,
      }),
    });
    if (!res.ok) throw new Error("Tutor communication failed");
    return res.json();
  },

  // Generator API
  async generateResource(
    bookId: string,
    chapterNumber: number,
    resourceType: "notes" | "summary" | "formulas" | "diagrams"
  ): Promise<GenerateResponse> {
    const res = await fetch(`${API_BASE_URL}/generator/resource`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book_id: bookId,
        chapter_number: chapterNumber,
        resource_type: resourceType,
      }),
    });
    if (!res.ok) throw new Error(`Failed to generate ${resourceType}`);
    return res.json();
  },

  async generateQuiz(
    bookId: string,
    chapterNumber: number,
    questionCount: number = 5,
    difficulty: string = "Medium",
    questionTypes: string[] = ["MCQ", "Numerical", "HOTS", "Short Answer"]
  ): Promise<QuizResponse> {
    const res = await fetch(`${API_BASE_URL}/generator/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book_id: bookId,
        chapter_number: chapterNumber,
        question_count: questionCount,
        difficulty,
        question_types: questionTypes,
      }),
    });
    if (!res.ok) throw new Error("Failed to generate quiz");
    return res.json();
  },

  async generateQuestionPaper(
    bookId: string,
    chapterNumber: number,
    examType: string,
    pattern: string,
    totalMarks: number,
    durationHours: number,
    difficulty: string,
    questionTypes: string[],
    autoDistribute: boolean,
    customDistribution?: Record<string, number>,
    aiOptions?: string[]
  ): Promise<{ title: string; content: string; metadata: any }> {
    const res = await fetch(`${API_BASE_URL}/generator/paper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book_id: bookId,
        chapter_number: chapterNumber,
        exam_type: examType,
        pattern,
        total_marks: totalMarks,
        duration_hours: durationHours,
        difficulty,
        question_types: questionTypes,
        auto_distribute: autoDistribute,
        custom_distribution: customDistribution || null,
        ai_options: aiOptions || []
      }),
    });
    if (!res.ok) throw new Error("Failed to generate custom question paper");
    return res.json();
  },

  // Dashboard & Evaluator API
  async getDashboardStats(userId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats?user_id=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  async logQuizAttempt(
    userId: string,
    bookId: string,
    chapterNumber: number,
    score: number,
    total: number
  ): Promise<any> {
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("book_id", bookId);
    formData.append("chapter_number", String(chapterNumber));
    formData.append("score", String(score));
    formData.append("total", String(total));

    const res = await fetch(`${API_BASE_URL}/dashboard/log-quiz`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to log quiz attempt");
    return res.json();
  },

  async evaluateAnswer(
    question: string,
    referenceAnswer?: string,
    studentAnswerText?: string,
    userId?: string,
    file?: File,
    bookId?: string,
    chapterNumber?: number
  ): Promise<EvaluationResponse> {
    const formData = new FormData();
    formData.append("question", question);
    if (referenceAnswer) {
      formData.append("reference_answer", referenceAnswer);
    }
    if (studentAnswerText) {
      formData.append("student_answer_text", studentAnswerText);
    }
    if (userId) {
      formData.append("user_id", userId);
    }
    if (file) {
      formData.append("file", file);
    }
    if (bookId) {
      formData.append("book_id", bookId);
    }
    if (chapterNumber !== undefined && chapterNumber !== null) {
      formData.append("chapter_number", String(chapterNumber));
    }

    const res = await fetch(`${API_BASE_URL}/dashboard/evaluate`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Answer evaluation failed");
    return res.json();
  },

  // Authentication API
  async register(formData: FormData): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed." }));
      throw new Error(err.detail || "Registration failed.");
    }
    return res.json();
  },

  async login(formData: FormData): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed." }));
      throw new Error(err.detail || "Incorrect email or password.");
    }
    return res.json();
  },

  // Admin Panel API
  async listUsers(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin/users`);
    if (!res.ok) {
      // Fallback relative route check
      const resFallback = await fetch(`${API_BASE_URL}/admin/users`);
      if (!resFallback.ok) throw new Error("Failed to load user directory.");
      return resFallback.json();
    }
    return res.json();
  },

  async deleteUser(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete user.");
  },

  async updateUserRole(userId: string, role: string): Promise<void> {
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("role", role);
    const res = await fetch(`${API_BASE_URL}/admin/users/role`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Failed to update user permissions.");
  },

  async approveBook(bookId: string, approved: number): Promise<void> {
    const formData = new FormData();
    formData.append("approved", String(approved));
    const res = await fetch(`${API_BASE_URL}/admin/books/approve/${bookId}`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Failed to update book approval status.");
  },

  async getSystemHealth(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/system/health`);
    if (!res.ok) throw new Error("Failed to fetch system telemetry.");
    return res.json();
  },

  async getSystemLogs(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/system/logs`);
    if (!res.ok) throw new Error("Failed to retrieve audit logs.");
    return res.json();
  },

  async listKnowledgeCandidates(status: "Pending" | "Approved" | "Rejected"): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/knowledge/candidates?status=${status}`);
    if (!res.ok) throw new Error("Failed to load knowledge candidates.");
    return res.json();
  },

  async verifyKnowledgeCandidate(candidateId: string, status: "Approved" | "Rejected" | "Pending"): Promise<void> {
    const formData = new FormData();
    formData.append("status", status);
    const res = await fetch(`${API_BASE_URL}/admin/knowledge/verify/${candidateId}`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Failed to verify knowledge candidate.");
  }
};

