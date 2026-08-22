const { supabaseAdmin } = require('../config/supabase');

/**
 * Middleware factory that logs an action to the audit_logs table.
 * Usage: auditLog('USER_LOGIN')
 */
function auditLog(action, entityFn = null) {
  return async (req, res, next) => {
    // Run after response by wrapping res.json
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode < 400) {
        try {
          await supabaseAdmin.from('audit_logs').insert({
            user_id: req.profile?.id || null,
            action,
            entity: entityFn ? entityFn(req, body) : null,
            entity_id: req.params?.id || null,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            payload: { method: req.method, path: req.path },
          });
        } catch (_) { /* non-blocking */ }
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = auditLog;
