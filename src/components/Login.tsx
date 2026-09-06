import { useState } from 'react';
import { GraduationCap, ScanLine, Mail, Lock, LogIn, Sun, Moon } from 'lucide-react';
import { login } from '@/lib/auth';
import type { Role, User } from '@/lib/types';
import { useToast } from '@/components/Toast';

type LoginProps = {
  onLogin: (user: User) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export default function Login({ onLogin, theme, onToggleTheme }: LoginProps) {
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState('student@college.edu');
  const [password, setPassword] = useState('student123');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const switchRole = (r: Role) => {
    setRole(r);
    if (r === 'student') {
      setEmail('student@college.edu');
      setPassword('student123');
    } else {
      setEmail('teacher@college.edu');
      setPassword('teacher123');
    }
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = login(email, password);
    if (user) {
      toast(`Welcome, ${user.name}!`, 'success');
      onLogin(user);
    } else {
      setError('Invalid credentials. Please check your email and password.');
      toast('Login failed', 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4 relative">
      <button
        onClick={onToggleTheme}
        className="absolute top-6 right-6 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-600/20">
            <ScanLine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">QR Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Smart campus attendance system</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
          {/* Role Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-xl mb-6">
            <button
              onClick={() => switchRole('student')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                role === 'student'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <ScanLine className="w-4 h-4" />
              Student
            </button>
            <button
              onClick={() => switchRole('teacher')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                role === 'teacher'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Teacher
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                <Mail className="w-4 h-4 text-slate-400" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                <Lock className="w-4 h-4 text-slate-400" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Sign In as {role === 'student' ? 'Student' : 'Teacher'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Demo credentials are pre-filled. Just click Sign In.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
