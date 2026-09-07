import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Users, Clock, Lock, RefreshCw, Radio } from 'lucide-react';
import type { DBAttendanceRecord, User } from '@/lib/types';
import { getTodayEntries, isClassStarted, isClassActive, formatTime } from '@/lib/timetable';
import { encodeQR, generateToken } from '@/lib/qr';
import {
  createActiveSession,
  expireOldSessions,
  clearAttendanceRecords,
} from '@/lib/supabase';
import { exportToCSV } from '@/lib/storage';
import { useToast } from '@/components/Toast';
import Timetable from '@/components/Timetable';

type TeacherDashboardProps = {
  user: User;
  records: DBAttendanceRecord[];
  onRecordsChange: () => void;
};

const QR_REFRESH_MS = 15_000;

export default function TeacherDashboard({ user, records, onRecordsChange }: TeacherDashboardProps) {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState('');
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const todayEntries = getTodayEntries();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const selectedEntry = todayEntries.find((e) => e.id === selectedClassId);
  const canGenerate = selectedEntry ? isClassStarted(selectedEntry, now) : false;

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const refreshQR = useCallback(
    async (subject: string, teacherId: string, isInitial: boolean) => {
      setRefreshing(true);
      try {
        await expireOldSessions(teacherId);
        const token = generateToken();
        await createActiveSession(subject, token, teacherId);
        setCurrentToken(token);
        setQrData(encodeQR(subject, token));
        setSecondsLeft(15);
        if (!isInitial) {
          toast('QR refreshed (anti-proxy)', 'info');
        }
      } catch {
        toast('Failed to generate QR. Check connection.', 'error');
        clearTimers();
        setQrData(null);
      } finally {
        setRefreshing(false);
      }
    },
    [toast, clearTimers]
  );

  const startQRRefresh = useCallback(() => {
    if (!selectedEntry) return;
    clearTimers();
    refreshQR(selectedEntry.subject, user.email, true);

    refreshTimerRef.current = setInterval(() => {
      refreshQR(selectedEntry.subject, user.email, false);
    }, QR_REFRESH_MS);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 15));
    }, 1000);
  }, [selectedEntry, user.email, refreshQR, clearTimers]);

  const handleGenerate = () => {
    if (!canGenerate || !selectedEntry) return;
    startQRRefresh();
    toast(`QR generated for ${selectedEntry.subject}`, 'success');
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setQrData(null);
    setCurrentToken('');
    clearTimers();
  };

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handleClear = async () => {
    try {
      await clearAttendanceRecords();
      onRecordsChange();
      toast('All attendance records cleared', 'info');
    } catch {
      toast('Failed to clear records', 'error');
    }
  };

  const handleExport = () => {
    const toExport = qrData && selectedEntry
      ? records.filter((r) => r.subject === selectedEntry.subject)
      : records;
    if (toExport.length === 0) {
      toast('No records to export', 'warning');
      return;
    }
    exportToCSV(toExport);
    toast(`Exported ${toExport.length} records to CSV`, 'success');
  };

  const filteredRecords = qrData && selectedEntry
    ? records.filter((r) => r.subject === selectedEntry.subject)
    : records;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: QR Generator */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-500" />
            Smart QR Generator
          </h3>

          {todayEntries.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No classes scheduled today</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Today's classes</p>
              <div className="space-y-2 mb-4">
                {todayEntries.map((entry) => {
                  const active = isClassActive(entry, now);
                  const started = isClassStarted(entry, now);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => handleSelectClass(entry.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left ${
                        selectedClassId === entry.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{entry.subject}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatTime(entry.startTime)} - {formatTime(entry.endTime)} • {entry.room}
                        </p>
                      </div>
                      {active ? (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-md">
                          Live
                        </span>
                      ) : started ? (
                        <span className="text-xs text-slate-400">Ended</span>
                      ) : (
                        <span className="text-xs text-slate-400">Upcoming</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleGenerate}
                disabled={!canGenerate || refreshing}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {refreshing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : qrData ? (
                  <RefreshCw className="w-5 h-5" />
                ) : (
                  <QrCode className="w-5 h-5" />
                )}
                {qrData ? 'Regenerate QR' : 'Generate QR'}
              </button>

              {!canGenerate && selectedEntry && (
                <div className="flex items-center gap-2 mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                  <Lock className="w-3.5 h-3.5" />
                  QR generation unlocks at {formatTime(selectedEntry.startTime)} (class start time)
                </div>
              )}
            </>
          )}

          {/* QR Display */}
          {qrData && (
            <div className="mt-5 flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600 animate-scale-in">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCodeSVG value={qrData} size={200} level="M" includeMargin />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Auto-refreshes in {secondsLeft}s
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                Anti-proxy: token expires every 15 seconds
              </p>
            </div>
          )}
        </div>

        <Timetable highlightActive />
      </div>

      {/* Right: Attendance Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            Live Attendance
            {filteredRecords.length > 0 && (
              <span className="text-sm font-normal text-slate-400">({filteredRecords.length})</span>
            )}
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 ml-1">
              <Radio className="w-3 h-3 animate-pulse" />
              Realtime
            </span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={records.length === 0}
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleClear}
              disabled={records.length === 0}
              className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <Users className="w-10 h-10 mb-2" />
              <p className="text-sm">No attendance marked yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-left">
                  <th className="py-2.5 px-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Student ID</th>
                  <th className="py-2.5 px-3 font-medium">Subject</th>
                  <th className="py-2.5 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition animate-fade-in">
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200 font-medium">{r.student_name}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.student_id}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.subject}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-500 text-xs whitespace-nowrap">
                      {new Date(r.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
