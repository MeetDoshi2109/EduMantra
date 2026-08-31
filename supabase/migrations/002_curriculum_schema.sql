-- ============================================================
-- EduMantra – AI-Powered Adaptive School Learning Platform
-- Migration 002: Curriculum & Adaptive Learning Schema
-- Extends 001_initial_schema.sql — does NOT modify existing tables
-- ============================================================

-- ============================================================
-- NEW ENUMS
-- ============================================================
CREATE TYPE board_type AS ENUM ('cbse', 'ncert', 'gujarat_state', 'maharashtra_state', 'other');
CREATE TYPE medium_type AS ENUM ('english', 'hindi', 'gujarati', 'marathi', 'other');
CREATE TYPE question_type_edu AS ENUM ('mcq', 'true_false', 'fill_blank', 'short_answer', 'numerical', 'conceptual', 'application');
CREATE TYPE validation_status AS ENUM ('pending', 'approved', 'rejected', 'needs_review');
CREATE TYPE mastery_level_edu AS ENUM ('not_started', 'novice', 'developing', 'proficient', 'advanced', 'mastered');
CREATE TYPE session_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE recommendation_type AS ENUM ('revise', 'practice', 'assess', 'explore');
CREATE TYPE content_source AS ENUM ('ncert', 'cbse', 'state_board', 'teacher_created', 'curated');
CREATE TYPE activity_type_edu AS ENUM ('assessment', 'revision', 'tutor_session', 'content_read', 'practice');

-- ============================================================
-- CURRICULUM HIERARCHY
-- ============================================================

-- boards (CBSE, NCERT, Gujarat State Board, etc.)
CREATE TABLE boards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,    -- 'cbse', 'ncert', 'gujarat'
  board_type  board_type NOT NULL DEFAULT 'cbse',
  description TEXT,
  country     TEXT DEFAULT 'India',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- classes (Grade 1–10 within a board)
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  grade       INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  name        TEXT NOT NULL,           -- 'Class 7', 'Grade 7'
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_id, grade)
);

-- mediums (languages of instruction)
CREATE TABLE mediums (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,           -- 'English', 'Hindi', 'Gujarati'
  code        TEXT UNIQUE NOT NULL,    -- 'en', 'hi', 'gu'
  medium_type medium_type NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- subjects (per board — Math, Science, English, etc.)
CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  description TEXT,
  icon_url    TEXT,
  color_hex   TEXT,                    -- for UI theming
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (board_id, code)
);

-- books (specific textbook per board/class/subject/medium)
CREATE TABLE books (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id    UUID NOT NULL REFERENCES boards(id),
  class_id    UUID NOT NULL REFERENCES classes(id),
  subject_id  UUID NOT NULL REFERENCES subjects(id),
  medium_id   UUID REFERENCES mediums(id),
  title       TEXT NOT NULL,
  isbn        TEXT,
  publisher   TEXT,
  edition     TEXT,
  academic_year TEXT,
  cover_url   TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- chapters (within a book)
CREATE TABLE chapters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_number  INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  learning_goals  TEXT[],             -- high-level goals for this chapter
  estimated_hours NUMERIC(4,1),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (book_id, chapter_number)
);

-- topics (within a chapter)
CREATE TABLE topics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id      UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  sequence_order  INTEGER DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- concepts (atomic learning units within a topic)
CREATE TABLE concepts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id        UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  key_terms       TEXT[],
  sequence_order  INTEGER DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- learning_objectives (measurable outcomes per concept)
