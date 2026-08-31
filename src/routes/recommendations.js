/**
 * Recommendations Routes
 * GET  /api/v1/recommendations/me         — personalized recommendations
 * POST /api/v1/recommendations/generate   — regenerate recommendations
 * PUT  /api/v1/recommendations/:id/dismiss
 */

const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

// ── GET /api/v1/recommendations/me ──────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const studentId = req.profile.id;
  try {
    const { data, error } = await supabaseAdmin
      .from('student_recommendations')
      .select(`
        id, type, title, description, priority, generated_at,
        subjects(name, color_hex), chapters(title), topics(title), concepts(title)
      `)
      .eq('student_id', studentId)
      .eq('is_dismissed', false)
      .order('priority', { ascending: true })
      .order('generated_at', { ascending: false })
      .limit(10);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ recommendations: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recommendations', detail: err.message });
  }
});

// ── POST /api/v1/recommendations/generate ───────────────────
router.post('/generate', authenticate, async (req, res) => {
  const studentId = req.profile.id;

  try {
    // Gather mastery data
    const [masteryRes, subjectMasteryRes, recentSessionsRes] = await Promise.all([
      supabaseAdmin
        .from('student_mastery')
        .select(`
          mastery_score, is_gap,
          subjects(name), chapters(title), topics(title), concepts(id, title)
        `)
        .eq('student_id', studentId)
        .eq('is_gap', true)
        .order('mastery_score', { ascending: true })
        .limit(10),

      supabaseAdmin
        .from('student_mastery')
        .select('mastery_score, subjects(id, name)')
        .eq('student_id', studentId),

      supabaseAdmin
        .from('adaptive_sessions')
        .select('score, questions_correct, questions_answered, topics(title)')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5),
    ]);

    // Aggregate subject mastery
    const subjectMap = {};
    for (const m of (subjectMasteryRes.data || [])) {
      const sid = m.subjects?.id;
      if (!sid) continue;
      if (!subjectMap[sid]) subjectMap[sid] = { subject: m.subjects?.name, scores: [] };
      subjectMap[sid].scores.push(m.mastery_score);
    }

    const subjectMastery = Object.values(subjectMap).map(s => ({
      subject: s.subject,
      mastery: s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : 0,
    }));

    const weakConcepts = (masteryRes.data || []).map(m => ({
      concept: m.concepts?.title,
      subject: m.subjects?.name,
      chapter: m.chapters?.title,
      mastery: m.mastery_score,
    }));

    const recentPerformance = (recentSessionsRes.data || []).map(s => ({
      topic: s.topics?.title,
      score: s.score,
      correct: s.questions_correct,
      total: s.questions_answered,
    }));

    // Call AI to generate recommendations
    const result = await AI.generateRecommendations({
      student: {
        full_name: req.profile.full_name,
        class: req.profile.grade,
        board: req.profile.board_id,
      },
      subject_mastery: subjectMastery,
      weak_concepts: weakConcepts,
      recent_performance: recentPerformance,
    });

    // Dismiss old recommendations
    await supabaseAdmin.from('student_recommendations')
      .update({ is_dismissed: true })
      .eq('student_id', studentId)
      .eq('is_dismissed', false);

    // Save new recommendations
    const toInsert = (result.recommendations || []).map((r, i) => ({
      student_id:  studentId,
      type:        r.type,
      title:       r.title,
      description: r.description || '',
      priority:    r.priority || i + 1,
      metadata:    { rationale: result.rationale, concept: r.concept, chapter: r.chapter },
    }));

    const { data: saved } = await supabaseAdmin
      .from('student_recommendations')
      .insert(toInsert)
      .select();

    res.json({
      recommendations: saved || [],
      rationale: result.rationale,
      message: `Generated ${(saved || []).length} recommendations`,
    });
  } catch (err) {
    logger.error('Recommendation generation failed', { error: err.message });
    res.status(500).json({ error: 'Failed to generate recommendations', detail: err.message });
  }
});

// ── PUT /api/v1/recommendations/:id/dismiss ─────────────────
router.put('/:id/dismiss', authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('student_recommendations')
      .update({ is_dismissed: true })
      .eq('id', req.params.id)
      .eq('student_id', req.profile.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Recommendation dismissed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss recommendation', detail: err.message });
  }
});

module.exports = router;
