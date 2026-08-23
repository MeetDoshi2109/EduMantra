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

// Routes
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

// ── Static frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/profile',       profileRoutes);
app.use('/api/v1/competencies',  competencyRoutes);
app.use('/api/v1/skill-gap',     skillGapRoutes);
app.use('/api/v1/pathways',      pathwayRoutes);
app.use('/api/v1/igot',          igotRoutes);
app.use('/api/v1/assessments',   assessmentRoutes);
app.use('/api/v1/analytics',     analyticsRoutes);
app.use('/api/v1/assistant',     assistantRoutes);
app.use('/api/v1/developer',     developerRoutes);
app.use('/api/v1/organization',  organizationRoutes);
app.use('/api/v1/notifications', notificationRoutes);

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
  // Let express.static handle .html, .css, .js files first
  // This fallback only hits for clean URLs (no extension)
  if (req.path.includes('.')) return notFound(req, res);
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error handlers ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start (local only — Vercel imports the module directly) ──
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`EduMantra server running on port ${PORT} [${NODE_ENV}]`);
  });
}

module.exports = app;
