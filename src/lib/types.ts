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
