import type { DBAttendanceRecord } from './types';

export function exportToCSV(records: DBAttendanceRecord[]): void {
  const headers = ['Student Name', 'Roll No', 'Subject', 'Scanned At', 'Teacher ID', 'Session ID', 'Status'];
  const rows = records.map((r) => [
    r.student_name,
    r.roll_no || r.student_id,
    r.subject,
    new Date(r.scanned_at).toLocaleString(),
    r.teacher_id || '',
    r.session_id || '',
    r.status,
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
