const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches req.user (Supabase auth user) and req.profile (users table row).
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch the extended profile from users table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Profile row missing — auto-create a minimal one so the app
      // works even before the full schema migration has been run.
      const fallbackRole = user.user_metadata?.role || 'student';
      const fallbackProfile = {
        id:    user.id,
        email: user.email,
        full_name:          user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role:               fallbackRole,
        designation:        user.user_metadata?.designation || null,
        organization_id:    null,
        preferred_language: 'en',
        years_of_experience: 0,
        is_active:          true,
        last_login_at:      new Date().toISOString(),
      };

      // Try to upsert the row — silently ignore errors if table doesn't exist yet
      await supabaseAdmin.from('users').upsert(fallbackProfile).catch(() => {});

      req.user    = user;
      req.profile = fallbackProfile;
      req.token   = token;
      return next();
    }

    req.user = user;
    req.profile = profile;
    req.token = token;
    next();
  } catch (err) {
    logger.error('Authentication error', { error: err.message });
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Role-based access control middleware factory.
 * Usage: authorize('admin', 'instructor')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }
    next();
  };
}

/**
 * Optional auth — attaches user if token present but doesn't block if absent.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('users').select('*').eq('id', user.id).single();
      req.user = user;
      req.profile = profile;
      req.token = token;
    }
  } catch (_) { /* silent */ }
  next();
}

module.exports = { authenticate, authorize, optionalAuth };
