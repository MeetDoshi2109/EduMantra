-- ============================================================
-- EduMantra – AI Skill Intelligence & Learning Platform
-- Migration 001: Full Schema
-- Roles: student, instructor, parent, organization_admin, developer
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM (
  'student', 'instructor', 'parent', 'organization_admin', 'developer'
);
CREATE TYPE competency_domain AS ENUM (
  'science', 'technology', 'engineering', 'mathematics'
);
CREATE TYPE competency_level AS ENUM ('none','beginner','intermediate','advanced','expert');
CREATE TYPE gap_severity     AS ENUM ('critical','high','medium','low');
CREATE TYPE assessment_type  AS ENUM ('mcq','quiz','scenario','practical');
CREATE TYPE content_type     AS ENUM ('document','presentation','video','url','text');
CREATE TYPE enrollment_status AS ENUM ('not_started','in_progress','completed','dropped');
CREATE TYPE question_difficulty AS ENUM ('easy','medium','hard');

-- ============================================================
-- departments
-- ============================================================
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES departments(id),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- organizations  (schools, colleges, govt depts)
-- ============================================================
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,
  type            TEXT DEFAULT 'government',   -- government | school | college | ngo
  address         TEXT,
  state           TEXT,
  district        TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  logo_url        TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- job_roles
-- ============================================================
CREATE TABLE job_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,
  department_id   UUID REFERENCES departments(id),
  grade_level     TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- users  (extends Supabase auth.users)
-- ============================================================
CREATE TABLE users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  employee_id         TEXT UNIQUE,
  designation         TEXT,
  organization_id     UUID REFERENCES organizations(id),
  department_id       UUID REFERENCES departments(id),
  job_role_id         UUID REFERENCES job_roles(id),
  current_assignment  TEXT,
  education_level     TEXT,
  field_of_study      TEXT,
  years_of_experience INTEGER DEFAULT 0,
  role                user_role DEFAULT 'student',
  preferred_language  TEXT DEFAULT 'en',
  igot_user_id        TEXT,
  avatar_url          TEXT,
  phone               TEXT,
  date_of_birth       DATE,
  is_active           BOOLEAN DEFAULT TRUE,
  last_login_at       TIMESTAMPTZ,
  -- parent-specific
  parent_of           UUID[],                  -- array of student user IDs
  -- developer-specific
  api_key             TEXT UNIQUE,
  api_key_created_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- competency_framework
-- ============================================================
CREATE TABLE competency_framework (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,
  domain          competency_domain NOT NULL,
  description     TEXT,
  required_level  competency_level DEFAULT 'intermediate',
  keywords        TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- job_role_competencies
-- ============================================================
CREATE TABLE job_role_competencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_role_id     UUID NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  competency_id   UUID NOT NULL REFERENCES competency_framework(id) ON DELETE CASCADE,
  required_level  competency_level NOT NULL DEFAULT 'intermediate',
  priority        INTEGER DEFAULT 1,
  is_mandatory    BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_role_id, competency_id)
);

-- ============================================================
-- user_competency_profiles
-- ============================================================
CREATE TABLE user_competency_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competency_id     UUID NOT NULL REFERENCES competency_framework(id) ON DELETE CASCADE,
  current_level     competency_level DEFAULT 'none',
  score             NUMERIC(5,2) DEFAULT 0,
  last_assessed_at  TIMESTAMPTZ,
  assessment_source TEXT,
  evidence          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, competency_id)
);

-- ============================================================
-- skill_gap_reports
-- ============================================================
CREATE TABLE skill_gap_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_role_id       UUID REFERENCES job_roles(id),
  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  summary           TEXT,
  overall_gap_score NUMERIC(5,2),
  ai_insights       JSONB,
  status            TEXT DEFAULT 'active',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- skill_gap_details
-- ============================================================
CREATE TABLE skill_gap_details (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id           UUID NOT NULL REFERENCES skill_gap_reports(id) ON DELETE CASCADE,
  competency_id       UUID NOT NULL REFERENCES competency_framework(id),
  current_level       competency_level,
  required_level      competency_level,
  gap_score           NUMERIC(5,2),
  severity            gap_severity,
  recommended_action  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- igot_courses
-- ============================================================
CREATE TABLE igot_courses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  igot_course_id   TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  provider         TEXT,
  duration_hours   NUMERIC(6,2),
  competency_tags  TEXT[],
  domain_tags      competency_domain[],
  level            competency_level,
  language         TEXT DEFAULT 'en',
  url              TEXT,
  thumbnail_url    TEXT,
  rating           NUMERIC(3,2),
  enrollment_count INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  last_synced_at   TIMESTAMPTZ DEFAULT NOW(),
  metadata         JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- tpac_training_programmes
-- ============================================================
CREATE TABLE tpac_training_programmes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  code            TEXT UNIQUE,
  description     TEXT,
  duration_days   INTEGER,
  target_audience TEXT,
  competency_tags TEXT[],
  domain          competency_domain,
  schedule_dates  JSONB,
  venue           TEXT,
  mode            TEXT DEFAULT 'offline',
  contact_info    TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- learning_pathways
-- ============================================================
CREATE TABLE learning_pathways (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gap_report_id   UUID REFERENCES skill_gap_reports(id),
  title           TEXT NOT NULL,
  description     TEXT,
  ai_rationale    TEXT,
  total_hours     NUMERIC(8,2),
  target_completion DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- pathway_items
-- ============================================================
CREATE TABLE pathway_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pathway_id        UUID NOT NULL REFERENCES learning_pathways(id) ON DELETE CASCADE,
  sequence_order    INTEGER NOT NULL,
  item_type         TEXT NOT NULL,
  igot_course_id    UUID REFERENCES igot_courses(id),
  tpac_programme_id UUID REFERENCES tpac_training_programmes(id),
  competency_id     UUID REFERENCES competency_framework(id),
  is_mandatory      BOOLEAN DEFAULT TRUE,
  estimated_hours   NUMERIC(6,2),
  ai_reason         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- course_enrollments
-- ============================================================
CREATE TABLE course_enrollments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  igot_course_id     UUID NOT NULL REFERENCES igot_courses(id) ON DELETE CASCADE,
  igot_enrollment_id TEXT,
  status             enrollment_status DEFAULT 'not_started',
  progress_pct       NUMERIC(5,2) DEFAULT 0,
  score              NUMERIC(5,2),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  certificate_url    TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, igot_course_id)
);

