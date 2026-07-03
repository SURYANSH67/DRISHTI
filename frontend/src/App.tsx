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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline">("online");

  // Load authenticated user profile and theme settings on mount
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

    const cachedTheme = localStorage.getItem("drishti_theme") as "light" | "dark";
    if (cachedTheme) {
      setTheme(cachedTheme);
      document.documentElement.classList.toggle("dark", cachedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);

  // Poll network status from the server
  useEffect(() => {
    if (!user) return;
    const checkNetwork = async () => {
      try {
        const data = await api.getNetworkStatus();
        setNetworkStatus(data.status);
      } catch (err) {
        setNetworkStatus("offline");
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch available books database once logged in
  useEffect(() => {
    if (user) {
      fetchBooks();
    }
  }, [user]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("drishti_theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

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
    return <AuthView onAuthSuccess={handleAuthSuccess} theme={theme} toggleTheme={toggleTheme} />;
  }

  // 2. Render Admin Panel Workspace
  if (user.role === "Administrator") {
    return (
      <AdminPanel
        user={user}
        books={books}
        fetchBooks={fetchBooks}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        networkStatus={networkStatus}
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
        theme={theme}
        toggleTheme={toggleTheme}
        networkStatus={networkStatus}
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
      theme={theme}
      toggleTheme={toggleTheme}
      networkStatus={networkStatus}
    />
  );
}