CREATE TABLE learning_objectives (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id  UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  objective   TEXT NOT NULL,
  verb        TEXT,                   -- Bloom's taxonomy verb: recall, understand, apply, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- concept_prerequisites (DAG for prerequisite tracking)
CREATE TABLE concept_prerequisites (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id          UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  prerequisite_id     UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  is_critical         BOOLEAN DEFAULT TRUE,   -- critical = must master before advancing
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (concept_id, prerequisite_id),
  CHECK (concept_id != prerequisite_id)
);

-- ============================================================
-- CURRICULUM CONTENT
-- ============================================================

-- curriculum_content (source-attributed, versioned curriculum material)
CREATE TABLE curriculum_content (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id            UUID REFERENCES boards(id),
  class_id            UUID REFERENCES classes(id),
  subject_id          UUID REFERENCES subjects(id),
  book_id             UUID REFERENCES books(id),
  chapter_id          UUID REFERENCES chapters(id),
  topic_id            UUID REFERENCES topics(id),
  concept_id          UUID REFERENCES concepts(id),
  learning_objective_id UUID REFERENCES learning_objectives(id),
  title               TEXT NOT NULL,
  content_text        TEXT,           -- extracted/permitted text content
  content_type        TEXT DEFAULT 'text',  -- text | reference | image | video
  source              content_source NOT NULL DEFAULT 'ncert',
  source_reference    TEXT,           -- URL or citation
  source_page         TEXT,
  language            TEXT DEFAULT 'en',
  version             TEXT DEFAULT '1.0',
  is_permitted        BOOLEAN DEFAULT TRUE,  -- licensing check
  is_verified         BOOLEAN DEFAULT FALSE, -- teacher/admin verified
  metadata            JSONB,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- content_versions (audit trail for content changes)
CREATE TABLE content_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id      UUID NOT NULL REFERENCES curriculum_content(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  content_text    TEXT,
  changed_by      UUID REFERENCES users(id),
  change_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUESTION BANK
-- ============================================================

-- question_bank (curriculum-aware questions, separate from legacy questions table)
CREATE TABLE question_bank (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id              UUID REFERENCES boards(id),
  class_id              UUID REFERENCES classes(id),
  subject_id            UUID REFERENCES subjects(id),
  book_id               UUID REFERENCES books(id),
  chapter_id            UUID REFERENCES chapters(id),
  topic_id              UUID REFERENCES topics(id),
  concept_id            UUID REFERENCES concepts(id),
  learning_objective_id UUID REFERENCES learning_objectives(id),
  content_id            UUID REFERENCES curriculum_content(id),  -- source content
  question_text         TEXT NOT NULL,
  question_type         question_type_edu NOT NULL DEFAULT 'mcq',
  options               JSONB,                -- [{key,text}] for MCQ/TF, null for others
  correct_answer        TEXT NOT NULL,
  explanation           TEXT,
  difficulty            question_difficulty NOT NULL DEFAULT 'medium',
  language              TEXT DEFAULT 'en',
  tags                  TEXT[],
  ai_generated          BOOLEAN DEFAULT TRUE,
  created_by            UUID REFERENCES users(id),
  validation_status     validation_status DEFAULT 'pending',
  validated_by          UUID REFERENCES users(id),
  validated_at          TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT TRUE,
  times_used            INTEGER DEFAULT 0,
  times_correct         INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- question_validations (AI + rule-based validation results)
CREATE TABLE question_validations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL,       -- 'ai_check' | 'rule_check' | 'duplicate_check' | 'teacher_review'
  is_valid        BOOLEAN,
  confidence      NUMERIC(3,2),
  issues          TEXT[],
  suggestion      TEXT,
  validated_by    UUID REFERENCES users(id),  -- NULL for automated
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CURRICULUM ASSESSMENTS
-- ============================================================

-- curriculum_assessments (curriculum-aware, separate from legacy assessments)
CREATE TABLE curriculum_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id        UUID REFERENCES boards(id),
  class_id        UUID REFERENCES classes(id),
  subject_id      UUID REFERENCES subjects(id),
  chapter_id      UUID REFERENCES chapters(id),
  topic_id        UUID REFERENCES topics(id),
  title           TEXT NOT NULL,
  description     TEXT,
  assessment_type TEXT DEFAULT 'adaptive',  -- 'adaptive' | 'fixed' | 'practice'
  total_questions INTEGER DEFAULT 10,
  time_limit_mins INTEGER,
  passing_score   NUMERIC(5,2) DEFAULT 60,
  difficulty      question_difficulty DEFAULT 'medium',
  is_adaptive     BOOLEAN DEFAULT TRUE,
  is_published    BOOLEAN DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- assessment_question_pool (questions available for an assessment)
CREATE TABLE assessment_question_pool (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID NOT NULL REFERENCES curriculum_assessments(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  sequence_order  INTEGER,            -- NULL for adaptive (engine picks order)
  UNIQUE (assessment_id, question_id)
);

-- ============================================================
-- ADAPTIVE ASSESSMENT ENGINE
-- ============================================================

-- adaptive_sessions (tracks state of an adaptive assessment session)
CREATE TABLE adaptive_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id       UUID REFERENCES curriculum_assessments(id),
  board_id            UUID REFERENCES boards(id),
  class_id            UUID REFERENCES classes(id),
  subject_id          UUID REFERENCES subjects(id),
  chapter_id          UUID REFERENCES chapters(id),
  topic_id            UUID REFERENCES topics(id),
  status              session_status DEFAULT 'active',
  current_difficulty  question_difficulty DEFAULT 'medium',
  questions_answered  INTEGER DEFAULT 0,
  questions_correct   INTEGER DEFAULT 0,
  consecutive_wrong   INTEGER DEFAULT 0,
  consecutive_correct INTEGER DEFAULT 0,
  max_questions       INTEGER DEFAULT 20,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  score               NUMERIC(5,2),
  ai_feedback         TEXT,
  performance_data    JSONB,         -- detailed per-topic/concept breakdown
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- adaptive_question_deliveries (which question was shown, answer, result)
CREATE TABLE adaptive_question_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES adaptive_sessions(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES question_bank(id),
  concept_id      UUID REFERENCES concepts(id),
  sequence        INTEGER NOT NULL,       -- order in this session
  difficulty      question_difficulty,
  student_answer  TEXT,
  is_correct      BOOLEAN,
  time_taken_secs INTEGER,
  hint_used       BOOLEAN DEFAULT FALSE,
  answered_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT KNOWLEDGE MODEL
-- ============================================================

-- student_mastery (per student × concept mastery, 0–100)
CREATE TABLE student_mastery (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id        UUID REFERENCES boards(id),
  class_id        UUID REFERENCES classes(id),
  subject_id      UUID REFERENCES subjects(id),
  chapter_id      UUID REFERENCES chapters(id),
  topic_id        UUID REFERENCES topics(id),
  concept_id      UUID NOT NULL REFERENCES concepts(id),
  mastery_score   NUMERIC(5,2) DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
  mastery_level   mastery_level_edu DEFAULT 'not_started',
  total_attempts  INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  last_assessed_at TIMESTAMPTZ,
  is_gap          BOOLEAN DEFAULT FALSE,  -- flagged as knowledge gap
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, concept_id)
);

-- mastery_history (temporal mastery changes for trend analysis)
CREATE TABLE mastery_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id      UUID NOT NULL REFERENCES concepts(id),
  mastery_score   NUMERIC(5,2) NOT NULL,
  delta           NUMERIC(5,2),           -- change from previous
  session_id      UUID REFERENCES adaptive_sessions(id),
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RECOMMENDATIONS & LEARNING PATHS
-- ============================================================

-- student_recommendations (AI-generated personalized recommendations)
CREATE TABLE student_recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            recommendation_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        INTEGER DEFAULT 1,
  subject_id      UUID REFERENCES subjects(id),
  chapter_id      UUID REFERENCES chapters(id),
  topic_id        UUID REFERENCES topics(id),
  concept_id      UUID REFERENCES concepts(id),
  metadata        JSONB,
  is_dismissed    BOOLEAN DEFAULT FALSE,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- curriculum_learning_paths (personalized learning paths)
CREATE TABLE curriculum_learning_paths (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  ai_rationale    TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  total_steps     INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- learning_path_items (ordered steps in a path)
CREATE TABLE learning_path_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id         UUID NOT NULL REFERENCES curriculum_learning_paths(id) ON DELETE CASCADE,
  sequence_order  INTEGER NOT NULL,
  activity_type   activity_type_edu NOT NULL,
  subject_id      UUID REFERENCES subjects(id),
  chapter_id      UUID REFERENCES chapters(id),
  topic_id        UUID REFERENCES topics(id),
  concept_id      UUID REFERENCES concepts(id),
  assessment_id   UUID REFERENCES curriculum_assessments(id),
  title           TEXT NOT NULL,
  description     TEXT,
  is_completed    BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- learning_activities (completed/scheduled student activities log)
CREATE TABLE learning_activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type   activity_type_edu NOT NULL,
  subject_id      UUID REFERENCES subjects(id),
  chapter_id      UUID REFERENCES chapters(id),
  topic_id        UUID REFERENCES topics(id),
  concept_id      UUID REFERENCES concepts(id),
  session_id      UUID REFERENCES adaptive_sessions(id),
  duration_mins   INTEGER,
  score           NUMERIC(5,2),
  completed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TUTOR SESSIONS
-- ============================================================

-- tutor_sessions (curriculum-grounded chat sessions)
CREATE TABLE tutor_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT DEFAULT 'New Tutor Session',
  board_id    UUID REFERENCES boards(id),
  class_id    UUID REFERENCES classes(id),
  subject_id  UUID REFERENCES subjects(id),
  chapter_id  UUID REFERENCES chapters(id),
  topic_id    UUID REFERENCES topics(id),
  concept_id  UUID REFERENCES concepts(id),
  session_id  UUID REFERENCES adaptive_sessions(id),  -- linked assessment session if any
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- tutor_messages (per-message in tutor session)
CREATE TABLE tutor_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT NOT NULL,
  tokens_used   INTEGER,
  question_id   UUID REFERENCES question_bank(id),  -- if message is about a specific question
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXTEND USERS TABLE
-- Add school-specific fields to existing users table
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS board_id   UUID REFERENCES boards(id),
  ADD COLUMN IF NOT EXISTS class_id   UUID REFERENCES classes(id),
  ADD COLUMN IF NOT EXISTS medium_id  UUID REFERENCES mediums(id),
  ADD COLUMN IF NOT EXISTS grade      INTEGER CHECK (grade BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS school_name TEXT,
  ADD COLUMN IF NOT EXISTS roll_number TEXT,
  ADD COLUMN IF NOT EXISTS section    TEXT;         -- 'A', 'B', 'C' class section

-- ============================================================
-- INDEXES
-- ============================================================
-- Curriculum hierarchy
CREATE INDEX idx_classes_board       ON classes(board_id);
CREATE INDEX idx_subjects_board      ON subjects(board_id);
CREATE INDEX idx_books_class_subject ON books(class_id, subject_id);
CREATE INDEX idx_chapters_book       ON chapters(book_id);
CREATE INDEX idx_topics_chapter      ON topics(chapter_id);
CREATE INDEX idx_concepts_topic      ON concepts(topic_id);
CREATE INDEX idx_prereqs_concept     ON concept_prerequisites(concept_id);
CREATE INDEX idx_prereqs_prereq      ON concept_prerequisites(prerequisite_id);

-- Content
CREATE INDEX idx_content_chapter     ON curriculum_content(chapter_id);
CREATE INDEX idx_content_topic       ON curriculum_content(topic_id);
CREATE INDEX idx_content_concept     ON curriculum_content(concept_id);
CREATE INDEX idx_content_board_class ON curriculum_content(board_id, class_id);

-- Question bank
CREATE INDEX idx_qbank_chapter       ON question_bank(chapter_id);
CREATE INDEX idx_qbank_topic         ON question_bank(topic_id);
CREATE INDEX idx_qbank_concept       ON question_bank(concept_id);
CREATE INDEX idx_qbank_difficulty    ON question_bank(difficulty);
CREATE INDEX idx_qbank_status        ON question_bank(validation_status, is_active);
CREATE INDEX idx_qbank_board_class   ON question_bank(board_id, class_id);
CREATE INDEX idx_qbank_tags          ON question_bank USING GIN(tags);

-- Adaptive sessions
CREATE INDEX idx_asessions_student   ON adaptive_sessions(student_id, status);
CREATE INDEX idx_asessions_topic     ON adaptive_sessions(topic_id);
CREATE INDEX idx_deliveries_session  ON adaptive_question_deliveries(session_id);
CREATE INDEX idx_deliveries_concept  ON adaptive_question_deliveries(concept_id);

-- Mastery
CREATE INDEX idx_mastery_student     ON student_mastery(student_id);
CREATE INDEX idx_mastery_concept     ON student_mastery(student_id, concept_id);
CREATE INDEX idx_mastery_subject     ON student_mastery(student_id, subject_id);
CREATE INDEX idx_mastery_gaps        ON student_mastery(student_id, is_gap) WHERE is_gap = TRUE;
CREATE INDEX idx_mastery_history     ON mastery_history(student_id, recorded_at DESC);

-- Recommendations
CREATE INDEX idx_recs_student        ON student_recommendations(student_id, is_dismissed, priority);

-- Tutor
CREATE INDEX idx_tutor_student       ON tutor_sessions(student_id);
CREATE INDEX idx_tutor_msgs_session  ON tutor_messages(session_id, created_at);

-- Activities
CREATE INDEX idx_activities_student  ON learning_activities(student_id, completed_at DESC);

-- Users (new columns)
CREATE INDEX idx_users_board_class   ON users(board_id, class_id);

-- ============================================================
-- updated_at triggers for new tables
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boards', 'subjects', 'books', 'chapters', 'topics', 'concepts',
    'curriculum_content', 'question_bank',
    'curriculum_assessments', 'student_mastery',
    'curriculum_learning_paths', 'tutor_sessions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', t);
  END LOOP;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (new tables)
-- ============================================================
ALTER TABLE adaptive_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptive_question_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_mastery             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_history             ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_recommendations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_learning_paths   ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_content          ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank               ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_validations        ENABLE ROW LEVEL SECURITY;

-- Students own their sessions, mastery, recommendations, paths
CREATE POLICY adaptive_sessions_own ON adaptive_sessions
  USING (auth.uid() = student_id);

CREATE POLICY deliveries_own ON adaptive_question_deliveries
  USING (session_id IN (SELECT id FROM adaptive_sessions WHERE student_id = auth.uid()));

CREATE POLICY mastery_own ON student_mastery
  USING (auth.uid() = student_id);

CREATE POLICY mastery_history_own ON mastery_history
  USING (auth.uid() = student_id);

CREATE POLICY recommendations_own ON student_recommendations
  USING (auth.uid() = student_id);

CREATE POLICY learning_paths_own ON curriculum_learning_paths
  USING (auth.uid() = student_id);

CREATE POLICY path_items_own ON learning_path_items
  USING (path_id IN (SELECT id FROM curriculum_learning_paths WHERE student_id = auth.uid()));

CREATE POLICY activities_own ON learning_activities
  USING (auth.uid() = student_id);

CREATE POLICY tutor_sessions_own ON tutor_sessions
  USING (auth.uid() = student_id);

CREATE POLICY tutor_messages_own ON tutor_messages
  USING (session_id IN (SELECT id FROM tutor_sessions WHERE student_id = auth.uid()));

-- Curriculum content: all authenticated users can read, only instructors/admins can write
CREATE POLICY content_read ON curriculum_content
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_permitted = TRUE);

CREATE POLICY content_write ON curriculum_content
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('instructor', 'organization_admin', 'developer'))
  );

-- Question bank: approved questions readable by all authenticated users
CREATE POLICY questions_read ON question_bank
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND is_active = TRUE AND validation_status = 'approved'
  );

CREATE POLICY questions_instructor_read ON question_bank
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('instructor', 'organization_admin', 'developer'))
  );

CREATE POLICY questions_write ON question_bank
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('instructor', 'organization_admin', 'developer'))
  );

CREATE POLICY question_validations_read ON question_validations
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('instructor', 'organization_admin', 'developer'))
  );
