/*
# Create students & teachers tables, update attendance_records, seed mock data

1. New Tables: students, teachers with RLS + anon policies
2. Modified: attendance_records gets roll_no and session_id columns
3. Seed: 20 students + 6 teachers
4. Realtime: ensure attendance_records and active_sessions are in supabase_realtime publication
*/

-- ==================== STUDENTS TABLE ====================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  department text NOT NULL DEFAULT 'CSIT',
  semester int NOT NULL DEFAULT 3
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_students" ON students;
CREATE POLICY "anon_select_students" ON students FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_students" ON students;
CREATE POLICY "anon_insert_students" ON students FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ==================== TEACHERS TABLE ====================
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  department text NOT NULL DEFAULT 'CSIT'
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_teachers" ON teachers;
CREATE POLICY "anon_select_teachers" ON teachers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_teachers" ON teachers;
CREATE POLICY "anon_insert_teachers" ON teachers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ==================== ATTENDANCE_RECORDS: ADD COLUMNS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'roll_no') THEN
    ALTER TABLE attendance_records ADD COLUMN roll_no text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'session_id') THEN
    ALTER TABLE attendance_records ADD COLUMN session_id text;
  END IF;
END $$;

-- ==================== SEED: 20 STUDENTS ====================
INSERT INTO students (roll_no, name, email, department, semester) VALUES
  ('230101', 'Aarav Sharma', 'student1@college.edu', 'CSIT', 3),
  ('230102', 'Diya Patel', 'student2@college.edu', 'CSIT', 3),
  ('230103', 'Arjun Nair', 'student3@college.edu', 'CSIT', 3),
  ('230104', 'Ananya Gupta', 'student4@college.edu', 'CSIT', 3),
  ('230105', 'Vivaan Reddy', 'student5@college.edu', 'CSIT', 3),
  ('230106', 'Ishaan Verma', 'student6@college.edu', 'CSIT', 3),
  ('230107', 'Saanvi Iyer', 'student7@college.edu', 'CSIT', 3),
  ('230108', 'Aditya Joshi', 'student8@college.edu', 'CSIT', 3),
  ('230109', 'Kavya Menon', 'student9@college.edu', 'CSIT', 3),
  ('230110', 'Reyansh Das', 'student10@college.edu', 'CSIT', 3),
  ('230111', 'Anika Pillai', 'student11@college.edu', 'CSIT', 3),
  ('230112', 'Arnav Mehta', 'student12@college.edu', 'CSIT', 3),
  ('230113', 'Myra Sinha', 'student13@college.edu', 'CSIT', 3),
  ('230114', 'Kabir Malhotra', 'student14@college.edu', 'CSIT', 3),
  ('230115', 'Aadhya Rao', 'student15@college.edu', 'CSIT', 3),
  ('230116', 'Veer Chauhan', 'student16@college.edu', 'CSIT', 3),
  ('230117', 'Navya Kulkarni', 'student17@college.edu', 'CSIT', 3),
  ('230118', 'Shaurya Agarwal', 'student18@college.edu', 'CSIT', 3),
  ('230119', 'Ira Deshpande', 'student19@college.edu', 'CSIT', 3),
  ('230120', 'Atharv Banerjee', 'student20@college.edu', 'CSIT', 3)
ON CONFLICT (roll_no) DO NOTHING;

-- ==================== SEED: 6 TEACHERS ====================
INSERT INTO teachers (emp_id, name, email, subject, department) VALUES
  ('EMP001', 'Prof. Sarah Lee', 'teacher@college.edu', 'Data Structures', 'CSIT'),
  ('EMP002', 'Dr. Rajesh Kumar', 'teacher2@college.edu', 'Operating Systems', 'CSIT'),
  ('EMP003', 'Prof. Meena Krishnan', 'teacher3@college.edu', 'Computer Networks', 'CSIT'),
  ('EMP004', 'Dr. Amit Chatterjee', 'teacher4@college.edu', 'Discrete Mathematics', 'CSIT'),
  ('EMP005', 'Prof. Priya Nair', 'teacher5@college.edu', 'Web Technologies', 'CSIT'),
  ('EMP006', 'Dr. Vikram Singh', 'teacher6@college.edu', 'Database Systems', 'CSIT')
ON CONFLICT (emp_id) DO NOTHING;

-- ==================== REALTIME PUBLATION ====================
-- attendance_records is already in supabase_realtime; add active_sessions if not yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_sessions;
  END IF;
END $$;
