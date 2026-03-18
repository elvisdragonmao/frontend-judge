-- ═══════════════════════════════════════════════════════════
-- emjudge Platform — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE assignment_type AS ENUM ('html-css-js', 'react');
CREATE TYPE submission_status AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'error');
CREATE TYPE judge_job_status AS ENUM ('pending', 'locked', 'running', 'completed', 'failed', 'dead');
CREATE TYPE artifact_type AS ENUM ('screenshot', 'log', 'report');

-- ─── Users ───────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50) NOT NULL,
  display_name  VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'student',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_users_username UNIQUE (username)
);

CREATE INDEX idx_users_role ON users (role);

-- ─── Classes ─────────────────────────────────────────────
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by  UUID NOT NULL REFERENCES users(id),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Class members ───────────────────────────────────────
CREATE TABLE class_members (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id  UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_class_member UNIQUE (class_id, user_id)
);

CREATE INDEX idx_class_members_user ON class_members (user_id);
CREATE INDEX idx_class_members_class ON class_members (class_id);

-- ─── Assignments ─────────────────────────────────────────
CREATE TABLE assignments (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id                  UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title                     VARCHAR(200) NOT NULL,
  description               TEXT NOT NULL DEFAULT '',
  type                      assignment_type NOT NULL DEFAULT 'html-css-js',
  due_date                  TIMESTAMPTZ,
  allow_multiple_submissions BOOLEAN NOT NULL DEFAULT true,
  created_by                UUID NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_class ON assignments (class_id);

-- ─── Assignment specs (judge configuration) ──────────────
CREATE TABLE assignment_specs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id  UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  start_command  VARCHAR(255) NOT NULL DEFAULT 'static',
  test_content   TEXT,
  timeout_ms     INTEGER NOT NULL DEFAULT 60000,
  allowed_paths  TEXT[] NOT NULL DEFAULT ARRAY['**/*'],
  blocked_paths  TEXT[] NOT NULL DEFAULT ARRAY['package.json', 'Dockerfile', '*.sh', 'node_modules/**', '.env'],
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_assignment_spec UNIQUE (assignment_id)
);

-- ─── Submissions ─────────────────────────────────────────
CREATE TABLE submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        submission_status NOT NULL DEFAULT 'pending',
  score         REAL,
  max_score     REAL,
  file_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_assignment ON submissions (assignment_id);
CREATE INDEX idx_submissions_user ON submissions (user_id);
CREATE INDEX idx_submissions_assignment_user ON submissions (assignment_id, user_id);
CREATE INDEX idx_submissions_status ON submissions (status);

-- ─── Submission files ────────────────────────────────────
CREATE TABLE submission_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  path          VARCHAR(500) NOT NULL,
  size          BIGINT NOT NULL DEFAULT 0,
  minio_key     VARCHAR(1000) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_files_submission ON submission_files (submission_id);

-- ─── Submission runs (each judge execution) ──────────────
CREATE TABLE submission_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status        submission_status NOT NULL DEFAULT 'pending',
  score         REAL,
  max_score     REAL,
  test_results  JSONB,
  log           TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_runs_submission ON submission_runs (submission_id);

-- ─── Submission artifacts (screenshots, logs, reports) ───
CREATE TABLE submission_artifacts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id        UUID NOT NULL REFERENCES submission_runs(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  type          artifact_type NOT NULL DEFAULT 'screenshot',
  name          VARCHAR(255) NOT NULL,
  minio_key     VARCHAR(1000) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_artifacts_run ON submission_artifacts (run_id);
CREATE INDEX idx_submission_artifacts_submission ON submission_artifacts (submission_id);

-- ─── Judge jobs (PostgreSQL-based queue) ─────────────────
CREATE TABLE judge_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  run_id        UUID NOT NULL REFERENCES submission_runs(id) ON DELETE CASCADE,
  status        judge_job_status NOT NULL DEFAULT 'pending',
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  locked_by     VARCHAR(100),
  locked_at     TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_judge_jobs_status ON judge_jobs (status);
CREATE INDEX idx_judge_jobs_submission ON judge_jobs (submission_id);
-- For the polling query: find oldest unlocked pending job
CREATE INDEX idx_judge_jobs_pending ON judge_jobs (status, created_at) WHERE status = 'pending';

-- ─── Password reset logs ─────────────────────────────────
CREATE TABLE password_reset_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reset_by    UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Bulk import jobs ────────────────────────────────────
CREATE TABLE bulk_import_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_by   UUID NOT NULL REFERENCES users(id),
  total_count   INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count   INTEGER NOT NULL DEFAULT 0,
  errors        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assignment_specs_updated_at BEFORE UPDATE ON assignment_specs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_judge_jobs_updated_at BEFORE UPDATE ON judge_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
