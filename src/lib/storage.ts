import type { AttendanceRecord } from './types';

const KEY = 'qr-attendance-records';

export function getRecords(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

export function addRecord(record: AttendanceRecord): void {
  const records = getRecords();
  records.push(record);
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function clearRecords(): void {
  localStorage.removeItem(KEY);
}

export function exportToCSV(records: AttendanceRecord[]): void {
  const headers = ['Student Name', 'Roll Number', 'Subject', 'Date', 'Session Token', 'Timestamp'];
  const rows = records.map((r) => [
    r.studentName,
    r.rollNumber,
    r.subject,
    r.date,
    r.sessionToken,
    new Date(r.timestamp).toLocaleString(),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
