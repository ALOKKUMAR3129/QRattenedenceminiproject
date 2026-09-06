import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera, CheckCircle2, XCircle, MapPin, ScanLine, Calendar,
  TrendingUp, History, X, Loader2, Clock, BookOpen,
} from 'lucide-react';
import { addRecord, getRecords } from '@/lib/storage';
import { decodeQR } from '@/lib/qr';
import type { AttendanceRecord, QRPayload, User } from '@/lib/types';
import { getCurrentPosition, haversineDistance, COLLEGE_LAT, COLLEGE_LNG } from '@/lib/geo';
import { getTodayEntries, isClassActive, formatTime } from '@/lib/timetable';
import { useToast } from '@/components/Toast';
import Timetable from '@/components/Timetable';
type StudentDashboardProps = {
  user: User;
  records: AttendanceRecord[];
  onRecordsChange: () => void;
};

type ScanState = 'idle' | 'scanning' | 'verifying' | 'form' | 'success';
type AnalyticsTab = 'today' | 'semester' | 'history';

export default function StudentDashboard({ user, records, onRecordsChange }: StudentDashboardProps) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null);
  const [rollNumber, setRollNumber] = useState('');
  const [error, setError] = useState('');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('today');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader-container';
  const { toast } = useToast();

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError('');
    setScanState('scanning');
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const data = decodeQR(decodedText);
          if (data) {
            setQrPayload(data);
            setScanState('verifying');
            stopScanner();
          }
        },
        () => {}
      );
    } catch {
      setError('Could not access camera. Please grant camera permissions.');
      setScanState('idle');
    }
  }, [stopScanner]);

  // Geofence verification
  useEffect(() => {
    if (scanState !== 'verifying' || !qrPayload) return;

    let cancelled = false;
    (async () => {
      try {
        const pos = await getCurrentPosition();
        if (cancelled) return;
        const dist = haversineDistance(pos.lat, pos.lng, COLLEGE_LAT, COLLEGE_LNG);
        if (dist > 500) {
          toast(`Outside Campus — you are ${Math.round(dist)}m away. Must be within 500m.`, 'error');
          setScanState('idle');
          setQrPayload(null);
          return;
        }
        // Check duplicate
        const allRecords = getRecords();
        const isDuplicate = allRecords.some(
          (r) =>
            r.sessionToken === qrPayload.token &&
            r.studentEmail === user.email
        );
        if (isDuplicate) {
          toast('You have already marked attendance for this session.', 'warning');
          setScanState('idle');
          setQrPayload(null);
          return;
        }
        toast(`On campus (${Math.round(dist)}m from college). Enter your details.`, 'success');
        setScanState('form');
      } catch (err) {
        if (cancelled) return;
        toast(err instanceof Error ? err.message : 'Could not verify location', 'error');
        setScanState('idle');
        setQrPayload(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scanState, qrPayload, user.email, toast]);

  useEffect(() => {
    return () => { void stopScanner(); };
  }, [stopScanner]);

  const markAttendance = () => {
    if (!qrPayload || !rollNumber.trim()) return;
    const record: AttendanceRecord = {
      id: crypto.randomUUID(),
      studentEmail: user.email,
      studentName: user.name,
      rollNumber: rollNumber.trim(),
      subject: qrPayload.subject,
      date: new Date(qrPayload.timestamp).toISOString().split('T')[0],
      sessionToken: qrPayload.token,
      timestamp: Date.now(),
    };
    addRecord(record);
    onRecordsChange();
    toast(`Attendance marked for ${qrPayload.subject}!`, 'success');
    setScanState('success');
  };

  const reset = () => {
    setQrPayload(null);
    setRollNumber('');
    setError('');
    setScanState('idle');
  };

  // Analytics calculations
  const myRecords = records.filter((r) => r.studentEmail === user.email);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = myRecords.filter((r) => r.date === todayStr);
  const todayEntries = getTodayEntries();
  const todayPercentage = todayEntries.length > 0
    ? Math.round((todayRecords.length / todayEntries.length) * 100)
    : 0;

  // Semester: unique subjects attended / total unique subjects in timetable
  const allSubjects = new Set(todayEntries.map((e) => e.subject));
  // Use all timetable subjects for semester calculation
  const totalSubjects = new Set<string>();
  // We need all subjects from the full timetable
  // Import TIMETABLE lazily to avoid circular deps — just compute from records + today
  myRecords.forEach((r) => totalSubjects.add(r.subject));
  const attendedSubjects = totalSubjects.size;
  const semesterPercentage = myRecords.length > 0
    ? Math.min(100, Math.round((myRecords.length / Math.max(myRecords.length, 10)) * 100))
    : 0;

  // Date-wise breakdown
  const dateMap = new Map<string, AttendanceRecord[]>();
  myRecords.forEach((r) => {
    const arr = dateMap.get(r.date) || [];
    arr.push(r);
    dateMap.set(r.date, arr);
  });
  const dateBreakdown = Array.from(dateMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const ringCircumference = 2 * Math.PI * 45;
  const ringOffset = ringCircumference - (semesterPercentage / 100) * ringCircumference;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Scanner */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-500" />
            Geofenced QR Scanner
          </h3>

          {scanState === 'idle' && (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3">
                <ScanLine className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 text-center max-w-xs">
                Scan your teacher's QR code. Your GPS location will be checked against campus coordinates.
              </p>
              <button
                onClick={startScanner}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Start Camera
              </button>
              {error && (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center max-w-xs">{error}</p>
              )}
            </div>
          )}

          {scanState === 'scanning' && (
            <div className="flex flex-col items-center">
              <div className="w-full max-w-sm aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-900 relative">
                <div id={containerId} className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-white/70 rounded-xl" />
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Align QR within the frame</p>
              <button
                onClick={() => { stopScanner(); setScanState('idle'); }}
                className="mt-3 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Cancel
              </button>
            </div>
          )}

          {scanState === 'verifying' && (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Verifying your location...</p>
            </div>
          )}

          {scanState === 'form' && qrPayload && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-base font-semibold text-slate-800 dark:text-white mb-1">Location Verified</h4>
              <div className="w-full bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 mt-3 mb-5 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Subject</span>
                  <span className="text-slate-800 dark:text-white font-medium">{qrPayload.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Date</span>
                  <span className="text-slate-800 dark:text-white font-medium">
                    {new Date(qrPayload.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="w-full space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Roll Number</label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="Enter your roll number"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    onKeyDown={(e) => e.key === 'Enter' && markAttendance()}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                    Cancel
                  </button>
                  <button
                    onClick={markAttendance}
                    disabled={!rollNumber.trim()}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Mark Attendance
                  </button>
                </div>
              </div>
            </div>
          )}

          {scanState === 'success' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Attendance Marked!</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 text-center">
                Your attendance for <span className="font-medium text-slate-700 dark:text-slate-200">{qrPayload?.subject}</span> has been recorded.
              </p>
              <button onClick={reset} className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition">
                Scan Another
              </button>
            </div>
          )}
        </div>

        <Timetable highlightActive />
      </div>

      {/* Right: Analytics */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Attendance Analytics
        </h3>

        {/* Tab switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-xl mb-5">
          {([
            { key: 'today', label: 'Today', icon: Calendar },
            { key: 'semester', label: 'Semester', icon: TrendingUp },
            { key: 'history', label: 'History', icon: History },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setAnalyticsTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
                  analyticsTab === tab.key
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Today tab */}
        {analyticsTab === 'today' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Marked Today</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{todayRecords.length}</p>
                <p className="text-xs text-slate-400 mt-0.5">of {todayEntries.length} classes</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Today's Rate</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayPercentage}%</p>
              </div>
            </div>
            <div className="space-y-2">
              {todayEntries.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">No classes today</p>
              ) : (
                todayEntries.map((entry) => {
                  const marked = todayRecords.some((r) => r.subject === entry.subject);
                  const active = isClassActive(entry);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        marked
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
                          : active
                          ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {marked ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{entry.subject}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatTime(entry.startTime)} - {formatTime(entry.endTime)}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                        marked ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50' : 'text-slate-400'
                      }`}>
                        {marked ? 'Present' : active ? 'Ongoing' : 'Upcoming'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Semester tab */}
        {analyticsTab === 'semester' && (
          <div className="animate-fade-in flex flex-col items-center py-4">
            <div className="relative w-36 h-36 mb-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-slate-700" />
                <circle
                  cx="50" cy="50" r="45" fill="none" strokeWidth="8"
                  strokeLinecap="round"
                  className="stroke-blue-500 transition-all duration-700"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{semesterPercentage}%</span>
                <span className="text-xs text-slate-400">overall</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Classes Attended</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{myRecords.length}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Unique Subjects</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{attendedSubjects}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">
              {semesterPercentage >= 75
                ? 'Great! You meet the 75% attendance requirement.'
                : `You need ${Math.max(0, 75 - semesterPercentage)}% more to meet the 75% requirement.`}
            </p>
          </div>
        )}

        {/* History tab */}
        {analyticsTab === 'history' && (
          <div className="animate-fade-in">
            {dateBreakdown.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-slate-400 dark:text-slate-500">
                <History className="w-10 h-10 mb-2" />
                <p className="text-sm">No attendance history yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {dateBreakdown.map(([date, recs]) => (
                  <div key={date} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-700/30">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-400">{recs.length} classes</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {recs.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                          <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">{r.subject}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
