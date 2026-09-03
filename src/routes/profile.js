const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// ── GET /api/v1/profile ─────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`*, organizations(name, code), departments(name), job_roles(title, code)`)
      .eq('id', req.profile.id)
      .single();
    if (error) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── PUT /api/v1/profile ─────────────────────────────────
router.put('/', authenticate, [
  body('full_name').optional().trim().notEmpty(),
  body('phone').optional({ values: 'falsy' }),
  body('preferred_language').optional().isLength({ min: 2, max: 5 }),
  body('years_of_experience').optional().isInt({ min: 0 }),
], validate, async (req, res) => {
  const allowed = [
    'full_name', 'designation', 'phone', 'date_of_birth',
    'education_level', 'field_of_study', 'years_of_experience',
    'preferred_language', 'current_assignment', 'avatar_url',
    'department_id', 'job_role_id',
  ];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  try {
    const { data, error } = await supabaseAdmin
      .from('users').update(updates).eq('id', req.profile.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// ── GET /api/v1/profile/:id (admin/org view) ────────────
router.get('/:id', authenticate, authorize('organization_admin', 'developer'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`*, organizations(name), departments(name), job_roles(title)`)
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── GET /api/v1/profile/organization/members ─────────────
router.get('/organization/members', authenticate,
  authorize('organization_admin', 'developer'), async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, designation, is_active, last_login_at, created_at', { count: 'exact' })
      .eq('organization_id', req.profile.organization_id)
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ members: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

module.exports = router;
