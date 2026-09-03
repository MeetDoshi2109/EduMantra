const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

// ── POST /api/v1/skill-gap/analyze ──────────────────────
// Generate an AI-powered STEM skill gap report for the requesting student
router.post('/analyze', authenticate, async (req, res) => {
  const userId = req.profile.id;
  const jobRoleId = cleanUuid(req.body.job_role_id || req.profile.job_role_id);

  try {
    let required = [];

    if (jobRoleId) {
      const { data: jobComps } = await supabaseAdmin
        .from('job_role_competencies')
        .select(`*, competency_framework(id, name, domain, description, required_level)`)
        .eq('job_role_id', jobRoleId);
      required = jobComps || [];
    }

    // If student or no job role specified, evaluate against STEM competencies framework
    if (required.length === 0) {
      const { data: allComps } = await supabaseAdmin
        .from('competency_framework')
        .select('id, name, domain, description, required_level')
        .limit(12);

      required = (allComps || []).map(c => ({
        competency_id: c.id,
        required_level: c.required_level || 'advanced',
        competency_framework: c,
      }));
    }

    // 2. Get student's current competencies and mastery data
    const [currentCompsRes, masteryRes] = await Promise.all([
      supabaseAdmin
        .from('user_competency_profiles')
        .select(`*, competency_framework(id, name, domain)`)
        .eq('user_id', userId),
      supabaseAdmin
        .from('student_mastery')
        .select(`mastery_score, is_gap, concepts(title), subjects(name)`)
        .eq('student_id', userId),
    ]);

    const currentMap = {};
    (currentCompsRes.data || []).forEach(c => { currentMap[c.competency_id] = c; });

    const levelOrder = { none: 0, beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    const gaps = [];
    let totalGapScore = 0;

    // 3. Compute gaps
    for (const req_comp of (required || [])) {
      const curr = currentMap[req_comp.competency_id];
      const currentLevel = curr?.current_level || (curr?.score >= 80 ? 'advanced' : curr?.score >= 50 ? 'intermediate' : curr?.score >= 20 ? 'beginner' : 'beginner');
      const requiredLevel = req_comp.required_level || 'advanced';
      const gapNum = Math.max(0, (levelOrder[requiredLevel] || 3) - (levelOrder[currentLevel] || 1));
      const gapScore = Math.min(100, Math.round((gapNum / 4) * 100));
      totalGapScore += gapScore;

      let severity = 'low';
      if (gapNum >= 3) severity = 'critical';
      else if (gapNum === 2) severity = 'high';
      else if (gapNum === 1) severity = 'medium';

      if (gapNum > 0 || !curr) {
        gaps.push({
          competency_id: req_comp.competency_id,
          name: req_comp.competency_framework?.name || 'STEM Competency',
          domain: req_comp.competency_framework?.domain || 'technical',
          current_level: currentLevel,
          required_level: requiredLevel,
          gap_score: gapScore || 25,
          severity,
        });
      }
    }

    const overallGapScore = required.length
      ? Math.round(totalGapScore / required.length)
      : (gaps.length > 0 ? 35 : 0);

    // 4. Generate AI insights
    let aiInsights = {
      summary: `Analyzed ${required.length} STEM core competencies. Identified ${gaps.length} areas for conceptual reinforcement.`,
      priorities: gaps.slice(0, 3).map((g, idx) => ({
        area: g.name,
        action: `Complete interactive practice problem sets on ${g.name} fundamentals.`,
        hours: 3 + idx * 2,
      })),
      recommended_actions: {},
    };

    try {
      const recResult = await AI.generateRecommendations({
        student: {
          full_name: req.profile.full_name,
          class: req.profile.grade,
          board: req.profile.board_id,
        },
        subject_mastery: [],
        weak_concepts: gaps.map(g => ({ concept: g.name, subject: g.domain, mastery: 100 - g.gap_score })),
        recent_performance: [],
      });

      if (recResult?.rationale) {
        aiInsights.summary = recResult.rationale;
      }
      if (Array.isArray(recResult?.recommendations)) {
        aiInsights.priorities = recResult.recommendations.slice(0, 3).map((r, i) => ({
          area: r.title || r.concept || 'Focus Area',
          action: r.description || 'Practice daily questions.',
          hours: (i + 1) * 2,
        }));
      }
    } catch (_) {}

    // 5. Save report
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('skill_gap_reports')
      .insert({
        user_id: userId,
        job_role_id: jobRoleId || null,
        summary: aiInsights.summary || `${gaps.length} skill gaps identified.`,
        overall_gap_score: overallGapScore,
        ai_insights: aiInsights,
      })
      .select().single();

    if (reportErr) return res.status(400).json({ error: reportErr.message });

    // 6. Save gap details
    if (gaps.length > 0) {
      try {
        await supabaseAdmin.from('skill_gap_details').insert(
          gaps.map(g => ({
            report_id: report.id,
            competency_id: g.competency_id,
            current_level: g.current_level,
            required_level: g.required_level,
            gap_score: g.gap_score,
            severity: g.severity,
            recommended_action: aiInsights.recommended_actions?.[g.name] || null,
          }))
        );
      } catch (_) {}
    }

    res.json({
      report: { ...report, gaps, details: gaps, ai_insights: aiInsights },
    });
  } catch (err) {
    logger.error('Skill gap analysis error:', err);
    res.status(500).json({ error: 'Skill gap analysis failed', detail: err.message });
  }
});

// ── GET /api/v1/skill-gap/reports ───────────────────────
router.get('/reports', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('skill_gap_reports')
      .select('*')
      .eq('user_id', req.profile.id)
      .order('generated_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ reports: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ── GET /api/v1/skill-gap/reports/:id ───────────────────
router.get('/reports/:id', authenticate, async (req, res) => {
  try {
    const { data: report, error } = await supabaseAdmin
      .from('skill_gap_reports')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.profile.id)
      .single();
    if (error) return res.status(404).json({ error: 'Report not found' });

    const { data: details } = await supabaseAdmin
      .from('skill_gap_details')
      .select(`*, competency_framework(name, domain, description)`)
      .eq('report_id', req.params.id);

    res.json({ report: { ...report, details: details || [] } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

module.exports = router;
