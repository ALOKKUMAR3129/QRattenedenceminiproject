import { createClient } from '@supabase/supabase-js';
import type { DBAttendanceRecord, DBActiveSession } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// --- localStorage fallback helpers ---

const LS_RECORDS_KEY = 'qr-att-records';
const LS_SESSIONS_KEY = 'qr-att-sessions';

function lsGetRecords(): DBAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(LS_RECORDS_KEY);
    return raw ? (JSON.parse(raw) as DBAttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

function lsSaveRecords(records: DBAttendanceRecord[]): void {
  localStorage.setItem(LS_RECORDS_KEY, JSON.stringify(records));
}

function lsGetSessions(): DBActiveSession[] {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as DBActiveSession[]) : [];
  } catch {
    return [];
  }
}

function lsSaveSessions(sessions: DBActiveSession[]): void {
  localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions));
}

// --- Public API ---

export async function fetchAttendanceRecords(): Promise<DBAttendanceRecord[]> {
  if (!isSupabaseConfigured || !supabase) {
    return lsGetRecords();
  }
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('scanned_at', { ascending: false });
    if (error) throw error;
    return (data || []) as DBAttendanceRecord[];
  } catch {
    return lsGetRecords();
  }
}

export async function fetchStudentRecords(studentId: string): Promise<DBAttendanceRecord[]> {
  if (!isSupabaseConfigured || !supabase) {
    return lsGetRecords().filter((r) => r.student_id === studentId);
  }
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false });
    if (error) throw error;
    return (data || []) as DBAttendanceRecord[];
  } catch {
    return lsGetRecords().filter((r) => r.student_id === studentId);
  }
}

export async function checkDuplicate(
  studentId: string,
  subject: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  if (!isSupabaseConfigured || !supabase) {
    const records = lsGetRecords();
    return records.some(
      (r) =>
        r.student_id === studentId &&
        r.subject === subject &&
        r.scanned_at.startsWith(today)
    );
  }

  try {
    const startOfDay = `${today}T00:00:00Z`;
    const endOfDay = `${today}T23:59:59Z`;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('student_id', studentId)
      .eq('subject', subject)
      .gte('scanned_at', startOfDay)
      .lte('scanned_at', endOfDay)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  } catch {
    const records = lsGetRecords();
    return records.some(
      (r) =>
        r.student_id === studentId &&
        r.subject === subject &&
        r.scanned_at.startsWith(today)
    );
  }
}

export async function validateSessionToken(
  token: string
): Promise<DBActiveSession | null> {
  const nowIso = new Date().toISOString();

  if (!isSupabaseConfigured || !supabase) {
    const sessions = lsGetSessions();
    return (
      sessions.find(
        (s) =>
          s.qr_token === token &&
          s.is_active &&
          new Date(s.expires_at) > new Date(nowIso)
      ) || null
    );
  }

  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('qr_token', token)
      .eq('is_active', true)
      .gt('expires_at', nowIso)
      .maybeSingle();
    if (error) throw error;
    return data as DBActiveSession | null;
  } catch {
    const sessions = lsGetSessions();
    return (
      sessions.find(
        (s) =>
          s.qr_token === token &&
          s.is_active &&
          new Date(s.expires_at) > new Date(nowIso)
      ) || null
    );
  }
}

export async function createActiveSession(
  subject: string,
  token: string,
  teacherId: string
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15_000);

  if (!isSupabaseConfigured || !supabase) {
    const sessions = lsGetSessions();
    sessions.forEach((s) => {
      if (new Date(s.expires_at) < now) s.is_active = false;
    });
    const newSession: DBActiveSession = {
      session_id: crypto.randomUUID(),
      subject,
      qr_token: token,
      teacher_id: teacherId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    };
    sessions.push(newSession);
    lsSaveSessions(sessions);
    return;
  }

  try {
    const { error } = await supabase.from('active_sessions').insert({
      subject,
      qr_token: token,
      teacher_id: teacherId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });
    if (error) throw error;
  } catch {
    const sessions = lsGetSessions();
    const newSession: DBActiveSession = {
      session_id: crypto.randomUUID(),
      subject,
      qr_token: token,
      teacher_id: teacherId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    };
    sessions.push(newSession);
    lsSaveSessions(sessions);
  }
}

export async function expireOldSessions(teacherId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const sessions = lsGetSessions();
    const now = new Date();
    sessions.forEach((s) => {
      if (s.teacher_id === teacherId && new Date(s.expires_at) < now) {
        s.is_active = false;
      }
    });
    lsSaveSessions(sessions);
    return;
  }

  try {
    await supabase
      .from('active_sessions')
      .update({ is_active: false })
      .eq('teacher_id', teacherId)
      .lt('expires_at', new Date().toISOString());
  } catch {
    // silent fallback
  }
}

export async function insertAttendance(
  studentId: string,
  studentName: string,
  subject: string,
  teacherId: string
): Promise<void> {
  const scannedAt = new Date().toISOString();

  if (!isSupabaseConfigured || !supabase) {
    const records = lsGetRecords();
    records.unshift({
      id: crypto.randomUUID(),
      student_id: studentId,
      student_name: studentName,
      subject,
      scanned_at: scannedAt,
      teacher_id: teacherId,
      status: 'present',
    });
    lsSaveRecords(records);
    return;
  }

  try {
    const { error } = await supabase.from('attendance_records').insert({
      student_id: studentId,
      student_name: studentName,
      subject,
      teacher_id: teacherId,
      scanned_at: scannedAt,
      status: 'present',
    });
    if (error) throw error;
  } catch {
    const records = lsGetRecords();
    records.unshift({
      id: crypto.randomUUID(),
      student_id: studentId,
      student_name: studentName,
      subject,
      scanned_at: scannedAt,
      teacher_id: teacherId,
      status: 'present',
    });
    lsSaveRecords(records);
  }
}

export async function clearAttendanceRecords(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    lsSaveRecords([]);
    return;
  }

  try {
    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  } catch {
    lsSaveRecords([]);
  }
}
