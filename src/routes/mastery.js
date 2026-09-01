/**
 * Student Mastery Routes
 * GET /api/v1/mastery/me                — full mastery map
 * GET /api/v1/mastery/me/subject/:id    — subject mastery
 * GET /api/v1/mastery/me/gaps           — detected knowledge gaps
 * GET /api/v1/mastery/student/:id       — teacher: view student
 * GET /api/v1/mastery/class/:classId    — teacher: view class aggregate
 */

const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

// ── GET /api/v1/mastery/me ───────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const studentId = cleanUuid(req.profile.id);
  if (!studentId) return res.json({ mastery: [], by_subject: [], summary: { total_concepts_assessed: 0, overall_mastery: 0, gap_count: 0 } });
  try {
    const { data, error } = await supabaseAdmin
      .from('student_mastery')
      .select(`
        mastery_score, mastery_level, is_gap,
        total_attempts, correct_attempts, last_assessed_at,
        subjects(id, name, color_hex),
        chapters(id, title),
        topics(id, title),
        concepts(id, title, description)
      `)
      .eq('student_id', studentId)
      .order('mastery_score', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    // Group by subject
    const bySubject = {};
    for (const m of (data || [])) {
      const subjectId = m.subjects?.id;
      if (!subjectId) continue;
      if (!bySubject[subjectId]) {
        bySubject[subjectId] = {
          subject: m.subjects,
          concepts: [],
          avg_mastery: 0,
          total_concepts: 0,
        };
      }
      bySubject[subjectId].concepts.push(m);
    }

    // Compute average mastery per subject
    for (const sid of Object.keys(bySubject)) {
      const s = bySubject[sid];
      s.total_concepts = s.concepts.length;
      s.avg_mastery = s.total_concepts > 0
        ? Math.round(s.concepts.reduce((sum, c) => sum + c.mastery_score, 0) / s.total_concepts)
        : 0;
    }

    res.json({
      mastery: data || [],
      by_subject: Object.values(bySubject),
      summary: {
        total_concepts_assessed: (data || []).length,
        overall_mastery: (data || []).length > 0
          ? Math.round((data || []).reduce((s, m) => s + m.mastery_score, 0) / data.length)
          : 0,
        gap_count: (data || []).filter(m => m.is_gap).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mastery', detail: err.message });
  }
});

// ── GET /api/v1/mastery/me/subject/:id ──────────────────────
router.get('/me/subject/:id', authenticate, async (req, res) => {
  const studentId = cleanUuid(req.profile.id);
  const subjectId = cleanUuid(req.params.id);
  if (!studentId || !subjectId) return res.json({ subject_id: subjectId, mastery: [], by_chapter: [], avg_mastery: 0 });
  try {
    const { data, error } = await supabaseAdmin
      .from('student_mastery')
      .select(`
        mastery_score, mastery_level, is_gap,
        total_attempts, correct_attempts, last_assessed_at,
        chapters(id, title, chapter_number),
        topics(id, title, sequence_order),
        concepts(id, title, description, key_terms)
      `)
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .order('mastery_score', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    // Group by chapter
    const byChapter = {};
    for (const m of (data || [])) {
      const chapterId = m.chapters?.id;
      if (!chapterId) continue;
      if (!byChapter[chapterId]) {
        byChapter[chapterId] = {
          chapter: m.chapters,
          concepts: [],
          avg_mastery: 0,
        };
      }
      byChapter[chapterId].concepts.push(m);
    }

    for (const cid of Object.keys(byChapter)) {
      const c = byChapter[cid];
      c.avg_mastery = c.concepts.length > 0
        ? Math.round(c.concepts.reduce((s, m) => s + m.mastery_score, 0) / c.concepts.length)
        : 0;
    }

    const avgMastery = (data || []).length > 0
      ? Math.round((data || []).reduce((s, m) => s + m.mastery_score, 0) / data.length)
      : 0;

    res.json({
      subject_id: subjectId,
      mastery: data || [],
      by_chapter: Object.values(byChapter).sort((a, b) => (a.chapter?.chapter_number || 0) - (b.chapter?.chapter_number || 0)),
      avg_mastery: avgMastery,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subject mastery', detail: err.message });
  }
});

// ── GET /api/v1/mastery/me/gaps ──────────────────────────────
router.get('/me/gaps', authenticate, async (req, res) => {
  const studentId = cleanUuid(req.profile.id);
  if (!studentId) return res.json({ gaps: [], total_gaps: 0 });
  try {
    const { data, error } = await supabaseAdmin
      .from('student_mastery')
      .select(`
        mastery_score, mastery_level, total_attempts, correct_attempts, last_assessed_at,
        subjects(id, name, color_hex),
        chapters(id, title, chapter_number),
        topics(id, title),
        concepts(
          id, title, description, key_terms,
          concept_prerequisites!concept_prerequisites_concept_id_fkey(
            prerequisite:concepts!prerequisite_id(id, title)
          )
        )
      `)
      .eq('student_id', studentId)
      .eq('is_gap', true)
      .order('mastery_score', { ascending: true })
      .limit(20);

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      gaps: data || [],
      total_gaps: (data || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gaps', detail: err.message });
  }
});

// ── GET /api/v1/mastery/me/history ──────────────────────────
router.get('/me/history', authenticate, async (req, res) => {
  const { concept_id, days = 30 } = req.query;
  const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000).toISOString();

  try {
    let query = supabaseAdmin
      .from('mastery_history')
      .select('mastery_score, delta, recorded_at, concepts(title, topics(title))')
      .eq('student_id', req.profile.id)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (concept_id) query = query.eq('concept_id', concept_id);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ history: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mastery history', detail: err.message });
  }
});

// ── GET /api/v1/mastery/student/:id ─────────────────────────
// Teacher view
router.get('/student/:id', authenticate, authorize('instructor', 'organization_admin', 'developer'), async (req, res) => {
  const studentId = req.params.id;
  try {
    // Verify student exists
    const { data: student } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, grade, board_id, class_id')
      .eq('id', studentId)
      .single();

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { data: mastery, error } = await supabaseAdmin
      .from('student_mastery')
      .select(`
        mastery_score, mastery_level, is_gap, last_assessed_at,
        subjects(id, name), chapters(id, title), topics(id, title), concepts(id, title)
      `)
      .eq('student_id', studentId)
      .order('mastery_score');

    if (error) return res.status(400).json({ error: error.message });

    const avgMastery = mastery?.length ? Math.round(mastery.reduce((s, m) => s + m.mastery_score, 0) / mastery.length) : 0;

    res.json({
      student,
      mastery: mastery || [],
      summary: {
        avg_mastery: avgMastery,
        gaps: (mastery || []).filter(m => m.is_gap).length,
        strong_areas: (mastery || []).filter(m => m.mastery_score >= 80).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student mastery', detail: err.message });
  }
});

// ── GET /api/v1/mastery/class/:classId ──────────────────────
// Teacher class-level aggregate mastery view
router.get('/class/:classId', authenticate, authorize('instructor', 'organization_admin', 'developer'), async (req, res) => {
  const { classId } = req.params;
  const { subject_id } = req.query;

  try {
    // Get all students in this class within teacher's organization
    const { data: students } = await supabaseAdmin
      .from('users')
      .select('id, full_name, grade')
      .eq('class_id', classId)
      .eq('role', 'student')
      .eq('organization_id', req.profile.organization_id);

    if (!students?.length) return res.json({ students: [], class_mastery: [] });

    const studentIds = students.map(s => s.id);

    let masteryQuery = supabaseAdmin
      .from('student_mastery')
      .select('student_id, mastery_score, is_gap, concepts(id, title), subjects(id, name, color_hex)')
      .in('student_id', studentIds);

    if (subject_id) masteryQuery = masteryQuery.eq('subject_id', subject_id);

    const { data: mastery } = await masteryQuery;

    // Aggregate by concept
    const byConcept = {};
    for (const m of (mastery || [])) {
      const cid = m.concepts?.id;
      if (!cid) continue;
      if (!byConcept[cid]) {
        byConcept[cid] = { concept: m.concepts, subject: m.subjects, scores: [], gap_count: 0 };
      }
      byConcept[cid].scores.push(m.mastery_score);
      if (m.is_gap) byConcept[cid].gap_count++;
    }

    const classMastery = Object.values(byConcept).map(c => ({
      ...c,
      avg_mastery: c.scores.length ? Math.round(c.scores.reduce((s, v) => s + v, 0) / c.scores.length) : 0,
      student_count: c.scores.length,
    })).sort((a, b) => a.avg_mastery - b.avg_mastery); // weakest first

    res.json({
      students,
      class_mastery: classMastery,
      summary: {
        total_students: students.length,
        avg_class_mastery: classMastery.length
          ? Math.round(classMastery.reduce((s, c) => s + c.avg_mastery, 0) / classMastery.length)
          : 0,
        common_gaps: classMastery.filter(c => c.gap_count >= Math.ceil(students.length * 0.3)).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch class mastery', detail: err.message });
  }
});

module.exports = router;