-- ============================================================
-- assessment_banks
-- ============================================================
CREATE TABLE assessment_banks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by    UUID NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  content_type  content_type NOT NULL,
  file_url      TEXT,
  raw_text      TEXT,
  competency_id UUID REFERENCES competency_framework(id),
  domain        competency_domain,
  is_public     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- assessments
-- ============================================================
CREATE TABLE assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id         UUID REFERENCES assessment_banks(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  assessment_type assessment_type DEFAULT 'mcq',
  total_questions INTEGER DEFAULT 10,
  time_limit_mins INTEGER,
  passing_score   NUMERIC(5,2) DEFAULT 60,
  competency_id   UUID REFERENCES competency_framework(id),
  difficulty      question_difficulty DEFAULT 'medium',
  is_published    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- questions
-- ============================================================
CREATE TABLE questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_answer  TEXT NOT NULL,
  explanation     TEXT,
  difficulty      question_difficulty DEFAULT 'medium',
  competency_id   UUID REFERENCES competency_framework(id),
  ai_generated    BOOLEAN DEFAULT TRUE,
  sequence_order  INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- assessment_attempts
-- ============================================================
CREATE TABLE assessment_attempts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  score         NUMERIC(5,2),
  passed        BOOLEAN,
  answers       JSONB,
  ai_feedback   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ai_chat_sessions
-- ============================================================
CREATE TABLE ai_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT DEFAULT 'New Conversation',
  context    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ai_chat_messages
-- ============================================================
CREATE TABLE ai_chat_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content    TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- learning_hours_log
-- ============================================================
CREATE TABLE learning_hours_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  reference_id  UUID,
  hours_spent   NUMERIC(6,2) NOT NULL,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT DEFAULT 'info',
  is_read    BOOLEAN DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- api_usage_logs  (developer dashboard)
-- ============================================================
CREATE TABLE api_usage_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id UUID REFERENCES users(id),
  endpoint    TEXT NOT NULL,
  method      TEXT NOT NULL,
  status_code INTEGER,
  latency_ms  INTEGER,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  UUID,
  ip_address TEXT,
  user_agent TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_org          ON users(organization_id);
CREATE INDEX idx_users_role         ON users(role);
CREATE INDEX idx_ucp_user           ON user_competency_profiles(user_id);
CREATE INDEX idx_gap_user           ON skill_gap_reports(user_id);
CREATE INDEX idx_gap_details_report ON skill_gap_details(report_id);
CREATE INDEX idx_pathway_user       ON learning_pathways(user_id);
CREATE INDEX idx_enrollment_user    ON course_enrollments(user_id);
CREATE INDEX idx_attempts_user      ON assessment_attempts(user_id);
CREATE INDEX idx_chat_user          ON ai_chat_sessions(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_api_logs_dev       ON api_usage_logs(developer_id, created_at DESC);
CREATE INDEX idx_audit_created      ON audit_logs(created_at DESC);
CREATE INDEX idx_igot_tags          ON igot_courses USING GIN(competency_tags);
CREATE INDEX idx_cf_keywords        ON competency_framework USING GIN(keywords);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments','organizations','job_roles','users','competency_framework',
    'user_competency_profiles','igot_courses','tpac_training_programmes',
    'learning_pathways','course_enrollments','assessment_banks',
    'assessments','ai_chat_sessions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', t);
  END LOOP;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_competency_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gap_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gap_details        ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_pathways        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathway_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_hours_log       ENABLE ROW LEVEL SECURITY;

-- users: own row
CREATE POLICY users_own_select ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_own_update ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_own_insert ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- competency profiles
CREATE POLICY ucp_own ON user_competency_profiles USING (auth.uid() = user_id);

-- gap reports
CREATE POLICY gap_reports_own ON skill_gap_reports USING (auth.uid() = user_id);
CREATE POLICY gap_details_own ON skill_gap_details
  USING (report_id IN (SELECT id FROM skill_gap_reports WHERE user_id = auth.uid()));

-- pathways
CREATE POLICY pathways_own ON learning_pathways USING (auth.uid() = user_id);
CREATE POLICY pathway_items_own ON pathway_items
  USING (pathway_id IN (SELECT id FROM learning_pathways WHERE user_id = auth.uid()));

-- enrollments, attempts, chat, hours, notifications
CREATE POLICY enrollments_own       ON course_enrollments  USING (auth.uid() = user_id);
CREATE POLICY attempts_own          ON assessment_attempts USING (auth.uid() = user_id);
CREATE POLICY chat_sessions_own     ON ai_chat_sessions    USING (auth.uid() = user_id);
CREATE POLICY chat_messages_own     ON ai_chat_messages
  USING (session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid()));
CREATE POLICY notifications_own     ON notifications        USING (auth.uid() = user_id);
CREATE POLICY hours_own             ON learning_hours_log   USING (auth.uid() = user_id);
