import { createClient } from '@supabase/supabase-js';
import type { DBAttendanceRecord, DBActiveSession } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export async function fetchAttendanceRecords(): Promise<DBAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DBAttendanceRecord[];
}

export async function fetchStudentRecords(studentId: string): Promise<DBAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DBAttendanceRecord[];
}

export async function checkDuplicate(
  studentId: string,
  subject: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
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
}

export async function validateSessionToken(
  token: string
): Promise<DBActiveSession | null> {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('qr_token', token)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data as DBActiveSession | null;
}

export async function createActiveSession(
  subject: string,
  token: string,
  teacherId: string
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15_000);
  const { error } = await supabase.from('active_sessions').insert({
    subject,
    qr_token: token,
    teacher_id: teacherId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_active: true,
  });
  if (error) throw error;
}

export async function expireOldSessions(teacherId: string): Promise<void> {
  await supabase
    .from('active_sessions')
    .update({ is_active: false })
    .eq('teacher_id', teacherId)
    .lt('expires_at', new Date().toISOString());
}

export async function insertAttendance(
  studentId: string,
  studentName: string,
  subject: string,
  teacherId: string
): Promise<void> {
  const { error } = await supabase.from('attendance_records').insert({
    student_id: studentId,
    student_name: studentName,
    subject,
    teacher_id: teacherId,
    scanned_at: new Date().toISOString(),
    status: 'present',
  });
  if (error) throw error;
}

export async function clearAttendanceRecords(): Promise<void> {
  const { error } = await supabase.from('attendance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}
