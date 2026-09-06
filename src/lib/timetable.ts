import type { TimetableEntry } from './types';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TIMETABLE: TimetableEntry[] = [
  { id: '1', day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'Data Structures', room: 'CS-101' },
  { id: '2', day: 'Monday', startTime: '11:00', endTime: '12:00', subject: 'Linear Algebra', room: 'MA-204' },
  { id: '3', day: 'Monday', startTime: '14:00', endTime: '15:00', subject: 'DBMS Lab', room: 'CS-Lab-1' },
  { id: '4', day: 'Tuesday', startTime: '09:00', endTime: '10:00', subject: 'Operating Systems', room: 'CS-102' },
  { id: '5', day: 'Tuesday', startTime: '10:00', endTime: '11:00', subject: 'Probability', room: 'MA-201' },
  { id: '6', day: 'Tuesday', startTime: '13:00', endTime: '14:00', subject: 'Computer Networks', room: 'CS-103' },
  { id: '7', day: 'Wednesday', startTime: '09:00', endTime: '10:00', subject: 'Data Structures', room: 'CS-101' },
  { id: '8', day: 'Wednesday', startTime: '11:00', endTime: '12:00', subject: 'Linear Algebra', room: 'MA-204' },
  { id: '9', day: 'Wednesday', startTime: '14:00', endTime: '15:00', subject: 'OS Lab', room: 'CS-Lab-2' },
  { id: '10', day: 'Thursday', startTime: '09:00', endTime: '10:00', subject: 'Operating Systems', room: 'CS-102' },
  { id: '11', day: 'Thursday', startTime: '10:00', endTime: '11:00', subject: 'Probability', room: 'MA-201' },
  { id: '12', day: 'Thursday', startTime: '13:00', endTime: '14:00', subject: 'DBMS', room: 'CS-104' },
  { id: '13', day: 'Friday', startTime: '09:00', endTime: '10:00', subject: 'Computer Networks', room: 'CS-103' },
  { id: '14', day: 'Friday', startTime: '11:00', endTime: '12:00', subject: 'Software Engineering', room: 'CS-105' },
  { id: '15', day: 'Friday', startTime: '14:00', endTime: '16:00', subject: 'Project Lab', room: 'CS-Lab-3' },
  { id: '16', day: 'Saturday', startTime: '10:00', endTime: '11:00', subject: 'Technical Seminar', room: 'AUD-1' },
];

export function getTodayName(): string {
  return DAYS[(new Date().getDay() + 6) % 7] || 'Monday';
}

export function getTodayEntries(): TimetableEntry[] {
  const today = getTodayName();
  return TIMETABLE.filter((e) => e.day === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getEntriesByDay(day: string): TimetableEntry[] {
  return TIMETABLE.filter((e) => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function isClassActive(entry: TimetableEntry, now = new Date()): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = entry.startTime.split(':').map(Number);
  const [eh, em] = entry.endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return nowMin >= startMin && nowMin <= endMin;
}

export function isClassStarted(entry: TimetableEntry, now = new Date()): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = entry.startTime.split(':').map(Number);
  return nowMin >= sh * 60 + sm;
}
