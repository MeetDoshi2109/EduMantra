const express = require('express');
const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { IGOT_BASE_URL, IGOT_API_KEY } = require('../config/env');

const router = express.Router();

const igotClient = axios.create({
  baseURL: IGOT_BASE_URL,
  headers: { 'Authorization': `Bearer ${IGOT_API_KEY}`, 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ── GET /api/v1/igot/courses ─────────────────────────────
// Returns courses from local cache (synced from iGOT)
router.get('/courses', authenticate, async (req, res) => {
  const { domain, level, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('igot_courses')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .range(offset, offset + Number(limit) - 1)
      .order('rating', { ascending: false });

    if (domain) query = query.contains('domain_tags', [domain]);
    if (level) query = query.eq('level', level);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ courses: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ── GET /api/v1/igot/courses/:id ─────────────────────────
router.get('/courses/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('igot_courses').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Course not found' });
    res.json({ course: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// ── POST /api/v1/igot/enroll ─────────────────────────────
router.post('/enroll', authenticate, async (req, res) => {
  const { igot_course_id } = req.body;
  if (!igot_course_id) return res.status(422).json({ error: 'igot_course_id required' });

  try {
    // Get the course to find igot_course_id
    const { data: course } = await supabaseAdmin
      .from('igot_courses').select('igot_course_id, title').eq('id', igot_course_id).single();

    // Try enrolling on iGOT platform if API key configured
    let igotEnrollmentId = null;
    if (IGOT_API_KEY && course?.igot_course_id) {
      try {
        const resp = await igotClient.post('/course/v1/enrol', {
          request: {
            courseId: course.igot_course_id,
            userId: req.profile.igot_user_id,
            batchId: req.body.batch_id,
          },
        });
        igotEnrollmentId = resp.data?.result?.batchEnrolments?.[0]?.batchId;
      } catch (_) { /* iGOT API optional */ }
    }

    const { data, error } = await supabaseAdmin
      .from('course_enrollments')
      .upsert({
        user_id: req.profile.id,
        igot_course_id,
        igot_enrollment_id: igotEnrollmentId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      }, { onConflict: 'user_id,igot_course_id' })
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ enrollment: data });
  } catch (err) {
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

// ── GET /api/v1/igot/my-enrollments ──────────────────────
router.get('/my-enrollments', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('course_enrollments')
      .select(`*, igot_courses(title, thumbnail_url, duration_hours, provider)`)
      .eq('user_id', req.profile.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ enrollments: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// ── PUT /api/v1/igot/progress ────────────────────────────
router.put('/progress', authenticate, async (req, res) => {
  const { igot_course_id, progress_pct, score, status } = req.body;
  if (!igot_course_id) return res.status(422).json({ error: 'igot_course_id required' });

  try {
    const updates = { progress_pct, status };
    if (score !== undefined) updates.score = score;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('course_enrollments')
      .update(updates)
      .eq('user_id', req.profile.id)
      .eq('igot_course_id', igot_course_id)
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ enrollment: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ── POST /api/v1/igot/sync (admin) ───────────────────────
router.post('/sync', authenticate, authorize('organization_admin', 'developer'), async (req, res) => {
  try {
    if (!IGOT_API_KEY) {
      return res.status(400).json({ error: 'IGOT_API_KEY not configured. Add mock data manually.' });
    }

    const resp = await igotClient.get('/course/v1/search', {
      params: { limit: 200, offset: 0, status: 'Live' },
    });

    const courses = resp.data?.result?.content || [];
    const mapped = courses.map(c => ({
      igot_course_id: c.identifier,
      title: c.name,
      description: c.description,
      provider: c.organisation?.[0],
      duration_hours: c.duration ? Math.ceil(c.duration / 3600) : null,
      level: c.level?.toLowerCase(),
      language: c.medium?.[0] || 'en',
      url: `https://igot.gov.in/app/toc/${c.identifier}/overview`,
      thumbnail_url: c.posterImage || c.appIcon,
      rating: c.rating,
      competency_tags: c.competencies_v3?.map(comp => comp.name) || [],
      last_synced_at: new Date().toISOString(),
    }));

    if (mapped.length > 0) {
      const { error } = await supabaseAdmin
        .from('igot_courses')
        .upsert(mapped, { onConflict: 'igot_course_id' });
      if (error) return res.status(400).json({ error: error.message });
    }

    res.json({ message: `Synced ${mapped.length} courses from iGOT` });
  } catch (err) {
    res.status(500).json({ error: 'iGOT sync failed', detail: err.message });
  }
});

module.exports = router;
