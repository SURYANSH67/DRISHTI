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
  LogOut
} from "lucide-react";
import { api } from "../services/api";
import type { BookOverview } from "../services/api";

interface AdminPanelProps {
  user: any;
  books: BookOverview[];
  fetchBooks: () => void;
  onLogout: () => void;
}

type Tab = "users" | "books" | "telemetry";

export default function AdminPanel({
  user,
  books,
  fetchBooks,
  onLogout
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
    <div className="flex-1 flex flex-col md:flex-row relative">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-55/90 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-200/80 p-6 flex flex-col z-10">
        <div className="flex items-center gap-3 mb-8">
          <img 
            src="/drdo_logo.png" 
            alt="DRDO Logo" 
            className="w-10 h-10 object-contain drop-shadow" 
          />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 leading-none">DRISHTI</h1>
            <span className="text-[10px] text-purple-650 font-extrabold tracking-wide uppercase mt-0.5 block">Admin Panel</span>
          </div>
        </div>

        <div className="mb-4 pb-4 border-b border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Administrator:</span>
          <span className="text-sm font-extrabold text-slate-800 truncate block">{user.name}</span>
        </div>

        <nav className="flex-1 space-y-1.5">
          <button
            onClick={() => setActiveTab("users")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "users" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            Manage Users
          </button>
          <button
            onClick={() => setActiveTab("books")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "books" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Approve Textbooks
          </button>
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "telemetry" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            System Health
          </button>
        </nav>

        <div className="mt-auto">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-red-50 hover:text-red-650 text-slate-550 text-xs font-bold transition-all bg-white"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full z-10">
        
        {/* Manage Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight font-heading text-slate-800">User Directory Management</h2>
                <p className="text-slate-550 text-sm mt-1">Audit active user accounts, modify permission levels, or remove users.</p>
              </div>
              <button onClick={loadAdminData} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-650 hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200/80 shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-4">Name / Email</th>
                      <th className="p-4">Affiliation / Org</th>
                      <th className="p-4">System Role</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 text-xs bg-white/40">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-slate-500 text-[10px]">{u.email}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-800 block font-semibold">{u.school}</span>
                          <span className="text-slate-500 text-[10px]">{u.department} {u.enrollment_number && `• ID: ${u.enrollment_number}`}</span>
                        </td>
                        <td className="p-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-850 focus:outline-none"
                          >
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 bg-red-50 border border-red-100 text-red-550 hover:bg-red-100 rounded-lg transition-colors"
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
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight font-heading text-slate-800">Approve Textbook Materials</h2>
                <p className="text-slate-550 text-sm mt-1">Review student/faculty uploaded books and toggle library visibility approval status.</p>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-200/80 shadow-md">
              <h3 className="text-lg font-bold mb-4 text-slate-850">Textbook Registry</h3>
              {books.length === 0 ? (
                <p className="text-slate-500 text-xs py-8 text-center">No textbooks registered in the DRISHTI framework database.</p>
              ) : (
                <div className="space-y-4">
                  {books.map(b => (
                    <div key={b.book_id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-start gap-3 min-w-0">
                        <BookOpen className="w-8 h-8 text-purple-650 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 truncate max-w-md">{b.filename}</h4>
                          <span className="text-[10px] text-slate-500 mt-1 block">ID: {b.book_id} • Pages: {b.total_pages}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status badge */}
                        {b.approved ? (
                          <button
                            onClick={() => handleApproveBook(b.book_id, 0)}
                            className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" /> Approved
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproveBook(b.book_id, 1)}
                            className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
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
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight font-heading text-slate-800">System Telemetry & Health</h2>
              <p className="text-slate-550 text-sm mt-1">Audit active API queries logs, system databases size, and user registrations statistics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Telemetry card */}
              <div className="glass-panel p-6 rounded-2xl md:col-span-1 space-y-4 border border-slate-200/80 shadow-md">
                <h3 className="text-md font-bold mb-2 flex items-center gap-2 text-purple-650"><Cpu className="w-4 h-4" /> Health Metrics</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Framework Status:</span>
                    <span className="font-extrabold text-emerald-650">{healthStats.system_status}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Database File Size:</span>
                    <span className="font-extrabold text-slate-800">{healthStats.db_size_kb} KB</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">User Directory Count:</span>
                    <span className="font-extrabold text-slate-800">{healthStats.total_users} Users</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Total Textbooks:</span>
                    <span className="font-extrabold text-slate-800">{healthStats.total_books} Books</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Approved Library:</span>
                    <span className="font-extrabold text-slate-800">{healthStats.approved_books} Approved</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Quiz Checked Logs:</span>
                    <span className="font-extrabold text-slate-800">{healthStats.total_quizzes_taken} Taken</span>
                  </div>
                </div>
              </div>

              {/* System logs table */}
              <div className="glass-panel p-6 rounded-2xl md:col-span-2 space-y-4 border border-slate-200/80 shadow-md">
                <h3 className="text-md font-bold mb-2 flex items-center gap-2 text-slate-850"><Database className="w-4 h-4 text-purple-650" /> Audit Access Logs</h3>
                {systemLogs.length === 0 ? (
                  <p className="text-slate-500 text-xs py-8 text-center">No system log files stored yet.</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {systemLogs.map(log => (
                      <div key={log.id} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs shadow-sm">
                        <div>
                          <span className="font-bold text-slate-850 block">{log.endpoint}</span>
                          <span className="text-[10px] text-slate-500 block">Requester: {log.user_id || "Anonymous"}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
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
