const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');
const logger = require('../config/logger');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// ── POST /api/v1/auth/register ─────────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().notEmpty(),
  body('role').isIn(['student', 'instructor', 'parent', 'organization_admin', 'developer']),
], validate, async (req, res) => {
  const { email, password, full_name, role, organization_id, phone, designation } = req.body;

  try {
    // 1. Create auth user via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) return res.status(400).json({ error: authError.message });

    const userId = authData.user.id;

    // 2. Insert extended profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        full_name,
        role,
        organization_id: organization_id || null,
        phone: phone || null,
        designation: designation || null,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: profileError.message });
    }

    logger.info('User registered', { userId, role });
    res.status(201).json({ message: 'Registration successful', user: profile });
  } catch (err) {
    logger.error('Register error', { error: err.message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/v1/auth/login ────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, organization_id, avatar_url, designation, preferred_language')
      .eq('id', data.user.id)
      .single();

    // Update last_login_at
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: profile,
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/v1/auth/refresh ──────────────────────────────
router.post('/refresh', [body('refresh_token').notEmpty()], validate, async (req, res) => {
  const { refresh_token } = req.body;
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: error.message });
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /api/v1/auth/logout ───────────────────────────────
router.post('/logout', authenticate, auditLog('USER_LOGOUT'), async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── POST /api/v1/auth/forgot-password ─────────────────────
router.post('/forgot-password', [body('email').isEmail()], validate, async (req, res) => {
  const { email } = req.body;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ── PUT /api/v1/auth/reset-password ───────────────────────
router.put('/reset-password', authenticate, [
  body('password').isLength({ min: 8 }),
], validate, async (req, res) => {
  const { password } = req.body;
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── GET /api/v1/auth/me ────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.profile });
});

module.exports = router;
