const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/v1/organization/profile ────────────────────
router.get('/profile', authenticate, authorize('organization_admin'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', req.profile.organization_id)
      .single();
    if (error) return res.status(404).json({ error: 'Organization not found' });
    res.json({ organization: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// ── PUT /api/v1/organization/profile ────────────────────
router.put('/profile', authenticate, authorize('organization_admin'), async (req, res) => {
  const allowed = ['name', 'address', 'state', 'district', 'contact_email', 'contact_phone', 'logo_url'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', req.profile.organization_id)
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ organization: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ── GET /api/v1/organization/members ────────────────────
router.get('/members', authenticate, authorize('organization_admin'), async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, designation, is_active, last_login_at, created_at, job_roles(title)', { count: 'exact' })
      .eq('organization_id', req.profile.organization_id)
      .range(offset, offset + Number(limit) - 1)
      .order('full_name');

    if (role) query = query.eq('role', role);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ members: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── PUT /api/v1/organization/members/:id/deactivate ──────
router.put('/members/:id/deactivate', authenticate, authorize('organization_admin'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('organization_id', req.profile.organization_id)
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Member deactivated', user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

// ── GET /api/v1/organization/competency-distribution ─────
router.get('/competency-distribution', authenticate, authorize('organization_admin'), async (req, res) => {
  try {
    // Get all user competency profiles for org members
    const { data: orgMembers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('organization_id', req.profile.organization_id)
      .eq('role', 'student');

    const memberIds = (orgMembers || []).map(m => m.id);
    if (memberIds.length === 0) return res.json({ distribution: [] });

    const { data, error } = await supabaseAdmin
      .from('user_competency_profiles')
      .select('current_level, competency_framework(name, domain)')
      .in('user_id', memberIds);

    if (error) return res.status(400).json({ error: error.message });

    // Group by domain → level
    const dist = {};
    (data || []).forEach(p => {
      const domain = p.competency_framework?.domain || 'unknown';
      if (!dist[domain]) dist[domain] = { none: 0, beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
      dist[domain][p.current_level] = (dist[domain][p.current_level] || 0) + 1;
    });

    res.json({ distribution: dist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch competency distribution' });
  }
});

module.exports = router;
