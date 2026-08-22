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
    if (!origin || CORS_ORIGINS.includes(origin) || NODE_ENV === 'development') {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
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
  res.json({ status: 'ok', env: NODE_ENV, timestamp: new Date().toISOString() });
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

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`EduMantra server running on port ${PORT} [${NODE_ENV}]`);
});

module.exports = app;
