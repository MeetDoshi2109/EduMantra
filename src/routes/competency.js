const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/v1/competencies ─────────────────────────────
// All competencies in the framework (filterable by domain)
router.get('/', authenticate, async (req, res) => {
  const { domain, search } = req.query;
  try {
    let query = supabaseAdmin
      .from('competency_framework')
      .select('*')
      .order('domain').order('name');
    if (domain) query = query.eq('domain', domain);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ competencies: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch competencies' });
  }
});

// ── GET /api/v1/competencies/my-profile ─────────────────
router.get('/my-profile', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_competency_profiles')
      .select(`*, competency_framework(name, domain, description, required_level)`)
      .eq('user_id', req.profile.id)
      .order('competency_framework(domain)');
    if (error) return res.status(400).json({ error: error.message });
    res.json({ competency_profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch competency profile' });
  }
});

// ── POST /api/v1/competencies/my-profile ────────────────
// Self-assessment or AI-inferred competency update
router.post('/my-profile', authenticate, async (req, res) => {
  const { competency_id, current_level, score, assessment_source, evidence } = req.body;
  if (!competency_id || !current_level) {
    return res.status(422).json({ error: 'competency_id and current_level are required' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('user_competency_profiles')
      .upsert({
        user_id: req.profile.id,
        competency_id,
        current_level,
        score: score || 0,
        assessment_source: assessment_source || 'self',
        evidence: evidence || null,
        last_assessed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,competency_id' })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ profile_entry: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update competency' });
  }
});

// ── GET /api/v1/competencies/job-role/:roleId ───────────
router.get('/job-role/:roleId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('job_role_competencies')
      .select(`*, competency_framework(name, domain, description)`)
      .eq('job_role_id', req.params.roleId)
      .order('priority');
    if (error) return res.status(400).json({ error: error.message });
    res.json({ required_competencies: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job role competencies' });
  }
});

// ── POST /api/v1/competencies (admin only) ───────────────
router.post('/', authenticate, authorize('organization_admin', 'developer'), async (req, res) => {
  const { name, code, domain, description, required_level, keywords } = req.body;
  if (!name || !code || !domain) {
    return res.status(422).json({ error: 'name, code, domain required' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('competency_framework')
      .insert({ name, code, domain, description, required_level, keywords })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ competency: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create competency' });
  }
});

module.exports = router;
