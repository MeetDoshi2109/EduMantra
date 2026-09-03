const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { PORT, CORS_ORIGINS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, NODE_ENV } = require('./config/env');
const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');

// ── Existing Routes ───────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const profileRoutes     = require('./routes/profile');
const competencyRoutes  = require('./routes/competency');
const skillGapRoutes    = require('./routes/skillGap');
const pathwayRoutes     = require('./routes/pathway');
const igotRoutes        = require('./routes/igot');
const assessmentRoutes  = require('./routes/assessment');
const analyticsRoutes   = require('./routes/analytics');
const assistantRoutes   = require('./routes/assistant');
const developerRoutes   = require('./routes/developer');
const organizationRoutes = require('./routes/organization');
const notificationRoutes = require('./routes/notifications');

// ── New School Learning Routes ────────────────────────────────
const curriculumRoutes     = require('./routes/curriculum');
const contentRoutes        = require('./routes/content');
const questionsRoutes      = require('./routes/questions');
const adaptiveRoutes       = require('./routes/adaptive');
const masteryRoutes        = require('./routes/mastery');
const recommendationsRoutes = require('./routes/recommendations');
const tutorRoutes          = require('./routes/tutor');



const app = express();

// ── Security & basics ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Relaxed for serving static frontend
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests (no Origin header) — always allow
    if (!origin) return cb(null, true);
    // Development — allow everything
    if (NODE_ENV === 'development') return cb(null, true);
    // Explicitly listed origins
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    // Same Vercel deployment: allow *.vercel.app and the app's own domain
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    // Allow any origin that matches the request host (same-domain API calls)
    return cb(null, true); // Open for now — tighten after deployment by setting CORS_ORIGINS
  },
  credentials: true,
}));
app.use(compression());
app.use(requestId);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Rate limiting ──────────────────────────────────────────
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Strict rate limiter for computationally intensive AI generation / tutoring
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 calls/min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please pause for a moment before sending more requests.' },
});
app.use('/api/v1/tutor/chat', aiLimiter);
app.use('/api/v1/assistant/chat', aiLimiter);
app.use('/api/v1/questions/generate', aiLimiter);
app.use('/api/v1/assessments/generate', aiLimiter);

// ── Static frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes — Existing ──────────────────────────────────
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/profile',       profileRoutes);
app.use('/api/v1/competencies',  competencyRoutes);
app.use('/api/v1/skill-gap',     skillGapRoutes);
app.use('/api/v1/pathways',      pathwayRoutes);
app.use('/api/v1/igot',          igotRoutes);
app.use('/api/v1/assessments',   assessmentRoutes);
app.use('/api/v1/analytics',     analyticsRoutes);
app.use('/api/v1/assistant',     assistantRoutes);  // legacy AI assistant kept
app.use('/api/v1/developer',     developerRoutes);
app.use('/api/v1/organization',  organizationRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// ── API Routes — School Learning (new) ────────────────────
app.use('/api/v1/curriculum',     curriculumRoutes);
app.use('/api/v1/content',        contentRoutes);
app.use('/api/v1/questions',      questionsRoutes);
app.use('/api/v1/adaptive',       adaptiveRoutes);
app.use('/api/v1/mastery',        masteryRoutes);
app.use('/api/v1/recommendations', recommendationsRoutes);
app.use('/api/v1/tutor',          tutorRoutes);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const missing = [];
  if (!process.env.SUPABASE_URL)              missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY)         missing.push('SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  res.json({
    status: missing.length === 0 ? 'ok' : 'degraded',
    env: NODE_ENV,
    timestamp: new Date().toISOString(),
    missing_env: missing.length > 0 ? missing : undefined,
  });
});

// ── SPA fallback for frontend routes ──────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return notFound(req, res);
  // Static assets with extensions that weren't found → 404 page
  if (req.path.includes('.')) {
    return res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
  }
  // Clean URLs: serve SPA shell; the frontend router handles the route
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error handlers ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start (local only — Vercel imports the module via api/index.js) ──
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info(`EduMantra server running on port ${PORT} [${NODE_ENV}]`);
  });
}

module.exports = app;
