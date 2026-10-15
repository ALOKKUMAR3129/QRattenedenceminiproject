import { createClient } from '@supabase/supabase-js';
import type { DBAttendanceRecord, DBActiveSession, DBStudent, DBTeacher } from './types';

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
const LS_STUDENTS_KEY = 'qr-att-students';
const LS_TEACHERS_KEY = 'qr-att-teachers';

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

export async function fetchStudentByEmail(email: string): Promise<DBStudent | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data as DBStudent | null;
  } catch {
    return null;
  }
}

export async function fetchTeachers(): Promise<DBTeacher[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as DBTeacher[];
  } catch {
    return [];
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

const SESSION_GRACE_MS = 300_000;

function isSessionWithinGrace(session: DBActiveSession, now: Date): boolean {
  const created = new Date(session.created_at);
  const elapsed = now.getTime() - created.getTime();
  return elapsed >= -60_000 && elapsed <= SESSION_GRACE_MS;
}

export async function validateSessionToken(
  token: string
): Promise<DBActiveSession | null> {
  const now = new Date();

  if (!isSupabaseConfigured || !supabase) {
    const sessions = lsGetSessions();
    return (
      sessions.find(
        (s) =>
          s.qr_token === token &&
          s.is_active &&
          isSessionWithinGrace(s, now)
      ) || null
    );
  }

  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('qr_token', token)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const session = data as DBActiveSession;
    if (!isSessionWithinGrace(session, now)) return null;
    return session;
  } catch {
    const sessions = lsGetSessions();
    return (
      sessions.find(
        (s) =>
          s.qr_token === token &&
          s.is_active &&
          isSessionWithinGrace(s, now)
      ) || null
    );
  }
}

export async function createActiveSession(
  subject: string,
  token: string,
  teacherId: string
): Promise<DBActiveSession | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_GRACE_MS);

  if (!isSupabaseConfigured || !supabase) {
    const sessions = lsGetSessions();
    sessions.forEach((s) => {
      const elapsed = now.getTime() - new Date(s.created_at).getTime();
      if (elapsed > SESSION_GRACE_MS) s.is_active = false;
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
    return newSession;
  }

  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .insert({
        subject,
        qr_token: token,
        teacher_id: teacherId,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data as DBActiveSession;
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
    return newSession;
  }
}

export async function expireOldSessions(teacherId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const sessions = lsGetSessions();
    const now = new Date();
    sessions.forEach((s) => {
      const elapsed = now.getTime() - new Date(s.created_at).getTime();
      if (s.teacher_id === teacherId && elapsed > SESSION_GRACE_MS) {
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
      .lt('created_at', new Date(Date.now() - SESSION_GRACE_MS).toISOString());
  } catch {
    // silent fallback
  }
}

export async function insertAttendance(
  studentId: string,
  studentName: string,
  subject: string,
  teacherId: string,
  rollNo: string,
  sessionId: string
): Promise<void> {
  const scannedAt = new Date().toISOString();

  if (!isSupabaseConfigured || !supabase) {
    const records = lsGetRecords();
    records.unshift({
      id: crypto.randomUUID(),
      student_id: studentId,
      roll_no: rollNo,
      student_name: studentName,
      subject,
      session_id: sessionId,
      scanned_at: scannedAt,
      teacher_id: teacherId,
      status: 'Present',
    });
    lsSaveRecords(records);
    return;
  }

  try {
    const { error } = await supabase.from('attendance_records').insert({
      student_id: studentId,
      roll_no: rollNo,
      student_name: studentName,
      subject,
      session_id: sessionId,
      teacher_id: teacherId,
      scanned_at: scannedAt,
      status: 'Present',
    });
    if (error) throw error;
  } catch {
    const records = lsGetRecords();
    records.unshift({
      id: crypto.randomUUID(),
      student_id: studentId,
      roll_no: rollNo,
      student_name: studentName,
      subject,
      session_id: sessionId,
      scanned_at: scannedAt,
      teacher_id: teacherId,
      status: 'Present',
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
