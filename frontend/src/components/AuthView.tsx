import { useState } from "react";
import { api } from "../services/api";
import { Key, Mail, User, GraduationCap, School, Layers, ChevronDown, Sun, Moon } from "lucide-react";

interface AuthViewProps {
  onAuthSuccess: (user: any) => void;
  theme: string;
  toggleTheme: () => void;
}

export default function AuthView({ onAuthSuccess, theme, toggleTheme }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Registration state fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Student");
  const [school, setSchool] = useState("");
  const [department, setDepartment] = useState("");
  const [enrollment, setEnrollment] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();

    if (isLogin) {
      formData.append("email", email);
      formData.append("password", password);
      
      try {
        const res = await api.login(formData);
        onAuthSuccess(res.user);
      } catch (err: any) {
        setError(err.message || "Failed to log in.");
      } finally {
        setLoading(false);
      }
    } else {
      // Registration checks
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }
      
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("role", role);
      formData.append("school", school);
      formData.append("department", department);
      formData.append("enrollment_number", enrollment);

      try {
        await api.register(formData);
        alert("Account registered successfully! You can now log in.");
        setIsLogin(true);
        // Clear registration states
        setName("");
        setPassword("");
        setConfirmPassword("");
      } catch (err: any) {
        setError(err.message || "Registration failed.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-[90vh] px-4">
      {/* Background glowing vectors - soft light mode style */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-purple-300/30 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-300/40 blur-[130px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-slate-200/80 shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          type="button"
          className="absolute top-4 right-4 p-2 bg-slate-100/50 hover:bg-slate-200/50 border border-slate-250 text-slate-600 dark:text-slate-350 hover:text-purple-650 rounded-xl transition-colors cursor-pointer"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        
        {/* Title branding header with DRDO logo */}
        <div className="text-center mb-6">
          <img 
            src="/drdo_logo.png" 
            alt="DRDO Logo" 
            className="w-20 h-20 mx-auto object-contain mb-3 drop-shadow-md" 
          />
          <h2 className="text-2xl font-extrabold text-slate-800">
            DRISHTI AI
          </h2>
          <p className="text-slate-500 text-[11px] mt-1 font-semibold">
            Defence Research Intelligent Study, Tutoring & Hybrid Intelligence
          </p>
        </div>

        {/* Toggle navigation - Light theme styling */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
          <button
            onClick={() => { setIsLogin(true); setError(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isLogin ? "bg-white text-purple-700 shadow-md shadow-purple-600/5" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Login Securely
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              !isLogin ? "bg-white text-purple-700 shadow-md shadow-purple-600/5" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {error && (
            <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="email@drishti.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-xs"
              />
            </div>
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Confirm Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">University / Org</label>
                  <div className="relative">
                    <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. DRDO"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Department</label>
                  <div className="relative">
                    <Layers className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Electronics"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Enrollment (Optional)</label>
                <input
                  type="text"
                  placeholder="ID Number / Enrollment"
                  value={enrollment}
                  onChange={(e) => setEnrollment(e.target.value)}
                  className="w-full glass-input px-4 py-2.5 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Select Account Role</label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full glass-input pl-10 pr-10 py-2.5 rounded-xl text-xs cursor-pointer bg-white appearance-none"
                  >
                    <option value="Student">Student Account</option>
                    <option value="Teacher">Teacher Account</option>
                    <option value="Administrator">Administrator Account</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-750 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold rounded-xl text-sm transition-colors shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              isLogin ? "Authenticate" : "Create Account"
            )}
          </button>

          {isLogin && (
            <div className="text-center pt-2">
              <span className="text-[10px] text-slate-500 block font-semibold">Default Admin Login: admin@drishti.org / admin123</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// Simple loader helper inside AuthView
function RefreshCw(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
