import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  FileText,
  Award,
  BarChart2,
  RefreshCw,
  Send,
  Camera,
  AlertTriangle,
  Info,
  LogOut,
  Book,
  Download,
  Menu,
  Sun,
  Moon
} from "lucide-react";
import { api } from "../services/api";
import type { BookOverview, ChatMessage, ContextSource, QuizQuestion } from "../services/api";
import MarkdownRenderer from "./MarkdownRenderer";

interface StudentPanelProps {
  user: any;
  books: BookOverview[];
  selectedBookId: string;
  setSelectedBookId: (id: string) => void;
  selectedChapterNum: number | null;
  setSelectedChapterNum: (num: number | null) => void;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}

type Tab = "dashboard" | "library" | "tutor" | "study-hub" | "quiz" | "grader";

export default function StudentPanel({
  user,
  books,
  selectedBookId,
  setSelectedBookId,
  selectedChapterNum,
  setSelectedChapterNum,
  onLogout,
  theme,
  toggleTheme
}: StudentPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedBook = books.find(b => b.book_id === selectedBookId);

  // Stats
  const [stats, setStats] = useState<any>({
    book_count: 0,
    total_formulas: 0,
    total_diagrams: 0,
    quizzes_taken_count: 0,
    evaluations_completed_count: 0,
    average_quiz_accuracy: 0,
    average_evaluation_score: 0,
    weak_chapters: [],
    recent_activity: []
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatSources, setChatSources] = useState<ContextSource[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Generator
  const [generatorType, setGeneratorType] = useState<"notes" | "summary" | "formulas" | "diagrams">("notes");
  const [generatingResource, setGeneratingResource] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{ title: string; content: string } | null>(null);

  // Quiz
  const [quizSettings, setQuizSettings] = useState({
    count: 5,
    difficulty: "Medium",
    types: ["MCQ", "Numerical", "HOTS", "Short Answer"]
  });
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Evaluator
  const [evalQuestion, setEvalQuestion] = useState("");
  const [evalRefAnswer, setEvalRefAnswer] = useState("");
  const [evalStudentText, setEvalStudentText] = useState("");
  const [evalFile, setEvalFile] = useState<File | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [useTextbookRef, setUseTextbookRef] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [selectedBookId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await api.getDashboardStats(user.id);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !selectedBookId) return;

    const userMsg: ChatMessage = { role: "user", content: currentMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setCurrentMessage("");
    setSendingMessage(true);

    try {
      const response = await api.tutorChat(
        selectedBookId,
        selectedChapterNum,
        userMsg.content,
        chatMessages
      );
      setChatMessages(prev => [...prev, { role: "assistant", content: response.answer }]);
      setChatSources(response.sources);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error: AI Tutor is currently offline." }]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleGenerateResource = async () => {
    if (!selectedBookId || !selectedChapterNum) return;
    setGeneratingResource(true);
    setGeneratedContent(null);
    try {
      const data = await api.generateResource(selectedBookId, selectedChapterNum, generatorType);
      setGeneratedContent({ title: data.title, content: data.content });
    } catch (err) {
      alert("Error compiling study notes.");
    } finally {
      setGeneratingResource(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedBookId || !selectedChapterNum) return;
    setGeneratingQuiz(true);
    setCurrentQuiz([]);
    setUserAnswers({});
    setQuizSubmitted(false);
    try {
      const data = await api.generateQuiz(
        selectedBookId,
        selectedChapterNum,
        quizSettings.count,
        quizSettings.difficulty,
        quizSettings.types
      );
      setCurrentQuiz(data.questions);
    } catch (err) {
      alert("Failed to assemble quiz.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const submitQuiz = async () => {
    let correct = 0;
    currentQuiz.forEach(q => {
      const uAns = userAnswers[q.id]?.trim().toLowerCase();
      const rAns = q.reference_answer.trim().toLowerCase();
      if (q.type === "MCQ") {
        if (uAns && (rAns.includes(uAns) || uAns.includes(rAns))) correct++;
      } else {
        if (uAns && (rAns.includes(uAns) || uAns.includes(rAns) || rAns.slice(0, 8) === uAns.slice(0, 8))) correct++;
      }
    });

    setQuizScore(correct);
    setQuizSubmitted(true);

    if (selectedChapterNum) {
      try {
        await api.logQuizAttempt(user.id, selectedBookId, selectedChapterNum, correct, currentQuiz.length);
        fetchStats();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleEvaluateAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalQuestion.trim() || (!useTextbookRef && !evalRefAnswer.trim())) return;
    setEvaluating(true);
    setEvalResult(null);
    try {
      const result = await api.evaluateAnswer(
        evalQuestion,
        useTextbookRef ? undefined : evalRefAnswer,
        evalStudentText || undefined,
        user.id,
        evalFile || undefined,
        selectedBookId || undefined,
        selectedChapterNum || undefined
      );
      setEvalResult(result);
      fetchStats();
    } catch (err) {
      alert("Evaluation engine failed to respond.");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row relative">
      {/* Sidebar Navigation */}
      <aside className={`h-screen sticky top-0 bg-slate-55/90 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-200/80 p-4 flex flex-col z-10 transition-all duration-300 shrink-0 ${sidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className={`flex ${sidebarCollapsed ? "flex-col items-center gap-3 mb-6" : "flex-row items-center justify-between gap-2 mb-8"}`}>
          <div className={`flex items-center gap-3 overflow-hidden ${sidebarCollapsed ? "justify-center" : ""}`}>
            <img 
              src="/drdo_logo.png" 
              alt="DRDO Logo" 
              className={`${sidebarCollapsed ? "w-8 h-8" : "w-10 h-10"} object-contain drop-shadow shrink-0 transition-all`} 
            />
            {!sidebarCollapsed && (
              <div className="min-w-0 transition-opacity duration-300">
                <h1 className="text-lg font-extrabold text-slate-800 leading-none truncate">DRISHTI</h1>
                <span className="text-[10px] text-purple-600 font-extrabold tracking-wide uppercase mt-0.5 block truncate">Student Panel</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 hover:bg-slate-200/80 text-slate-500 rounded-lg cursor-pointer block"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="mb-4 pb-4 border-b border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Welcome,</span>
            <span className="text-sm font-extrabold text-slate-800 truncate block">{user.name}</span>
          </div>
        )}

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            title="My Progress"
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "dashboard" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>My Progress</span>}
          </button>

          {!sidebarCollapsed && (
            <div className="pt-4 pb-2">
              <span className="px-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Resources</span>
            </div>
          )}

          <button
            onClick={() => setActiveTab("library")}
            title="Subject Library"
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "library" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Book className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Subject Library</span>}
          </button>

          {!sidebarCollapsed && (
            <div className="pt-4 pb-2">
              <span className="px-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">AI Study Desk</span>
            </div>
          )}

          <button
            onClick={() => setActiveTab("tutor")}
            title="AI Chapter Tutor"
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "tutor" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>AI Chapter Tutor</span>}
          </button>
          <button
            onClick={() => setActiveTab("study-hub")}
            title="Study Resource Hub"
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "study-hub" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Study Resource Hub</span>}
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            title="Adaptive Quiz"
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "quiz" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Adaptive Quiz</span>}
          </button>
          <button
            onClick={() => setActiveTab("grader")}
            title="Written Evaluations"
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "grader" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Camera className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Written Evaluations</span>}
          </button>
        </nav>

        {/* Selected book block */}
        <div className="mt-auto pt-4 space-y-4">
          {!sidebarCollapsed && books.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-2">
              <label className="text-[10px] text-slate-500 block font-bold uppercase">Active Textbook:</label>
              <select
                value={selectedBookId}
                onChange={(e) => {
                  setSelectedBookId(e.target.value);
                  setSelectedChapterNum(null);
                }}
                className="w-full px-2 py-1 bg-white border border-slate-350 rounded text-xs text-slate-800 focus:outline-none focus:border-purple-500"
              >
                {books.map(b => (
                  <option key={b.book_id} value={b.book_id}>{b.filename}</option>
                ))}
              </select>

              {selectedBook && (
                <>
                  <label className="text-[10px] text-slate-500 block font-bold uppercase">Active Chapter:</label>
                  <select
                    value={selectedChapterNum || ""}
                    onChange={(e) => setSelectedChapterNum(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2 py-1 bg-white border border-slate-350 rounded text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Entire Book</option>
                    {selectedBook.chapters.map((ch, idx) => (
                      <option key={idx} value={idx + 1}>Ch {idx + 1}: {ch.title.substring(0, 18)}...</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            className={`w-full flex items-center justify-center ${sidebarCollapsed ? "p-3" : "gap-2 py-2.5"} mb-2 rounded-xl border border-slate-200 hover:bg-slate-100 hover:text-slate-800 text-slate-500 text-xs font-bold transition-all bg-white cursor-pointer`}
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4 shrink-0 text-purple-600" />
                {!sidebarCollapsed && <span>Dark Mode</span>}
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 shrink-0 text-amber-500" />
                {!sidebarCollapsed && <span>Light Mode</span>}
              </>
            )}
          </button>

          <button
            onClick={onLogout}
            title="Logout"
            className={`w-full flex items-center justify-center ${sidebarCollapsed ? "p-3" : "gap-2 py-2.5"} rounded-xl border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-500 text-xs font-bold transition-all bg-white cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full z-10">
        
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Student Learning Dashboard</h2>
                <p className="text-slate-500 text-sm mt-1">Review your syllabus logs, score analytics, and weak chapters.</p>
              </div>
              <button onClick={fetchStats} className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} /></button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Syllabus books</span>
                <span className="text-2xl font-bold mt-1 block text-slate-800">{stats.book_count}</span>
                <span className="text-[9px] text-slate-400 mt-2 block">Approved resource lists</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Formulas Sheet</span>
                <span className="text-2xl font-bold mt-1 block text-slate-800">{stats.total_formulas}</span>
                <span className="text-[9px] text-slate-400 mt-2 block">Extracted expressions</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Visual Diagrams</span>
                <span className="text-2xl font-bold mt-1 block text-slate-800">{stats.total_diagrams}</span>
                <span className="text-[9px] text-slate-400 mt-2 block">Extracted charts & tables</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Quiz Accuracy</span>
                <span className="text-2xl font-bold mt-1 block text-slate-800">{stats.average_quiz_accuracy}%</span>
                <span className="text-[9px] text-slate-400 mt-2 block">{stats.quizzes_taken_count} Attempts registered</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-6 rounded-2xl md:col-span-1">
                <h3 className="text-md font-extrabold mb-4 flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" /> Weak Chapters
                </h3>
                {stats.weak_chapters.length === 0 ? (
                  <p className="text-slate-500 text-xs py-6 text-center">Excellent! All chapter quiz scores are above 70%.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.weak_chapters.map((ch: any, idx: number) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded-xl flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700">Chapter {ch.chapter_number}</span>
                        <span className="font-bold text-red-600">{ch.avg_score.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel p-6 rounded-2xl md:col-span-2">
                <h3 className="text-md font-extrabold mb-4 text-slate-800">Eval & Quiz History Logs</h3>
                {stats.recent_activity.length === 0 ? (
                  <p className="text-slate-500 text-xs py-8 text-center">No learning logs recorded yet. Attempt a quiz or grade a sheet to populate statistics.</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {stats.recent_activity.map((act: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white/60 border border-slate-200/65 rounded-xl flex justify-between items-center text-xs shadow-sm">
                        <div>
                          <span className="font-bold text-slate-700 block">{act.type === "Quiz" ? `Chapter ${act.chapter_number} Quiz` : "Assignment Grading"}</span>
                          <span className="text-[10px] text-slate-400 block">{new Date(act.timestamp).toLocaleDateString()}</span>
                        </div>
                        <span className="font-bold text-slate-800">{act.type === "Quiz" ? `${act.score}/${act.total}` : `${act.score}/10`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subject Library */}
        {activeTab === "library" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Subject Library</h2>
                <p className="text-slate-500 text-sm mt-1">Browse uploaded textbooks by subject. Download PDFs and explore chapter details.</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{books.length} Books Available</span>
            </div>

            {books.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Book className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-500 text-sm font-semibold">No textbooks available yet.</p>
                <p className="text-slate-400 text-xs">Your teacher hasn't uploaded any syllabus materials. Check back later.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Group books by subject */}
                {Object.entries(
                  books.reduce((acc, b) => {
                    const subject = b.subject_name || "General";
                    if (!acc[subject]) acc[subject] = [];
                    acc[subject].push(b);
                    return acc;
                  }, {} as Record<string, BookOverview[]>)
                ).map(([subject, subjectBooks]) => (
                  <div key={subject} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-extrabold uppercase tracking-wide">
                        {subject}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{subjectBooks.length} {subjectBooks.length === 1 ? "Book" : "Books"}</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {subjectBooks.map(b => (
                        <div key={b.book_id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <Book className="w-8 h-8 text-purple-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-slate-800 truncate">{b.filename}</h4>
                                {b.uploaded_by && (
                                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Uploaded by Faculty</span>
                                )}
                              </div>
                            </div>
                            <a
                              href={api.getBookDownloadUrl(b.book_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer shadow shadow-purple-600/10 shrink-0"
                            >
                              <Download className="w-3 h-3" />
                              Download PDF
                            </a>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <span className="text-[8px] text-slate-400 font-bold block uppercase">Pages</span>
                              <span className="text-xs font-extrabold text-slate-800 block">{b.total_pages}</span>
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <span className="text-[8px] text-slate-400 font-bold block uppercase">Chapters</span>
                              <span className="text-xs font-extrabold text-slate-800 block">{b.chapters.length}</span>
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <span className="text-[8px] text-slate-400 font-bold block uppercase">Formulas</span>
                              <span className="text-xs font-extrabold text-slate-800 block">{b.formula_count}</span>
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <span className="text-[8px] text-slate-400 font-bold block uppercase">Diagrams</span>
                              <span className="text-xs font-extrabold text-slate-800 block">{b.image_count}</span>
                            </div>
                          </div>

                          {b.chapters.length > 0 && (
                            <div className="border-t border-slate-100 pt-2 space-y-1.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Chapter Index</span>
                              <div className="flex flex-wrap gap-1.5">
                                {b.chapters.map((ch, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setSelectedBookId(b.book_id);
                                      setSelectedChapterNum(idx + 1);
                                      setActiveTab("tutor");
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 hover:border-purple-200 rounded text-[9px] text-slate-600 font-bold transition-colors cursor-pointer"
                                  >
                                    Ch {idx + 1}: {ch.title.length > 22 ? ch.title.substring(0, 22) + "…" : ch.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Tutor */}
        {activeTab === "tutor" && (
          <div className="h-[75vh] flex flex-col md:flex-row gap-6">
            <div className="flex-1 glass-panel rounded-2xl flex flex-col min-w-0">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">AI Chapter Tutor</h3>
                  <p className="text-xs text-slate-500">Grounded exclusively in: <span className="text-purple-600 font-bold">{selectedBook?.filename || "No book selected"}</span></p>
                </div>
                <button onClick={() => setChatMessages([])} className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold border border-slate-250 transition-colors">Clear</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/40">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center max-w-sm mx-auto">
                    <MessageSquare className="w-10 h-10 text-purple-400 mb-2 animate-bounce" />
                    <span className="font-bold text-slate-700">Ask the RAG Assistant</span>
                    <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">Ask scientific questions, query equations, or draft student reading guides. Context is automatically grounded in your uploaded textbook.</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                        msg.role === "user" ? "bg-purple-600 text-white rounded-br-none" : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm"
                      }`}>
                        {msg.role === "user" ? msg.content : <MarkdownRenderer content={msg.content} />}
                      </div>
                    </div>
                  ))
                )}
                {sendingMessage && (
                  <div className="flex justify-start">
                    <span className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2 shadow-sm">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" /> Thinking...
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-200 flex gap-2 bg-white/60">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Ask a question about the active chapter..."
                  disabled={sendingMessage || !selectedBookId}
                  className="flex-1 glass-input px-4 py-3 rounded-xl text-sm"
                />
                <button type="submit" disabled={sendingMessage || !currentMessage.trim()} className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"><Send className="w-4 h-4" /></button>
              </form>
            </div>

            <div className="w-full md:w-72 glass-panel rounded-2xl p-4 flex flex-col overflow-y-auto">
              <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2 border-b border-slate-100 pb-2"><Info className="w-4 h-4 text-purple-500" /> Citations</h4>
              <div className="space-y-3">
                {chatSources.map((src, idx) => (
                  <div key={idx} className="p-3 bg-white/80 border border-slate-200/80 rounded-xl space-y-1 shadow-sm">
                    <span className="text-[10px] text-purple-600 font-bold block">Page {src.page_number}</span>
                    <p className="text-xs text-slate-650 italic">"{src.text.substring(0, 100)}..."</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Study Resource Hub */}
        {activeTab === "study-hub" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-1 space-y-4 h-fit border border-slate-200/80 shadow-md">
              <div>
                <label className="text-xs font-bold text-slate-550 block mb-1.5 uppercase">Guide Format</label>
                <div className="space-y-2">
                  {[
                    { type: "notes", label: "Revision Notes" },
                    { type: "summary", label: "Summary & Flashcards" },
                    { type: "formulas", label: "Formula Sheet" },
                    { type: "diagrams", label: "Diagram notebook" }
                  ].map((opt) => (
                    <label key={opt.type} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 hover:bg-slate-100/50">
                      <input
                        type="radio"
                        name="resource_type"
                        value={opt.type}
                        checked={generatorType === opt.type}
                        onChange={() => setGeneratorType(opt.type as any)}
                        className="accent-purple-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerateResource}
                disabled={generatingResource || !selectedChapterNum}
                className="w-full py-3 bg-purple-600 hover:bg-purple-750 disabled:bg-slate-200 disabled:text-slate-400 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-purple-600/5"
              >
                {generatingResource ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Compile Notes"}
              </button>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-3 min-h-[50vh] flex flex-col border border-slate-200/80 shadow-md">
              {generatedContent ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">{generatedContent.title}</h3>
                  </div>
                  <MarkdownRenderer content={generatedContent.content} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                  <FileText className="w-12 h-12 text-slate-300 mb-2" />
                  <span className="text-xs">Select an active chapter on the sidebar to compile revision sheets.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz portal */}
        {activeTab === "quiz" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-1 space-y-4 h-fit border border-slate-200/80 shadow-md">
              <label className="text-xs font-bold text-slate-500 block mb-1 uppercase">Difficulty</label>
              <select
                value={quizSettings.difficulty}
                onChange={(e) => setQuizSettings(prev => ({ ...prev, difficulty: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard (HOTS)</option>
              </select>

              <button
                onClick={handleGenerateQuiz}
                disabled={generatingQuiz || !selectedChapterNum}
                className="w-full py-3 bg-purple-600 hover:bg-purple-750 disabled:bg-slate-200 disabled:text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2"
              >
                {generatingQuiz ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Start quiz"}
              </button>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-3 min-h-[50vh] flex flex-col border border-slate-200/80 shadow-md">
              {currentQuiz.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <h3 className="text-md font-bold text-slate-800">Concept Check Test ({quizSettings.difficulty})</h3>
                    {quizSubmitted && <span className="text-xs font-bold text-purple-600">Score: {quizScore}/{currentQuiz.length}</span>}
                  </div>

                  <div className="space-y-4">
                    {currentQuiz.map((q, idx) => (
                      <div key={q.id} className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3 shadow-sm">
                        <h4 className="font-semibold text-slate-800 text-xs">{idx + 1}. {q.text}</h4>
                        {q.type === "MCQ" && q.options ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6">
                            {q.options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => !quizSubmitted && setUserAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                className={`p-2.5 text-left rounded-xl text-xs font-semibold border transition-all ${
                                  userAnswers[q.id] === opt ? "bg-purple-50 border-purple-500 text-purple-700" : "bg-white border-slate-350 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            value={userAnswers[q.id] || ""}
                            onChange={(e) => !quizSubmitted && setUserAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Type calculations or responses..."
                            rows={2}
                            className="w-full glass-input p-3 rounded-xl text-xs"
                          />
                        )}

                        {quizSubmitted && (
                          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs">
                            <span className="text-[10px] text-emerald-600 font-bold block uppercase mb-1">Answer key:</span>
                            <p className="text-slate-700">{q.reference_answer}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {!quizSubmitted ? (
                    <button onClick={submitQuiz} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">Grade quiz</button>
                  ) : (
                    <button onClick={handleGenerateQuiz} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors">Try another</button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Award className="w-12 h-12 text-slate-300 mb-2" />
                  <span className="text-xs">Configure quiz parameters and start assessment.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Written evaluations grader */}
        {activeTab === "grader" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-1 space-y-4 h-fit border border-slate-200/80 shadow-md">
              <h3 className="text-md font-bold text-slate-800">Grading Desk</h3>
              <form onSubmit={handleEvaluateAnswer} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Question prompt</label>
                  <textarea value={evalQuestion} onChange={(e) => setEvalQuestion(e.target.value)} placeholder={useTextbookRef ? "Question prompt (Optional - AI will auto-detect from submission)..." : "Question prompt..."} rows={2} className="w-full glass-input p-3 rounded-xl text-xs bg-white" required={!useTextbookRef} />
                </div>
                {selectedBookId && (
                  <div className="flex items-center justify-between p-2.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-purple-755 dark:text-purple-300">Textbook RAG Auto-Grading</span>
                      <span className="text-[9px] text-slate-500 leading-tight">Use active textbook as the reference answer key.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useTextbookRef}
                        onChange={(e) => setUseTextbookRef(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                )}

                {!useTextbookRef ? (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Model answer key</label>
                    <textarea value={evalRefAnswer} onChange={(e) => setEvalRefAnswer(e.target.value)} placeholder="Reference answer..." rows={2} className="w-full glass-input p-3 rounded-xl text-xs bg-white" required />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/60 rounded-xl text-[10px] text-slate-500 font-semibold leading-relaxed">
                    ℹ️ Reference answer will be automatically retrieved by querying the textbook: 
                    <span className="text-purple-650 dark:text-purple-400 font-bold block mt-0.5 truncate">{selectedBook?.filename || "Active Textbook"}</span>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Upload handwriting copy</label>
                  <input type="file" onChange={(e) => setEvalFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-600 bg-white p-2 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Or type response</label>
                  <textarea value={evalStudentText} onChange={(e) => setEvalStudentText(e.target.value)} placeholder="Type student answer..." rows={2} className="w-full glass-input p-3 rounded-xl text-xs bg-white" />
                </div>
                <button type="submit" disabled={evaluating} className="w-full py-3 bg-purple-600 hover:bg-purple-750 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                  {evaluating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Evaluate submission"}
                </button>
              </form>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 min-h-[50vh] flex flex-col border border-slate-200/80 shadow-md">
              {evalResult ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <h3 className="font-extrabold text-slate-800">Grading Report Card</h3>
                    <span className="text-2xl font-bold text-purple-600">{evalResult.score}/10</span>
                  </div>
                  {evalResult.handwriting_ocr_text && (
                    <div className="p-3 bg-slate-100 border border-slate-250 rounded-xl text-xs shadow-sm">
                      <span className="font-bold text-slate-500 block mb-1 uppercase text-[10px]">OCR Text:</span>
                      <p className="text-slate-700 italic">"{evalResult.handwriting_ocr_text}"</p>
                    </div>
                  )}
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-650"><strong className="text-slate-800">Accuracy:</strong> {evalResult.concept_accuracy}</p>
                    <p className="text-slate-650"><strong className="text-slate-800">Suggestions:</strong> {evalResult.suggestions}</p>
                    <p className="text-slate-650"><strong className="text-slate-800">Feedback:</strong> {evalResult.overall_feedback}</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Camera className="w-12 h-12 text-slate-300 mb-2" />
                  <span className="text-xs">Submit written response copy to grade against model keys.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
