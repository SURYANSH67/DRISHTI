import { useState, useEffect } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { api } from "../services/api";

interface MockFormViewProps {
  paperId: string;
}

export default function MockFormView({ paperId }: MockFormViewProps) {
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPaper = async () => {
      try {
        const papers = await api.getQuestionPapers();
        const found = papers.find((p) => p.id === paperId);
        if (found) {
          setPaper(found);
          // Parse questions
          const list = parseMarkdownQuestions(found.content);
          setQuestions(list);
          // Initialize answers state
          const initialAnswers: Record<string, string> = {};
          list.forEach((q) => {
            initialAnswers[q.question] = "";
          });
          setAnswers(initialAnswers);
        }
      } catch (err) {
        console.error("Failed to load paper details", err);
      } finally {
        setLoading(false);
      }
    };
    loadPaper();
  }, [paperId]);

  const parseMarkdownQuestions = (markdown: string) => {
    const list: any[] = [];
    const lines = markdown.split("\n");
    let currentQ: any = null;
    let currentSection = "General";

    let skipSection = false;

    lines.forEach((line) => {
      const stripped = line.trim();
      if (!stripped) return;

      if (stripped.startsWith("#") || (stripped.startsWith("Section") && stripped.includes(":")) || stripped.toLowerCase().startsWith("section")) {
        const secName = stripped.replace(/#/g, "").trim();
        const secLower = secName.toLowerCase();
        if (
          secLower.includes("answer key") || 
          secLower.includes("teacher answer") || 
          secLower.includes("solutions") || 
          secLower.includes("solution key") || 
          secLower.includes("model answer") || 
          secLower.includes("grading key")
        ) {
          skipSection = true;
        } else {
          skipSection = false;
          currentSection = secName;
        }
        return;
      }

      if (skipSection) return;

      // Check if numbered list item
      let isNumbered = false;
      let prefixLen = 0;
      for (let i = 0; i < Math.min(stripped.length, 5); i++) {
        const char = stripped[i];
        if (char >= "0" && char <= "9") continue;
        if (i > 0 && (char === "." || char === ")" || char === ":")) {
          isNumbered = true;
          prefixLen = i + 1;
          break;
        }
        break;
      }

      if (isNumbered) {
        if (currentQ) list.push(currentQ);
        const qText = stripped.substring(prefixLen).trim();
        let qType = "paragraph";
        const lower = qText.toLowerCase();
        if (lower.includes("choose") || lower.includes("mcq") || lower.includes("multiple choice")) {
          qType = "multiple_choice";
        } else if (lower.includes("true or false") || lower.includes("true/false")) {
          qType = "true_false";
        } else if (lower.includes("short answer") || lower.includes("[1 mark") || lower.includes("[2 mark")) {
          qType = "short_answer";
        }

        currentQ = {
          question: qText,
          type: qType,
          section: currentSection,
          choices: [],
        };
      } else if (currentQ && (stripped.startsWith("-") || stripped.startsWith("*") || /^[a-dA-D][\)\.]/.test(stripped))) {
        let choiceText = stripped;
        const prefixes = ["a)", "b)", "c)", "d)", "A)", "B)", "C)", "D)", "-", "*"];
        for (const pref of prefixes) {
          if (choiceText.startsWith(pref)) {
            choiceText = choiceText.substring(pref.length).trim();
            break;
          }
        }
        currentQ.choices.push(choiceText);
        currentQ.type = "multiple_choice";
      }
    });

    if (currentQ) list.push(currentQ);
    return list;
  };

  const handleAnswerChange = (question: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [question]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert("Please enter your name.");
      return;
    }

    setSubmitting(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${API_BASE_URL}/generator/papers/${paperId}/submit-mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          answers: answers,
        }),
      });

      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch (err) {
      alert("Failed to submit responses: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading student response sheet...</span>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-red-500 font-extrabold text-sm p-4 text-center">
        ⚠ Error: This classroom assessment does not exist or has been deleted.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-indigo-50/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-slate-200 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Response Submitted Successfully!</h2>
            <p className="text-xs text-slate-450 mt-1 font-semibold leading-relaxed">
              Thank you! Your classroom assessment answer sheet has been successfully registered and queued for RAG AI evaluation.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-slate-500 font-mono text-left space-y-1">
            <div>📄 <strong>Assessment:</strong> {paper.title}</div>
            <div>👤 <strong>Student Name:</strong> {studentName}</div>
            <div>📅 <strong>Submitted at:</strong> {new Date().toLocaleTimeString()}</div>
          </div>
          <button
            onClick={() => window.close()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex justify-center">
      <div className="max-w-2xl w-full space-y-4">
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-lg"></div>

        {/* Paper Title Card */}
        <div className="bg-white p-6 rounded-b-lg border-x border-b border-slate-200 shadow-sm space-y-3 border-l-4 border-l-indigo-600">
          <h1 className="text-xl font-black text-slate-800">{paper.title}</h1>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Please answer all questions below. Your answers will be graded by DRISHTI AI against the active course textbook syllabus.
          </p>
          <div className="text-[10px] text-red-500 font-bold border-t border-slate-100 pt-3 flex items-center gap-1">
            * Indicates required question
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Name Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <label className="text-xs font-extrabold text-slate-700 block">
              Student Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Your answer"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full max-w-sm border-b-2 border-slate-200 hover:border-slate-350 focus:border-indigo-600 focus:outline-none py-1.5 text-xs text-slate-800 transition-colors bg-transparent"
            />
          </div>

          {/* Question List Cards */}
          {questions.map((q, idx) => (
            <div key={idx} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div>
                {q.section && (
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded mb-2 inline-block">
                    {q.section}
                  </span>
                )}
                <h3 className="text-xs font-bold text-slate-800 leading-snug">{q.question}</h3>
              </div>

              {q.type === "multiple_choice" ? (
                <div className="space-y-2.5">
                  {q.choices.map((choice: string, cIdx: number) => (
                    <label key={cIdx} className="flex items-center gap-3 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${idx}`}
                        value={choice}
                        checked={answers[q.question] === choice}
                        onChange={() => handleAnswerChange(q.question, choice)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              ) : q.type === "true_false" ? (
                <div className="flex gap-6">
                  {["True", "False"].map((choice) => (
                    <label key={choice} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${idx}`}
                        value={choice}
                        checked={answers[q.question] === choice}
                        onChange={() => handleAnswerChange(q.question, choice)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  <textarea
                    placeholder="Your answer"
                    rows={q.type === "short_answer" ? 2 : 4}
                    value={answers[q.question] || ""}
                    onChange={(e) => handleAnswerChange(q.question, e.target.value)}
                    className="w-full border border-slate-200 hover:border-slate-350 focus:border-indigo-600 focus:outline-none rounded-lg p-3 text-xs text-slate-850 bg-slate-50/50"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Form Actions */}
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-indigo-650 hover:bg-indigo-755 disabled:bg-indigo-400 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow shadow-indigo-600/10"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Submitting..." : "Submit Response"}
            </button>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">DRISHTI Assessment Engine</span>
          </div>
        </form>
      </div>
    </div>
  );
}
