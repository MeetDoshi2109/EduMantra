-- ============================================================
-- EduMantra – Full Schema (Safe / Idempotent)
-- Run this ONCE in Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS (safe: only create if not exists)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'student','instructor','parent','organization_admin','developer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competency_domain AS ENUM (
    'science','technology','engineering','mathematics'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competency_level AS ENUM (
    'none','beginner','intermediate','advanced','expert'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gap_severity AS ENUM ('critical','high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment_type AS ENUM ('mcq','quiz','scenario','practical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('document','presentation','video','url','text');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM (
    'not_started','in_progress','completed','dropped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_difficulty AS ENUM ('easy','medium','hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES departments(id),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  type          TEXT DEFAULT 'government',
  address       TEXT,
  state         TEXT,
  district      TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  logo_url      TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: job_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS job_roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES departments(id),
  grade_level   TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: users  (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
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
  parent_of           UUID[],
  api_key             TEXT UNIQUE,
  api_key_created_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: competency_framework
-- ============================================================
CREATE TABLE IF NOT EXISTS competency_framework (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  code           TEXT UNIQUE NOT NULL,
  domain         competency_domain NOT NULL,
  description    TEXT,
  required_level competency_level DEFAULT 'intermediate',
  keywords       TEXT[],
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: job_role_competencies
-- ============================================================
CREATE TABLE IF NOT EXISTS job_role_competencies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_role_id    UUID NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  competency_id  UUID NOT NULL REFERENCES competency_framework(id) ON DELETE CASCADE,
  required_level competency_level NOT NULL DEFAULT 'intermediate',
  priority       INTEGER DEFAULT 1,
  is_mandatory   BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_role_id, competency_id)
);

-- ============================================================
-- TABLE: user_competency_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_competency_profiles (
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
-- TABLE: skill_gap_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_gap_reports (
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
-- TABLE: skill_gap_details
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_gap_details (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id          UUID NOT NULL REFERENCES skill_gap_reports(id) ON DELETE CASCADE,
  competency_id      UUID NOT NULL REFERENCES competency_framework(id),
  current_level      competency_level,
  required_level     competency_level,
  gap_score          NUMERIC(5,2),
  severity           gap_severity,
  recommended_action TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: igot_courses
-- ============================================================
CREATE TABLE IF NOT EXISTS igot_courses (
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
-- TABLE: tpac_training_programmes
-- ============================================================
CREATE TABLE IF NOT EXISTS tpac_training_programmes (
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
-- TABLE: learning_pathways
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_pathways (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gap_report_id     UUID REFERENCES skill_gap_reports(id),
  title             TEXT NOT NULL,
  description       TEXT,
  ai_rationale      TEXT,
  total_hours       NUMERIC(8,2),
  target_completion DATE,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: pathway_items
-- ============================================================
CREATE TABLE IF NOT EXISTS pathway_items (
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
-- TABLE: course_enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS course_enrollments (
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
-- TABLE: assessment_banks
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_banks (
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
-- TABLE: assessments
-- ============================================================
CREATE TABLE IF NOT EXISTS assessments (
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
-- TABLE: questions
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id  UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  options        JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation    TEXT,
  difficulty     question_difficulty DEFAULT 'medium',
  competency_id  UUID REFERENCES competency_framework(id),
  ai_generated   BOOLEAN DEFAULT TRUE,
  sequence_order INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: assessment_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_attempts (
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
-- TABLE: ai_chat_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT DEFAULT 'New Conversation',
  context    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: ai_chat_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  tokens_used INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: learning_hours_log
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_hours_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  reference_id  UUID,
  hours_spent   NUMERIC(6,2) NOT NULL,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
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
-- TABLE: api_usage_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id UUID REFERENCES users(id),
  endpoint     TEXT NOT NULL,
  method       TEXT NOT NULL,
  status_code  INTEGER,
  latency_ms   INTEGER,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
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
-- INDEXES (safe)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_org           ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX IF NOT EXISTS idx_ucp_user            ON user_competency_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_gap_user            ON skill_gap_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_gap_details_report  ON skill_gap_details(report_id);
CREATE INDEX IF NOT EXISTS idx_pathway_user        ON learning_pathways(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_user     ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user       ON assessment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user           ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_api_logs_dev        ON api_usage_logs(developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_igot_tags           ON igot_courses USING GIN(competency_tags);
CREATE INDEX IF NOT EXISTS idx_cf_keywords         ON competency_framework USING GIN(keywords);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Apply trigger to each table (safe: drop first if exists)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments','organizations','job_roles','users','competency_framework',
    'user_competency_profiles','igot_courses','tpac_training_programmes',
    'learning_pathways','course_enrollments','assessment_banks',
    'assessments','ai_chat_sessions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I;', t);
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

-- Drop existing policies before recreating (safe re-run)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', r.policyname, r.tablename);
  END LOOP;
END $$;

-- users: own row only
CREATE POLICY users_own_select ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_own_update ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_own_insert ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- competency profiles
CREATE POLICY ucp_own ON user_competency_profiles
  FOR ALL USING (auth.uid() = user_id);

-- skill gap
CREATE POLICY gap_reports_own ON skill_gap_reports
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY gap_details_own ON skill_gap_details
  FOR ALL USING (
    report_id IN (SELECT id FROM skill_gap_reports WHERE user_id = auth.uid())
  );

-- pathways
CREATE POLICY pathways_own ON learning_pathways
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY pathway_items_own ON pathway_items
  FOR ALL USING (
    pathway_id IN (SELECT id FROM learning_pathways WHERE user_id = auth.uid())
  );

-- enrollments, attempts, chat, hours, notifications
CREATE POLICY enrollments_own   ON course_enrollments  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY attempts_own      ON assessment_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY chat_sessions_own ON ai_chat_sessions    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY chat_messages_own ON ai_chat_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid())
  );
CREATE POLICY notifications_own ON notifications      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY hours_own         ON learning_hours_log FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEED: Competency Framework (STEM domains)
-- ============================================================
INSERT INTO competency_framework (name, code, domain, description, required_level, keywords)
VALUES
  -- Science
  ('Scientific Inquiry',           'SCI-001', 'science',     'Principles of scientific method, hypothesis testing and evidence-based research',     'intermediate', ARRAY['science','research','experiment','hypothesis','inquiry']),
  ('Biology & Life Sciences',      'SCI-002', 'science',     'Foundations of biology, ecology, life systems and living organisms',                   'beginner',     ARRAY['biology','life science','ecology','organisms','cells']),
  ('Chemistry Fundamentals',       'SCI-003', 'science',     'Atomic structure, chemical reactions, periodic table and laboratory skills',           'beginner',     ARRAY['chemistry','atoms','reactions','elements','lab']),
  ('Physics Principles',           'SCI-004', 'science',     'Mechanics, thermodynamics, electromagnetism and modern physics',                       'intermediate', ARRAY['physics','mechanics','energy','forces','motion']),
  ('Earth & Environmental Science','SCI-005', 'science',     'Earth systems, climate, geology, ecology and environmental sustainability',             'beginner',     ARRAY['earth science','climate','geology','environment','sustainability']),
  ('Data-Driven Science',          'SCI-006', 'science',     'Applying quantitative methods and data analysis in scientific research',               'intermediate', ARRAY['data science','quantitative','analysis','research methods','measurement']),

  -- Technology
  ('Programming Fundamentals',     'TECH-001', 'technology',  'Core programming concepts using Python, logic, and problem-solving',                  'intermediate', ARRAY['python','programming','algorithms','coding','logic']),
  ('Web Development',              'TECH-002', 'technology',  'Building web applications with HTML, CSS, JavaScript and frameworks',                  'intermediate', ARRAY['web','html','css','javascript','frontend']),
  ('Databases & SQL',              'TECH-003', 'technology',  'Designing and querying relational databases using SQL',                                'intermediate', ARRAY['SQL','database','PostgreSQL','MySQL','query']),
  ('Cybersecurity Basics',         'TECH-004', 'technology',  'Information security principles, threat awareness and safe digital practices',        'beginner',     ARRAY['cybersecurity','security','password','threats','data breach']),
  ('Cloud Computing',              'TECH-005', 'technology',  'Cloud platforms (AWS/Azure/GCP) for storage, compute and deployment',                 'beginner',     ARRAY['cloud','AWS','Azure','GCP','serverless']),
  ('AI & Machine Learning',        'TECH-006', 'technology',  'Applied ML concepts, model building and AI tools for problem solving',                'beginner',     ARRAY['AI','ML','machine learning','neural networks','prediction']),
  ('Data Visualization',           'TECH-007', 'technology',  'Creating dashboards and charts using modern BI and visualisation tools',               'intermediate', ARRAY['visualization','dashboard','Power BI','Tableau','charts']),
  ('APIs & Digital Integration',   'TECH-008', 'technology',  'Working with REST APIs, open data portals and digital data exchange',                 'beginner',     ARRAY['API','REST','JSON','integration','open data']),

  -- Engineering
  ('Systems Thinking',             'ENG-001', 'engineering',  'Understanding complex systems, feedback loops and emergent behaviour',                 'intermediate', ARRAY['systems','design','architecture','feedback','complexity']),
  ('Engineering Design Process',   'ENG-002', 'engineering',  'Structured approach to problem identification, prototyping and iterative design',      'intermediate', ARRAY['design thinking','prototype','iteration','problem solving','engineering']),
  ('Electrical Engineering Basics','ENG-003', 'engineering',  'Circuits, electronics, sensors and basic electrical principles',                       'beginner',     ARRAY['circuits','electronics','sensors','voltage','current']),
  ('Mechanical Engineering Basics','ENG-004', 'engineering',  'Mechanics of materials, forces, machines and structural concepts',                     'beginner',     ARRAY['mechanics','materials','structures','machines','forces']),
  ('Software Engineering',         'ENG-005', 'engineering',  'Software development lifecycle, testing, version control and deployment',              'intermediate', ARRAY['software','SDLC','git','testing','deployment']),
  ('Infrastructure & Networks',    'ENG-006', 'engineering',  'Computer networks, protocols, routing and IT infrastructure management',               'beginner',     ARRAY['networking','TCP/IP','routing','infrastructure','protocols']),

  -- Mathematics
  ('Algebra & Functions',          'MATH-001', 'mathematics', 'Variables, equations, functions and algebraic reasoning',                              'intermediate', ARRAY['algebra','equations','functions','variables','expressions']),
  ('Statistics & Probability',     'MATH-002', 'mathematics', 'Descriptive stats, probability theory, distributions and inference',                   'intermediate', ARRAY['statistics','probability','distributions','inference','data']),
  ('Calculus',                     'MATH-003', 'mathematics', 'Differential and integral calculus with real-world applications',                      'intermediate', ARRAY['calculus','derivatives','integrals','limits','differentiation']),
  ('Discrete Mathematics',         'MATH-004', 'mathematics', 'Logic, sets, combinatorics, graph theory and number theory',                           'intermediate', ARRAY['discrete math','logic','sets','graphs','combinatorics']),
  ('Linear Algebra',               'MATH-005', 'mathematics', 'Vectors, matrices, transformations and their applications in computing',               'intermediate', ARRAY['linear algebra','matrices','vectors','transformations','eigenvalues']),
  ('Mathematical Modelling',       'MATH-006', 'mathematics', 'Building and analysing mathematical models to solve real-world problems',              'intermediate', ARRAY['modelling','simulation','optimization','analysis','problem solving'])
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED: Sample Job Roles
-- ============================================================
INSERT INTO job_roles (title, code, grade_level, description) VALUES
  ('Statistical Officer',          'JR-001', 'Group B', 'Conducts surveys, data collection and basic analysis'),
  ('Senior Statistical Officer',   'JR-002', 'Group A', 'Leads survey design, data quality and reporting'),
  ('Deputy Director (Statistics)', 'JR-003', 'Group A', 'Manages statistical operations and policy support'),
  ('Data Analyst',                 'JR-004', 'Group B', 'Analyses datasets using technical tools and software'),
  ('IT Officer',                   'JR-005', 'Group B', 'Manages digital infrastructure and data systems')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- VERIFY: list created tables
-- ============================================================
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
