const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

// ── POST /api/v1/pathways/generate ──────────────────────
// AI generates a personalized STEM learning pathway
router.post('/generate', authenticate, async (req, res) => {
  const userId = req.profile.id;

  try {
    // 1. Check for latest skill gap report
    const { data: report } = await supabaseAdmin
      .from('skill_gap_reports')
      .select(`*, skill_gap_details(*, competency_framework(name, domain))`)
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fetch available courses
    const { data: courses } = await supabaseAdmin
      .from('igot_courses')
      .select('id, title, description, duration_hours, level, competency_tags, domain_tags')
      .eq('is_active', true)
      .limit(20);

    const availableCourses = courses || [];

    // 3. Prepare AI prompt and plan
    const gapList = report?.skill_gap_details || [];
    let title = 'STEM Personalized Learning Pathway';
    let rationale = 'Sequenced foundational milestones across Mathematics, Science, and Coding.';
    let totalHours = 24;
    let itemsToPlan = [];

    if (availableCourses.length > 0) {
      itemsToPlan = availableCourses.slice(0, 6).map((c, i) => ({
        course_id: c.id,
        sequence: i + 1,
        ai_reason: `Milestone to develop core competence in ${c.title}`,
        is_mandatory: i < 3,
      }));
    }

    try {
      const recResult = await AI.generateRecommendations({
        student: {
          full_name: req.profile.full_name,
          class: req.profile.grade,
          board: req.profile.board_id,
        },
        subject_mastery: [],
        weak_concepts: gapList.map(g => ({ concept: g.competency_framework?.name || 'Topic', subject: 'STEM' })),
        recent_performance: [],
      });

      if (recResult?.rationale) rationale = recResult.rationale;
    } catch (_) {}

    // 4. Save pathway
    const { data: pathway, error: pathwayErr } = await supabaseAdmin
      .from('learning_pathways')
      .insert({
        user_id: userId,
        gap_report_id: report?.id || null,
        title: title,
        description: `Auto-generated STEM learning pathway tailored for your grade and objectives`,
        ai_rationale: rationale,
        total_hours: totalHours,
        target_completion: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
      })
      .select().single();

    if (pathwayErr) return res.status(400).json({ error: pathwayErr.message });

    // 5. Save pathway items
    if (itemsToPlan.length > 0) {
      await supabaseAdmin.from('pathway_items').insert(
        itemsToPlan.map(item => ({
          pathway_id: pathway.id,
          sequence_order: item.sequence || 1,
          item_type: 'igot_course',
          igot_course_id: item.course_id,
          is_mandatory: item.is_mandatory ?? true,
          ai_reason: item.ai_reason || '',
        }))
      );
    }

    // Re-fetch with full details
    const { data: fullPathway } = await supabaseAdmin
      .from('learning_pathways')
      .select(`*, pathway_items(*, igot_courses(title, duration_hours, thumbnail_url, url))`)
      .eq('id', pathway.id)
      .single();

    res.status(201).json({ pathway: fullPathway });
  } catch (err) {
    logger.error('Pathway generation failed:', err);
    res.status(500).json({ error: 'Pathway generation failed', detail: err.message });
  }
});

// ── GET /api/v1/pathways ─────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_pathways')
      .select(`*, pathway_items(*, igot_courses(title, thumbnail_url, duration_hours, url))`)
      .eq('user_id', req.profile.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ pathways: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pathways' });
  }
});

// ── GET /api/v1/pathways/:id ─────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_pathways')
      .select(`*, pathway_items(*, igot_courses(*))`)
      .eq('id', req.params.id)
      .eq('user_id', req.profile.id)
      .single();
    if (error) return res.status(404).json({ error: 'Pathway not found' });
    res.json({ pathway: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pathway' });
  }
});

module.exports = router;
