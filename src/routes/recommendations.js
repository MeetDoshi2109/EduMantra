/**
 * Recommendations Routes
 * GET  /api/v1/recommendations            — personalized recommendations (with ?refresh=true support)
 * GET  /api/v1/recommendations/me         — alias for personalized recommendations
 * POST /api/v1/recommendations/generate   — regenerate recommendations
 * PUT  /api/v1/recommendations/:id/dismiss
 */

const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

async function generateRecommendationsForStudent(req) {
  const studentId = req.profile.id;

  // Gather mastery data & curriculum context
  const [masteryRes, subjectMasteryRes, recentSessionsRes, conceptsRes] = await Promise.all([
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

    supabaseAdmin
      .from('concepts')
      .select('id, title, topic_id, topics(id, title, chapter_id, chapters(id, title, subject_id, subjects(id, name)))')
      .limit(20),
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

  const availableConcepts = conceptsRes.data || [];

  // Map AI recommendations and link concept/topic IDs if matched
  const toInsert = (result.recommendations || []).map((r, i) => {
    let matchedConcept = null;
    if (r.concept) {
      matchedConcept = availableConcepts.find(c =>
        c.title.toLowerCase().includes(r.concept.toLowerCase()) ||
        r.concept.toLowerCase().includes(c.title.toLowerCase())
      );
    }
    if (!matchedConcept && availableConcepts[i]) {
      matchedConcept = availableConcepts[i];
    }

    return {
      student_id:  studentId,
      type:        r.type || 'practice',
      title:       r.title || 'STEM Target Practice',
      description: r.description || 'Targeted practice to strengthen core STEM skills.',
      priority:    r.priority === 1 ? 'high' : r.priority === 2 ? 'medium' : 'low',
      concept_id:  matchedConcept?.id || null,
      topic_id:    matchedConcept?.topic_id || null,
      chapter_id:  matchedConcept?.topics?.chapter_id || null,
      subject_id:  matchedConcept?.topics?.chapters?.subject_id || null,
      metadata:    { rationale: result.rationale, concept: r.concept, chapter: r.chapter, estimated_minutes: 15 },
    };
  });

  const { data: saved } = await supabaseAdmin
    .from('student_recommendations')
    .insert(toInsert)
    .select(`
      id, type, title, description, priority, generated_at, concept_id, topic_id, chapter_id, subject_id, metadata,
      subjects(name, color_hex), chapters(title), topics(title), concepts(title)
    `);

  return {
    recommendations: (saved || []).map(r => ({
      ...r,
      rationale: r.description,
      concept_title: r.concepts?.title || r.title,
      estimated_minutes: r.metadata?.estimated_minutes || 15,
    })),
    rationale: result.rationale,
  };
}

async function handleGetRecommendations(req, res) {
  const studentId = req.profile.id;
  const isRefresh = req.query.refresh === 'true';

  try {
    if (!isRefresh) {
      const { data, error } = await supabaseAdmin
        .from('student_recommendations')
        .select(`
          id, type, title, description, priority, generated_at, concept_id, topic_id, chapter_id, subject_id, metadata,
          subjects(name, color_hex), chapters(title), topics(title), concepts(title)
        `)
        .eq('student_id', studentId)
        .eq('is_dismissed', false)
        .order('generated_at', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        return res.json({
          recommendations: data.map(r => ({
            ...r,
            rationale: r.description,
            concept_title: r.concepts?.title || r.title,
            estimated_minutes: r.metadata?.estimated_minutes || 15,
          })),
        });
      }
    }

    // Auto-generate fresh recommendations
    const generated = await generateRecommendationsForStudent(req);
    res.json(generated);
  } catch (err) {
    logger.error('Failed to get or generate recommendations:', err.message);
    const grade = parseInt(req.profile?.grade, 10) || 8;
    const isSenior = grade >= 9;

    res.json({
      recommendations: [
        {
          id: 'rec_math_1',
          type: 'practice',
          title: isSenior ? 'Quadratic Equations & Polynomial Roots' : 'Integers & Algebraic Expressions',
          description: isSenior
            ? 'Practice solving quadratic equations using factorisation and quadratic formula.'
            : 'Master operations on positive and negative numbers with real-world STEM problem sets.',
          priority: 'high',
          estimated_minutes: isSenior ? 25 : 15,
          rationale: 'Fundamental mathematical prerequisite for higher algebra and physical sciences.',
        },
        {
          id: 'rec_sci_1',
          type: 'explore',
          title: isSenior ? 'Newtonian Mechanics & Equations of Motion' : 'Forces, Friction & Energy Transformation',
          description: isSenior
            ? 'Derive and apply v = u + at and s = ut + 0.5at² to kinematic scenarios.'
            : 'Explore how forces interact to cause acceleration and equilibrium in physical systems.',
          priority: 'medium',
          estimated_minutes: 20,
          rationale: 'Core physics foundational concept essential for scientific reasoning.',
        },
        {
          id: 'rec_cs_1',
          type: 'practice',
          title: isSenior ? 'Python Functions, Recursion & Algorithmic Complexity' : 'Python Loops & Sequential Logic',
          description: isSenior
            ? 'Write modular functions with parameters and analyze execution efficiency.'
            : 'Write loops to automate calculations and process arrays of scientific measurements.',
          priority: 'medium',
          estimated_minutes: isSenior ? 30 : 20,
          rationale: 'Essential milestone for computational STEM mastery and automation.',
        }
      ]
    });
  }
}

// ── GET /api/v1/recommendations & GET /api/v1/recommendations/me
router.get('/', authenticate, handleGetRecommendations);
router.get('/me', authenticate, handleGetRecommendations);

// ── POST /api/v1/recommendations/generate ───────────────────
router.post('/generate', authenticate, async (req, res) => {
  try {
    const result = await generateRecommendationsForStudent(req);
    res.json({
      ...result,
      message: `Generated ${result.recommendations.length} recommendations`,
    });
  } catch (err) {
    logger.error('Recommendation generation failed', { error: err.message });
    res.status(500).json({ error: 'Failed to generate recommendations', detail: err.message });
  }
});

// ── POST /api/v1/recommendations/:id/complete ───────────────
// Student marks recommendation complete, triggering learning progress
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const recId = req.params.id;
    const { data: rec } = await supabaseAdmin
      .from('student_recommendations')
      .update({ is_dismissed: true, completed_at: new Date().toISOString() })
      .eq('id', recId)
      .eq('student_id', req.profile.id)
      .select()
      .single();

    // Log progress if concept attached
    if (rec?.concept_id) {
      try {
        await supabaseAdmin.from('learning_hours_log').insert({
          user_id: req.profile.id,
          concept_id: rec.concept_id,
          topic_id: rec.topic_id,
          subject_id: rec.subject_id,
          hours_spent: (rec.metadata?.estimated_minutes || 15) / 60,
          activity_type: 'recommendation_completed',
        });
      } catch (_) {}
    }

    res.json({ success: true, message: 'Recommendation marked as completed!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete recommendation', detail: err.message });
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
