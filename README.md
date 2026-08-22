# EduMantra — AI-Enabled Skill Intelligence & Learning Platform

> Personalized competency assessment, skill-gap analysis, iGOT Karmayogi integration, AI-powered MCQ generation, and 5-role dashboards for India's Official Statistical System.

---

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Backend    | Node.js 18+, Express 4                  |
| Database   | Supabase (PostgreSQL + Auth + RLS)      |
| AI         | OpenAI GPT-4o-mini (LLM)               |
| Deployment | Vercel (serverless)                     |
| Frontend   | Vanilla HTML/CSS/JS (no framework)      |

---

## Features

- **AI Competency Assessment** — maps user profiles to 4 competency domains (Statistical, Technical, Digital Governance, Behavioural)
- **Skill Gap Analysis** — AI-generated narrative reports with severity ratings
- **Personalized Learning Pathways** — LLM-curated course sequences from iGOT + TPAC
- **iGOT Karmayogi Integration** — course sync, enrolment, progress tracking
- **AI Assessment Engine** — upload documents/text → generate MCQs → instant feedback
- **AI Virtual Assistant** — context-aware chat assistant for learner support
- **5 Role Dashboards** — Student, Instructor, Organization Admin, Parent, Developer
- **Secure & Scalable** — JWT auth, RLS policies, rate limiting, helmet, audit logs

---

## Project Structure

```
EduMantra/
├── src/
│   ├── server.js                  # Express app entry point
│   ├── config/
│   │   ├── env.js                 # Environment config
│   │   ├── logger.js              # Winston logger
│   │   └── supabase.js            # Supabase clients (public + admin)
│   ├── middleware/
│   │   ├── auth.js                # JWT auth + role-based access
│   │   ├── auditLog.js            # Audit trail middleware
│   │   └── errorHandler.js        # Global error handler
│   └── routes/
│       ├── auth.js                # Register, login, refresh, logout
│       ├── profile.js             # User profile CRUD
│       ├── competency.js          # Competency framework + user profiles
│       ├── skillGap.js            # AI skill gap analysis
│       ├── pathway.js             # AI learning pathway generation
│       ├── igot.js                # iGOT course sync + enrolment
│       ├── assessment.js          # AI MCQ generation + attempts
│       ├── analytics.js           # Dashboard data (all 5 roles)
│       ├── assistant.js           # AI chat assistant
│       ├── developer.js           # Developer admin + API keys
│       ├── organization.js        # Org admin + member management
│       └── notifications.js       # Notifications + broadcast
├── public/
│   ├── index.html                 # Login / Register page
│   ├── css/
│   │   └── main.css               # Global styles
│   ├── js/
│   │   └── api.js                 # API client + Auth + UI utilities
│   └── dashboards/
│       ├── student.html           # Student dashboard
│       ├── instructor.html        # Instructor dashboard
│       ├── organization.html      # Organization admin dashboard
│       ├── parent.html            # Parent dashboard
│       └── developer.html         # Developer dashboard
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Full DB schema + RLS policies
├── .env.example                   # Environment variable template
├── .gitignore
├── vercel.json                    # Vercel deployment config
└── package.json
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-org/edumantra.git
cd edumantra
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and API keys from **Project Settings → API**

### 3. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
JWT_SECRET=your-random-secret
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B — Vercel Dashboard

1. Push code to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables from `.env.example` in **Project Settings → Environment Variables**
4. Deploy

> The `vercel.json` in this repo handles all routing — no additional config needed.

---

## API Overview

Base URL: `/api/v1`

All endpoints require `Authorization: Bearer <token>` except auth endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login → returns access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET  | `/auth/me` | Get current user profile |
| GET  | `/competencies` | List competency framework |
| GET  | `/competencies/my-profile` | My competency levels |
| POST | `/skill-gap/analyze` | Run AI skill gap analysis |
| GET  | `/skill-gap/reports` | List my gap reports |
| POST | `/pathways/generate` | Generate AI learning pathway |
| GET  | `/igot/courses` | Browse iGOT course catalogue |
| POST | `/igot/enroll` | Enrol in a course |
| POST | `/assessments/generate` | Upload content → generate MCQs |
| POST | `/assessments/:id/submit` | Submit quiz answers |
| POST | `/assistant/chat` | Chat with AI assistant |
| GET  | `/analytics/student` | Student dashboard data |
| GET  | `/analytics/instructor` | Instructor dashboard data |
| GET  | `/analytics/organization` | Organisation analytics |
| GET  | `/analytics/parent` | Parent dashboard data |
| GET  | `/analytics/developer` | Developer / system analytics |

---

## Role → Dashboard Mapping

| Role | Dashboard | Key Features |
|------|-----------|--------------|
| `student` | `/dashboards/student.html` | Courses, skill gap, pathway, AI assistant, quizzes |
| `instructor` | `/dashboards/instructor.html` | Create AI quizzes, publish, student results |
| `organization_admin` | `/dashboards/organization.html` | Members, competency map, enrollments, broadcast |
| `parent` | `/dashboards/parent.html` | Child progress, quiz results, skill gap view |
| `developer` | `/dashboards/developer.html` | System stats, API logs, API reference, org management |

---

## Supabase Row Level Security

All user-facing tables have RLS enabled. Key policies:

- Users can only read/update **their own** profile row
- Competency profiles, gap reports, pathways, enrollments — **own data only**
- Chat sessions and messages — **own sessions only**
- Organisation admins query members via server-side `supabaseAdmin` client (bypasses RLS)
- Developer routes use the service-role key with full access

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `JWT_SECRET` | ✅ | Secret for JWT signing |
| `OPENAI_API_KEY` | ⚠️ | Required for AI features (skill gap, MCQs, assistant) |
| `OPENAI_MODEL` | — | Default: `gpt-4o-mini` |
| `IGOT_BASE_URL` | — | iGOT API base URL |
| `IGOT_API_KEY` | — | Required for course sync from iGOT |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |
| `PORT` | — | Server port, default `3000` |

---

## Seed Data (Optional)

To get started quickly, insert sample competency framework data via Supabase SQL Editor:

```sql
-- Sample competencies
INSERT INTO competency_framework (name, code, domain, description, required_level, keywords) VALUES
('Survey Design',        'SURV-001', 'statistical',          'Design and execution of statistical surveys',    'intermediate', ARRAY['survey','sampling','questionnaire']),
('Python Programming',   'TECH-001', 'technical',            'Data analysis using Python and pandas/numpy',     'intermediate', ARRAY['python','pandas','numpy','scripting']),
('Data Visualization',   'TECH-002', 'technical',            'Charts, dashboards using Power BI / Tableau',    'beginner',      ARRAY['visualization','charts','powerbi','tableau']),
('Cybersecurity Basics', 'DIGI-001', 'digital_governance',   'Data protection and government IT security',     'beginner',      ARRAY['cybersecurity','data privacy','security']),
('Leadership',           'BEHA-001', 'behavioural_managerial','Team leadership and people management',           'intermediate', ARRAY['leadership','management','team']);
```

---

## License

MIT © EduMantra Team
