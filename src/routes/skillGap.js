const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { OPENAI_API_KEY, OPENAI_MODEL } = require('../config/env');
const OpenAI = require('openai');

const router = express.Router();

// Lazy — only instantiated when a request actually needs AI
// so a missing OPENAI_API_KEY doesn't crash the server on startup
function getOpenAI() {
  if (!OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

// ── POST /api/v1/skill-gap/analyze ──────────────────────
// Generate an AI-powered skill gap report for the requesting user
router.post('/analyze', authenticate, async (req, res) => {
  const userId = req.profile.id;
  const jobRoleId = req.body.job_role_id || req.profile.job_role_id;

  try {
    // 1. Get required competencies for the job role
    const { data: required, error: reqErr } = await supabaseAdmin
      .from('job_role_competencies')
      .select(`*, competency_framework(name, domain, description)`)
      .eq('job_role_id', jobRoleId);
    if (reqErr) return res.status(400).json({ error: reqErr.message });

    // 2. Get user's current competencies
    const { data: current, error: curErr } = await supabaseAdmin
      .from('user_competency_profiles')
      .select(`*, competency_framework(name, domain)`)
      .eq('user_id', userId);
    if (curErr) return res.status(400).json({ error: curErr.message });

    const currentMap = {};
    (current || []).forEach(c => { currentMap[c.competency_id] = c; });

    const levelOrder = { none: 0, beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    const gaps = [];
    let totalGapScore = 0;

    // 3. Compute gaps
    for (const req_comp of (required || [])) {
      const curr = currentMap[req_comp.competency_id];
      const currentLevel = curr?.current_level || 'none';
      const requiredLevel = req_comp.required_level;
      const gapNum = Math.max(0, levelOrder[requiredLevel] - levelOrder[currentLevel]);
      const gapScore = (gapNum / 4) * 100;
      totalGapScore += gapScore;

      let severity = 'low';
      if (gapNum >= 4) severity = 'critical';
      else if (gapNum >= 3) severity = 'high';
      else if (gapNum >= 2) severity = 'medium';

      if (gapNum > 0) {
        gaps.push({
          competency_id: req_comp.competency_id,
          name: req_comp.competency_framework.name,
          domain: req_comp.competency_framework.domain,
          current_level: currentLevel,
          required_level: requiredLevel,
          gap_score: gapScore,
          severity,
        });
      }
    }

    const overallGapScore = required.length
      ? Math.round(totalGapScore / required.length)
      : 0;

    // 4. AI narrative insights
    let aiInsights = {};
    if (OPENAI_API_KEY && gaps.length > 0) {
      try {
        const prompt = `You are an expert learning advisor for students and educators in STEM education.
A learner has the following skill gaps across STEM domains:
${gaps.map(g => `- ${g.name} (${g.domain}): currently "${g.current_level}", needs "${g.required_level}", severity: ${g.severity}`).join('\n')}

Provide:
1. A brief executive summary (2-3 sentences)
2. Top 3 priority areas to address
3. Specific recommended actions for each gap
4. Estimated learning time to close gaps

Respond as JSON: { summary, priorities: [{area, action, hours}], recommended_actions }`;

        const openai = getOpenAI();
        if (!openai) throw new Error('OPENAI_API_KEY not configured');
        const completion = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 800,
        });
        aiInsights = JSON.parse(completion.choices[0].message.content);
      } catch (aiErr) {
        aiInsights = { summary: 'AI insights temporarily unavailable.', priorities: [] };
      }
    }

    // 5. Save report
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('skill_gap_reports')
      .insert({
        user_id: userId,
        job_role_id: jobRoleId,
        summary: aiInsights.summary || `${gaps.length} skill gaps identified.`,
        overall_gap_score: overallGapScore,
        ai_insights: aiInsights,
      })
      .select().single();
    if (reportErr) return res.status(400).json({ error: reportErr.message });

    // 6. Save gap details
    if (gaps.length > 0) {
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
    }

    res.json({
      report: { ...report, gaps, ai_insights: aiInsights },
    });
  } catch (err) {
    res.status(500).json({ error: 'Skill gap analysis failed' });
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
    res.json({ reports: data });
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

    res.json({ report: { ...report, details } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

module.exports = router;
