import { useState, useEffect } from "react";
import AuthView from "./components/AuthView";
import StudentPanel from "./components/StudentPanel";
import TeacherPanel from "./components/TeacherPanel";
import AdminPanel from "./components/AdminPanel";
import { api } from "./services/api";
import type { BookOverview } from "./services/api";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [books, setBooks] = useState<BookOverview[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [selectedChapterNum, setSelectedChapterNum] = useState<number | null>(null);

  // Load authenticated user profile from local cache on mount
  useEffect(() => {
    const cachedUser = localStorage.getItem("drishti_user");
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setUser(parsed);
      } catch (err) {
        localStorage.removeItem("drishti_user");
      }
    }
  }, []);

  // Fetch available books database once logged in
  useEffect(() => {
    if (user) {
      fetchBooks();
    }
  }, [user]);

  const fetchBooks = async () => {
    try {
      // Retrieve text books list filtered by user role permissions
      const data = await api.listBooks(user?.role);
      setBooks(data);
      if (data.length > 0 && !selectedBookId) {
        setSelectedBookId(data[0].book_id);
      }
    } catch (err) {
      console.error("Error loading syllabus database:", err);
    }
  };

  const handleAuthSuccess = (authenticatedUser: any) => {
    localStorage.setItem("drishti_user", JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("drishti_user");
    setUser(null);
    setBooks([]);
    setSelectedBookId("");
    setSelectedChapterNum(null);
  };

  // 1. If not logged in, redirect to authentication (Login / Registration)
  if (!user) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  // 2. Render Admin Panel Workspace
  if (user.role === "Administrator") {
    return (
      <AdminPanel
        user={user}
        books={books}
        fetchBooks={fetchBooks}
        onLogout={handleLogout}
      />
    );
  }

  // 3. Render Teacher Panel Workspace
  if (user.role === "Teacher") {
    return (
      <TeacherPanel
        user={user}
        books={books}
        selectedBookId={selectedBookId}
        setSelectedBookId={setSelectedBookId}
        selectedChapterNum={selectedChapterNum}
        setSelectedChapterNum={setSelectedChapterNum}
        fetchBooks={fetchBooks}
        onLogout={handleLogout}
      />
    );
  }

  // 4. Default / Student panel view
  return (
    <StudentPanel
      user={user}
      books={books}
      selectedBookId={selectedBookId}
      setSelectedBookId={setSelectedBookId}
      selectedChapterNum={selectedChapterNum}
      setSelectedChapterNum={setSelectedChapterNum}
      onLogout={handleLogout}
    />
  );
}
