import { useState, useEffect } from "react";
import {
  Users,
  BookOpen,
  Activity,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Cpu,
  Database,
  LogOut,
  Sun,
  Moon
} from "lucide-react";
import { api } from "../services/api";
import type { BookOverview } from "../services/api";

interface AdminPanelProps {
  user: any;
  books: BookOverview[];
  fetchBooks: () => void;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}

type Tab = "users" | "books" | "telemetry";

export default function AdminPanel({
  user,
  books,
  fetchBooks,
  onLogout,
  theme,
  toggleTheme
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  // Telemetry & Users lists
  const [usersList, setUsersList] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [healthStats, setHealthStats] = useState<any>({
    db_size_kb: 0,
    total_users: 0,
    total_books: 0,
    approved_books: 0,
    pending_books: 0,
    total_quizzes_taken: 0,
    system_status: "Healthy",
    storage_path: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (activeTab === "users") {
        const data = await api.listUsers();
        setUsersList(data);
      } else if (activeTab === "telemetry") {
        const health = await api.getSystemHealth();
        setHealthStats(health);
        const logs = await api.getSystemLogs();
        setSystemLogs(logs);
      }
    } catch (err) {
      console.error("Error loading admin stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user.id) {
      alert("You cannot delete your own Administrator account!");
      return;
    }
    if (!confirm("Are you sure you want to delete this user? All their grading logs and progress records will be cleared.")) return;
    try {
      await api.deleteUser(userId);
      setUsersList(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert("Failed to delete user.");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert("User role updated successfully.");
    } catch (err) {
      alert("Failed to update role.");
    }
  };

  const handleApproveBook = async (bookId: string, approved: number) => {
    try {
      await api.approveBook(bookId, approved);
      fetchBooks();
      alert(`Book status updated successfully.`);
    } catch (err) {
      alert("Failed to update book approval status.");
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-900/90 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col z-10 shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <img 
            src="/drdo_logo.png" 
            alt="DRDO Logo" 
            className="w-10 h-10 object-contain drop-shadow" 
          />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 dark:text-white leading-none">DRISHTI</h1>
            <span className="text-[10px] text-purple-650 dark:text-purple-400 font-extrabold tracking-wide uppercase mt-0.5 block">Admin Panel</span>
          </div>
        </div>

        <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Administrator:</span>
          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate block">{user.name}</span>
        </div>

        <nav className="flex-1 space-y-1.5">
          <button
            onClick={() => setActiveTab("users")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-205 cursor-pointer ${
              activeTab === "users" 
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Manage Users
          </button>
          <button
            onClick={() => setActiveTab("books")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-205 cursor-pointer ${
              activeTab === "books" 
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Approve Textbooks
          </button>
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-205 cursor-pointer ${
              activeTab === "telemetry" 
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            System Health
          </button>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold transition-all bg-white dark:bg-slate-900 cursor-pointer shadow-sm"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4 shrink-0 text-purple-650" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Light Mode</span>
              </>
            )}
          </button>

          <button
            onClick={onLogout}
            title="Logout"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-650 dark:hover:text-red-400 text-slate-550 dark:text-slate-450 text-xs font-bold transition-all bg-white dark:bg-slate-900 cursor-pointer shadow-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full z-10 space-y-6">
        
        {/* Manage Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-2">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight font-heading text-slate-850 dark:text-white">User Directory Management</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Audit active user accounts, modify permission levels, or remove users.</p>
              </div>
              <button 
                onClick={loadAdminData} 
                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-350 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-4">Name / Email</th>
                      <th className="p-4">Affiliation / Org</th>
                      <th className="p-4">System Role</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">{u.name}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px]">{u.email}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-800 dark:text-slate-200 block font-semibold">{u.school}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px]">{u.department} {u.enrollment_number && `• ID: ${u.enrollment_number}`}</span>
                        </td>
                        <td className="p-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-600 cursor-pointer"
                          >
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Approve Books Tab */}
        {activeTab === "books" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-2">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight font-heading text-slate-850 dark:text-white">Approve Textbook Materials</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review student/faculty uploaded books and toggle library visibility approval status.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
              <h3 className="text-lg font-bold text-slate-850 dark:text-white">Textbook Registry</h3>
              {books.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-xs py-8 text-center">No textbooks registered in the DRISHTI database.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {books.map(b => (
                    <div key={b.book_id} className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-start gap-3 min-w-0">
                        <BookOpen className="w-8 h-8 text-purple-650 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate max-w-md" title={b.filename}>{b.filename}</h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">ID: {b.book_id} • Pages: {b.total_pages}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {b.approved ? (
                          <button
                            onClick={() => handleApproveBook(b.book_id, 0)}
                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" /> Approved
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproveBook(b.book_id, 1)}
                            className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> Pending
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Telemetry Tab */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            <div className="pb-2">
              <h2 className="text-3xl font-extrabold tracking-tight font-heading text-slate-850 dark:text-white">System Telemetry & Health</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Audit active API queries logs, system databases size, and user registrations statistics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Telemetry card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl md:col-span-1 space-y-4 shadow-md">
                <h3 className="text-md font-bold mb-2 flex items-center gap-2 text-purple-650"><Cpu className="w-4 h-4" /> Health Metrics</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px]">Framework Status:</span>
                    <span className="font-extrabold text-emerald-650 dark:text-emerald-400">{healthStats.system_status}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px]">Database File Size:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{healthStats.db_size_kb} KB</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px]">User Directory Count:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{healthStats.total_users} Users</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px]">Total Textbooks:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{healthStats.total_books} Books</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px]">Approved Library:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{healthStats.approved_books} Approved</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px]">Quiz Checked Logs:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{healthStats.total_quizzes_taken} Taken</span>
                  </div>
                </div>
              </div>

              {/* System logs table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl md:col-span-2 space-y-4 shadow-md">
                <h3 className="text-md font-bold mb-2 flex items-center gap-2 text-slate-850 dark:text-white"><Database className="w-4 h-4 text-purple-650" /> Audit Access Logs</h3>
                {systemLogs.length === 0 ? (
                  <p className="text-slate-550 dark:text-slate-400 text-xs py-8 text-center">No system log files stored yet.</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {systemLogs.map(log => (
                      <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs shadow-sm">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-850 dark:text-slate-200 block truncate">{log.endpoint}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">Requester: {log.user_id || "Anonymous"}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
