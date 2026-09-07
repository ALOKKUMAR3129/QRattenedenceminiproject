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

export type AttendanceRecord = {
  id: string;
  studentEmail: string;
  studentName: string;
  rollNumber: string;
  subject: string;
  date: string;
  sessionToken: string;
  timestamp: number;
};

export type QRPayload = {
  subject: string;
  timestamp: number;
  lat: number;
  lng: number;
  token: string;
};

export type DBAttendanceRecord = {
  id: string;
  student_id: string;
  student_name: string;
  subject: string;
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
