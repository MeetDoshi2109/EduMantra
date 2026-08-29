const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { OPENAI_API_KEY, OPENAI_MODEL } = require('../config/env');
const OpenAI = require('openai');

const router = express.Router();

function getOpenAI() {
  if (!OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

// ── POST /api/v1/pathways/generate ──────────────────────
// AI generates a personalized learning pathway from latest gap report
router.post('/generate', authenticate, async (req, res) => {
  const userId = req.profile.id;

  try {
    // 1. Get latest skill gap report
    const { data: report } = await supabaseAdmin
      .from('skill_gap_reports')
      .select(`*, skill_gap_details(*, competency_framework(name, domain))`)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (!report) {
      return res.status(400).json({ error: 'No skill gap report found. Run analysis first.' });
    }

    const gaps = report.skill_gap_details || [];
    if (gaps.length === 0) {
      return res.json({ message: 'No gaps found — your competencies are up to date!', pathway: null });
    }

    // 2. Get relevant iGOT courses for the gap competencies
    const tags = gaps.map(g => g.competency_framework.name);
    const { data: courses } = await supabaseAdmin
      .from('igot_courses')
      .select('id, title, description, duration_hours, level, competency_tags, domain_tags')
      .eq('is_active', true)
      .overlaps('competency_tags', tags)
      .limit(30);

    // 3. Ask AI to build pathway
    let aiPlan = { title: 'Personalized Learning Pathway', rationale: '', items: [] };
    if (OPENAI_API_KEY) {
      try {
        const prompt = `You are a learning pathway designer for STEM education.

Official profile: ${req.profile.designation || 'Learner'}, ${req.profile.years_of_experience || 0} years experience.

Skill gaps to address (sorted by severity):
${gaps.map(g => `- ${g.competency_framework.name} (${g.competency_framework.domain}): needs "${g.required_level}", currently "${g.current_level}", severity: ${g.severity}`).join('\n')}

Available iGOT courses:
${(courses || []).map(c => `[${c.id}] "${c.title}" | ${c.duration_hours}h | level: ${c.level} | tags: ${c.competency_tags?.join(', ')}`).join('\n')}

Create a logical, sequenced 3-month learning pathway. Return JSON:
{
  "title": "pathway title",
  "rationale": "2-sentence explanation",
  "estimated_total_hours": number,
  "items": [
    {
      "course_id": "uuid from list above or null",
      "sequence": 1,
      "ai_reason": "why this course addresses the gap",
      "is_mandatory": true,
      "competency_name": "competency being addressed"
    }
  ]
}`;

        const openai = getOpenAI();
        if (!openai) throw new Error('OPENAI_API_KEY not configured');
        const completion = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        });
        aiPlan = JSON.parse(completion.choices[0].message.content);
      } catch (_) { /* fallback to basic pathway */ }
    }

    // 4. Save pathway
    const { data: pathway, error: pathwayErr } = await supabaseAdmin
      .from('learning_pathways')
      .insert({
        user_id: userId,
        gap_report_id: report.id,
        title: aiPlan.title || 'Personalized Learning Pathway',
        description: `Auto-generated based on skill gap analysis`,
        ai_rationale: aiPlan.rationale || '',
        total_hours: aiPlan.estimated_total_hours || null,
        target_completion: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
      })
      .select().single();

    if (pathwayErr) return res.status(400).json({ error: pathwayErr.message });

    // 5. Save pathway items
    const items = (aiPlan.items || []).filter(i => i.course_id);
    if (items.length > 0) {
      await supabaseAdmin.from('pathway_items').insert(
        items.map(item => ({
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
    res.status(500).json({ error: 'Pathway generation failed', detail: err.message });
  }
});

// ── GET /api/v1/pathways ─────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_pathways')
      .select(`*, pathway_items(*, igot_courses(title, thumbnail_url, duration_hours))`)
      .eq('user_id', req.profile.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ pathways: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pathways' });
  }
});

// ── GET /api/v1/pathways/:id ─────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('learning_pathways')
      .select(`*, pathway_items(*, igot_courses(*), tpac_training_programmes(*))`)
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
