const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/v1/developer/api-key ───────────────────────
router.get('/api-key', authenticate, authorize('developer'), async (req, res) => {
  res.json({
    api_key: req.profile.api_key ? `${req.profile.api_key.slice(0, 8)}...` : null,
    created_at: req.profile.api_key_created_at,
  });
});

// ── POST /api/v1/developer/api-key/regenerate ────────────
router.post('/api-key/regenerate', authenticate, authorize('developer'), async (req, res) => {
  const newKey = `em_${uuidv4().replace(/-/g, '')}`;
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ api_key: newKey, api_key_created_at: new Date().toISOString() })
      .eq('id', req.profile.id)
      .select('api_key, api_key_created_at').single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ api_key: data.api_key, created_at: data.api_key_created_at });
  } catch (err) {
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// ── GET /api/v1/developer/users ─────────────────────────
router.get('/users', authenticate, authorize('developer'), async (req, res) => {
  const { page = 1, limit = 50, role, org } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, organization_id, is_active, created_at, last_login_at', { count: 'exact' })
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (org) query = query.eq('organization_id', org);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ users: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/v1/developer/organizations ─────────────────
router.get('/organizations', authenticate, authorize('developer'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .order('name');
    if (error) return res.status(400).json({ error: error.message });
    res.json({ organizations: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// ── POST /api/v1/developer/organizations ────────────────
router.post('/organizations', authenticate, authorize('developer'), async (req, res) => {
  const { name, code, type, address, state, district, contact_email, contact_phone } = req.body;
  if (!name || !code) return res.status(422).json({ error: 'name and code required' });
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({ name, code, type, address, state, district, contact_email, contact_phone })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ organization: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// ── GET /api/v1/developer/system-stats ──────────────────
router.get('/system-stats', authenticate, authorize('developer'), async (req, res) => {
  try {
    const [users, orgs, courses, assessments, enrollments] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('igot_courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('assessments').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('course_enrollments').select('id', { count: 'exact', head: true }),
    ]);

    res.json({
      total_users: users.count,
      total_organizations: orgs.count,
      total_courses: courses.count,
      total_assessments: assessments.count,
      total_enrollments: enrollments.count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// ── GET /api/v1/developer/audit-logs ────────────────────
router.get('/audit-logs', authenticate, authorize('developer'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { data, error, count } = await supabaseAdmin
      .from('audit_logs')
      .select('*, users(full_name, email)', { count: 'exact' })
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ logs: data, total: count, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
