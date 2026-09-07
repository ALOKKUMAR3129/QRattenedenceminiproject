import { useState, useEffect, useCallback } from 'react';
import { ScanLine, Sun, Moon, LogOut, GraduationCap, User as UserIcon, Loader2 } from 'lucide-react';
import { getCurrentUser, logout } from '@/lib/auth';
import { supabase, fetchAttendanceRecords, isSupabaseConfigured } from '@/lib/supabase';
import type { DBAttendanceRecord, User } from '@/lib/types';
import { ToastProvider } from '@/components/Toast';
import Login from '@/components/Login';
import TeacherDashboard from '@/components/TeacherDashboard';
import StudentDashboard from '@/components/StudentDashboard';

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('qr-att-theme') as Theme) || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('qr-att-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return { theme, toggleTheme };
}

function AppInner() {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [records, setRecords] = useState<DBAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme, toggleTheme } = useTheme();

  const refreshRecords = useCallback(async () => {
    try {
      const data = await fetchAttendanceRecords();
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshRecords();
  }, [user, refreshRecords]);

  // Realtime subscription: update records when a new attendance is inserted
  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_records' },
        (payload) => {
          const newRecord = payload.new as DBAttendanceRecord;
          setRecords((prev) => [newRecord, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'attendance_records' },
        () => {
          refreshRecords();
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [user, refreshRecords]);

  if (!user) {
    return <Login onLogin={setUser} theme={theme} onToggleTheme={toggleTheme} />;
  }

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white leading-none">QR Attendance</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Smart campus attendance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
              {user.role === 'teacher' ? (
                <GraduationCap className="w-4 h-4 text-blue-500" />
              ) : (
                <UserIcon className="w-4 h-4 text-blue-500" />
              )}
              <div className="text-right">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-400 capitalize mt-0.5">{user.role}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
            <p className="text-sm">Loading attendance data...</p>
          </div>
        ) : user.role === 'teacher' ? (
          <TeacherDashboard user={user} records={records} onRecordsChange={refreshRecords} />
        ) : (
          <StudentDashboard user={user} records={records} onRecordsChange={refreshRecords} />
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
        QR Attendance System — powered by Supabase Realtime
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
