CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'FACULTY_MENTOR',
  department TEXT NOT NULL DEFAULT 'General',
  register_number TEXT,
  student_profile_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  section TEXT NOT NULL,
  mentor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0,
  profile JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  application JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS student_applications_status_submitted_idx
  ON student_applications (status, submitted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS student_applications_pending_register_unique
  ON student_applications (register_number) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_role TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  student_id UUID,
  student_register_number TEXT,
  student_name TEXT,
  details TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  attendance_threshold NUMERIC(5, 2) NOT NULL DEFAULT 75 CHECK (attendance_threshold BETWEEN 0 AND 100),
  cgpa_threshold NUMERIC(3, 2) NOT NULL DEFAULT 6.5 CHECK (cgpa_threshold BETWEEN 0 AND 10),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_department_section_idx ON students (department, section);
CREATE INDEX IF NOT EXISTS students_mentor_id_idx ON students (mentor_id);
CREATE INDEX IF NOT EXISTS students_deleted_at_idx ON students (deleted_at);