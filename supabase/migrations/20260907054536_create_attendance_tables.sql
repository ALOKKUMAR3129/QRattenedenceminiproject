/*
# Create attendance_records and active_sessions tables

1. New Tables
- `attendance_records`: stores each student's attendance entry
  - id (uuid, primary key)
  - student_id (text, the student's email/login identifier)
  - student_name (text)
  - subject (text)
  - scanned_at (timestamptz, when the QR was scanned)
  - teacher_id (text, the teacher's email/login identifier)
  - status (text, e.g. 'present')
- `active_sessions`: stores currently-active QR sessions created by teachers
  - session_id (uuid, primary key)
  - subject (text)
  - qr_token (text, unique dynamic token embedded in the QR)
  - teacher_id (text)
  - created_at (timestamptz)
  - expires_at (timestamptz, 15 seconds after creation)
  - is_active (boolean)

2. Security
- Enable RLS on both tables.
- This is a demo app with mock auth (no Supabase Auth sign-in screen), so
  policies use TO anon, authenticated with USING (true) / WITH CHECK (true)
  because the data is intentionally shared/public across all demo users.
- Realtime is enabled on attendance_records so the teacher dashboard updates
  live when a student scans.

3. Important Notes
- The app uses mock authentication (localStorage-based), not Supabase Auth,
  so anon-key access is required for all CRUD operations.
- active_sessions rows auto-expire via the expires_at column; the app
  queries WHERE is_active = true AND expires_at > now().
- A unique constraint on qr_token prevents duplicate session tokens.
*/

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  student_name text NOT NULL,
  subject text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  teacher_id text,
  status text NOT NULL DEFAULT 'present'
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_attendance" ON attendance_records;
CREATE POLICY "anon_select_attendance" ON attendance_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance_records;
CREATE POLICY "anon_insert_attendance" ON attendance_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attendance" ON attendance_records;
CREATE POLICY "anon_update_attendance" ON attendance_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance_records;
CREATE POLICY "anon_delete_attendance" ON attendance_records FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS active_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  qr_token text UNIQUE NOT NULL,
  teacher_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sessions" ON active_sessions;
CREATE POLICY "anon_select_sessions" ON active_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sessions" ON active_sessions;
CREATE POLICY "anon_insert_sessions" ON active_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sessions" ON active_sessions;
CREATE POLICY "anon_update_sessions" ON active_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sessions" ON active_sessions;
CREATE POLICY "anon_delete_sessions" ON active_sessions FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_attendance_student_subject ON attendance_records(student_id, subject);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned_at ON attendance_records(scanned_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON active_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON active_sessions(is_active, expires_at);

-- Enable realtime on attendance_records
ALTER TABLE attendance_records REPLICA IDENTITY FULL;
