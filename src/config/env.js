require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // JWT (used alongside Supabase JWT for custom claims)
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // AI Provider configuration
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai',          // 'openai' | 'gemini'
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Content moderation & question validation
  CONTENT_MODERATION_ENABLED: process.env.CONTENT_MODERATION_ENABLED !== 'false',
  QUESTION_VALIDATION_ENABLED: process.env.QUESTION_VALIDATION_ENABLED !== 'false',

  // Adaptive assessment tuning
  ADAPTIVE_MAX_QUESTIONS: parseInt(process.env.ADAPTIVE_MAX_QUESTIONS) || 20,
  ADAPTIVE_MIN_MASTERY_FOR_ADVANCE: parseInt(process.env.ADAPTIVE_MIN_MASTERY_FOR_ADVANCE) || 70,
  ADAPTIVE_GAP_THRESHOLD: parseInt(process.env.ADAPTIVE_GAP_THRESHOLD) || 3,  // consecutive wrong → gap

  // iGOT Karmayogi (kept for backward compat)
  IGOT_BASE_URL: process.env.IGOT_BASE_URL || 'https://igot.gov.in/apis',
  IGOT_API_KEY: process.env.IGOT_API_KEY,

  // CORS
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,
};
