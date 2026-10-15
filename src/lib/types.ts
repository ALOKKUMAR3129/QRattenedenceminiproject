export type Role = 'student' | 'teacher';

export type User = {
  email: string;
  name: string;
  role: Role;
};

export type TimetableEntry = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
};

export type QRPayload = {
  subject: string;
  timestamp: number;
  lat: number;
  lng: number;
  token: string;
};

export type DBStudent = {
  id: string;
  roll_no: string;
  name: string;
  email: string;
  department: string;
  semester: number;
};

export type DBTeacher = {
  id: string;
  emp_id: string;
  name: string;
  email: string;
  subject: string;
  department: string;
};

export type DBAttendanceRecord = {
  id: string;
  student_id: string;
  roll_no: string | null;
  student_name: string;
  subject: string;
  session_id: string | null;
  scanned_at: string;
  teacher_id: string | null;
  status: string;
};

export type DBActiveSession = {
  session_id: string;
  subject: string;
  qr_token: string;
  teacher_id: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
};
