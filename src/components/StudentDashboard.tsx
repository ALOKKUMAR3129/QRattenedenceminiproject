import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera, CheckCircle2, ScanLine, Calendar,
  TrendingUp, History, Loader2, Clock, BookOpen, MapPin, Zap,
} from 'lucide-react';
import { decodeQR } from '@/lib/qr';
import type { DBAttendanceRecord, QRPayload, User } from '@/lib/types';
import {
  validateSessionToken,
  checkDuplicate,
  insertAttendance,
  fetchStudentRecords,
} from '@/lib/supabase';
import { getCurrentPosition, haversineDistance, COLLEGE_LAT, COLLEGE_LNG } from '@/lib/geo';
import { getTodayEntries, isClassActive, formatTime } from '@/lib/timetable';
import { useToast } from '@/components/Toast';
import Timetable from '@/components/Timetable';

type StudentDashboardProps = {
  user: User;
  records: DBAttendanceRecord[];
  onRecordsChange: () => void;
};

type ScanState = 'idle' | 'scanning' | 'verifying' | 'form' | 'success';
type AnalyticsTab = 'today' | 'semester' | 'history';

export default function StudentDashboard({ user, records, onRecordsChange }: StudentDashboardProps) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null);
  const [sessionTeacherId, setSessionTeacherId] = useState('');
  const [error, setError] = useState('');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('today');
  const [bypassGeofence, setBypassGeofence] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const { toast } = useToast();

  const myRecords = records.filter((r) => r.student_id === user.email);

  const stopScanner = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDecoded = useCallback(
    (text: string) => {
      const data = decodeQR(text);
      if (data) {
        setQrPayload(data);
        setScanState('verifying');
        stopScanner();
      }
    },
    [stopScanner]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (code && code.data) {
      handleDecoded(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleDecoded]);

  const startScanner = useCallback(async () => {
    setError('');
    setScanState('scanning');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const video = videoRef.current;
    if (!video) {
      setError('Camera element not ready. Please try again.');
      setScanState('idle');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Could not access camera: ${msg}. Please check camera permissions and try again.`);
      setScanState('idle');
    }
  }, [scanFrame]);

  // Verification: validate session token in Supabase, then geofence, then duplicate check
  useEffect(() => {
    if (scanState !== 'verifying' || !qrPayload) return;

    let cancelled = false;

    (async () => {
      try {
        // 1. Validate the session token is active and not expired
        const session = await validateSessionToken(qrPayload.token);
        if (cancelled) return;
        if (!session) {
          toast('QR code expired or invalid. Please scan a fresh QR.', 'error');
          setScanState('idle');
          setQrPayload(null);
          return;
        }
        setSessionTeacherId(session.teacher_id || '');

        // 2. Geofence check (unless bypassed)
        if (!bypassGeofence) {
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
          } catch (geoErr) {
            if (cancelled) return;
            toast(geoErr instanceof Error ? geoErr.message : 'Could not verify location', 'error');
            setScanState('idle');
            setQrPayload(null);
            return;
          }
        }

        // 3. Duplicate check via Supabase
        const isDup = await checkDuplicate(user.email, qrPayload.subject);
        if (cancelled) return;
        if (isDup) {
          toast('Attendance already recorded for this lecture.', 'warning');
          setScanState('idle');
          setQrPayload(null);
          return;
        }

        // 4. All checks passed — show form
        if (bypassGeofence) {
          toast('Demo Mode: geofence bypassed.', 'info');
        } else {
          toast('On campus. Ready to mark attendance.', 'success');
        }
        setScanState('form');
      } catch {
        if (cancelled) return;
        toast('Validation failed. Check your connection and try again.', 'error');
        setScanState('idle');
        setQrPayload(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scanState, qrPayload, user.email, bypassGeofence, toast]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const markAttendance = async () => {
    if (!qrPayload) return;
    setScanState('verifying');
    try {
      await insertAttendance(user.email, user.name, qrPayload.subject, sessionTeacherId);
      onRecordsChange();
      toast(`Attendance marked for ${qrPayload.subject}!`, 'success');
      setScanState('success');
    } catch {
      toast('Failed to mark attendance. Please try again.', 'error');
      setScanState('form');
    }
  };

  const reset = () => {
    setQrPayload(null);
    setSessionTeacherId('');
    setError('');
    setScanState('idle');
  };

  // Analytics calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = myRecords.filter((r) =>
    r.scanned_at.startsWith(todayStr)
  );
  const todayEntries = getTodayEntries();
  const todayPercentage = todayEntries.length > 0
    ? Math.round((todayRecords.length / todayEntries.length) * 100)
    : 0;

  const totalSubjects = new Set<string>();
  myRecords.forEach((r) => totalSubjects.add(r.subject));
  const attendedSubjects = totalSubjects.size;
  const semesterPercentage = myRecords.length > 0
    ? Math.min(100, Math.round((myRecords.length / Math.max(myRecords.length, 10)) * 100))
    : 0;

  const dateMap = new Map<string, DBAttendanceRecord[]>();
  myRecords.forEach((r) => {
    const dateStr = r.scanned_at.split('T')[0];
    const arr = dateMap.get(dateStr) || [];
    arr.push(r);
    dateMap.set(dateStr, arr);
  });
  const dateBreakdown = Array.from(dateMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const ringCircumference = 2 * Math.PI * 45;
  const ringOffset = ringCircumference - (semesterPercentage / 100) * ringCircumference;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Scanner */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-blue-500" />
              Geofenced QR Scanner
            </h3>
            {/* Demo Mode toggle */}
            <button
              onClick={() => setBypassGeofence((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                bypassGeofence
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-transparent'
              }`}
              title="Bypass GPS geofence for testing"
            >
              <Zap className="w-3.5 h-3.5" />
              {bypassGeofence ? 'Demo Mode ON' : 'Demo Mode'}
            </button>
          </div>

          {bypassGeofence && (
            <div className="flex items-center gap-2 mb-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5" />
              Geofence bypassed — scans will work from any location for testing.
            </div>
          )}

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
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
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
              <p className="text-sm text-slate-500 dark:text-slate-400">Verifying session & location...</p>
            </div>
          )}

          {scanState === 'form' && qrPayload && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-base font-semibold text-slate-800 dark:text-white mb-1">Verified</h4>
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
                <div className="flex gap-3">
                  <button onClick={reset} className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                    Cancel
                  </button>
                  <button
                    onClick={markAttendance}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
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
                            {new Date(r.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
