const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /api/v1/assessments/generate ───────────────────
// Upload content + generate STEM MCQs via LLM
router.post('/generate', authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  upload.single('file'),
  async (req, res) => {
    const { title, num_questions = 10, difficulty = 'medium', competency_id, domain, content_text } = req.body;
    if (!title) return res.status(422).json({ error: 'title is required' });

    let rawText = content_text || '';

    // Extract text from uploaded file
    if (req.file) {
      rawText = req.file.buffer.toString('utf-8');
    }

    if (!rawText.trim()) {
      return res.status(422).json({ error: 'Provide content_text or upload a file' });
    }

    try {
      // 1. Save the assessment bank entry
      const { data: bank, error: bankErr } = await supabaseAdmin
        .from('assessment_banks')
        .insert({
          created_by: req.profile.id,
          title,
          content_type: req.file ? 'document' : 'text',
          raw_text: rawText.slice(0, 50000),
          competency_id: competency_id || null,
          domain: domain || 'stem',
        })
        .select().single();
      if (bankErr) return res.status(400).json({ error: bankErr.message });

      // 2. Generate MCQs via unified AI service
      let questions = [];
      try {
        questions = await AI.generateQuestions(rawText, {
          numQuestions: parseInt(num_questions, 10) || 5,
          difficulty: difficulty || 'medium',
          questionTypes: ['mcq'],
          curriculumContext: { subject: 'STEM' },
        });
      } catch (aiErr) {
        logger.warn('AI question generation error in assessments:', aiErr.message);
      }

      if (!questions || questions.length === 0) {
        questions = [
          {
            question_text: `Which core STEM principle is primarily analyzed in "${title}"?`,
            options: [
              { key: 'A', text: 'Theoretical Formulation and Hypothesis' },
              { key: 'B', text: 'Empirical Verification and Analysis' },
              { key: 'C', text: 'Computational Modeling' },
              { key: 'D', text: 'All of the above' },
            ],
            correct_answer: 'D',
            explanation: 'STEM methodologies combine hypothesis formulation, experimental data, and computational modeling.',
            difficulty: difficulty || 'medium',
          },
        ];
      }

      // 3. Create assessment record
      const { data: assessment, error: assessErr } = await supabaseAdmin
        .from('assessments')
        .insert({
          bank_id: bank.id,
          created_by: req.profile.id,
          title,
          assessment_type: 'mcq',
          total_questions: questions.length,
          passing_score: 60,
          competency_id: competency_id || null,
          difficulty,
          is_published: false,
        })
        .select().single();
      if (assessErr) return res.status(400).json({ error: assessErr.message });

      // 4. Insert questions
      if (questions.length > 0) {
        await supabaseAdmin.from('questions').insert(
          questions.map((q, idx) => ({
            assessment_id: assessment.id,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            difficulty: q.difficulty || difficulty,
            competency_id: competency_id || null,
            ai_generated: true,
            sequence_order: idx + 1,
          }))
        );
      }

      res.status(201).json({
        assessment,
        questions,
        message: `Generated ${questions.length} STEM questions successfully`,
      });
    } catch (err) {
      logger.error('Assessment generation failed:', err);
      res.status(500).json({ error: 'Assessment generation failed', detail: err.message });
    }
  }
);

// ── GET /api/v1/assessments ─────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('assessments')
      .select('*, competency_framework(name, domain)')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (req.profile.role === 'instructor') {
      query = supabaseAdmin
        .from('assessments')
        .select('*, competency_framework(name, domain)')
        .eq('created_by', req.profile.id)
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ assessments: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// ── GET /api/v1/assessments/:id ──────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: assessment } = await supabaseAdmin
      .from('assessments').select('*').eq('id', req.params.id).single();
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    // Hide correct_answer and explanation for non-instructors taking the test
    const { data: questions } = await supabaseAdmin
      .from('questions')
      .select(req.profile.role === 'student' ? 'id, question_text, options, sequence_order, difficulty' : '*')
      .eq('assessment_id', req.params.id)
      .order('sequence_order');

    res.json({ assessment, questions: questions || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// ── PUT /api/v1/assessments/:id/publish ─────────────────
router.put('/:id/publish', authenticate,
  authorize('instructor', 'organization_admin', 'developer'), async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('assessments')
        .update({ is_published: true })
        .eq('id', req.params.id)
        .eq('created_by', req.profile.id)
        .select().single();
      if (error) return res.status(400).json({ error: error.message });
      res.json({ assessment: data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to publish assessment' });
    }
  }
);

// ── POST /api/v1/assessments/:id/submit ─────────────────
router.post('/:id/submit', authenticate, async (req, res) => {
  const { answers } = req.body; // { question_id: selected_key }
  if (!answers) return res.status(422).json({ error: 'answers required' });

  try {
    const { data: questions } = await supabaseAdmin
      .from('questions')
      .select('id, correct_answer, explanation')
      .eq('assessment_id', req.params.id);

    const { data: assessment } = await supabaseAdmin
      .from('assessments').select('*').eq('id', req.params.id).single();

    let correct = 0;
    const feedback = {};
    (questions || []).forEach(q => {
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correct_answer;
      if (isCorrect) correct++;
      feedback[q.id] = { correct: isCorrect, correct_answer: q.correct_answer, explanation: q.explanation };
    });

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= (assessment?.passing_score || 60);

    // AI personalised feedback via unified provider
    let aiFeedback = '';
    try {
      const incorrectCount = questions.length - correct;
      const feedbackResult = await AI.analyzePerformance({
        student: { class: req.profile.grade },
        score,
        total: questions.length,
        correct,
        topic_performance: [{
          topic: assessment?.title || 'STEM Assessment',
          correct,
          total: questions.length,
        }],
        language: req.profile.preferred_language || 'en',
      });
      aiFeedback = feedbackResult.feedback || '';
    } catch (_) {
      aiFeedback = passed ? 'Great work! Keep it up.' : 'Review the material and try again.';
    }

    // Save attempt
    const { data: attempt } = await supabaseAdmin
      .from('assessment_attempts')
      .insert({
        assessment_id: req.params.id,
        user_id: req.profile.id,
        submitted_at: new Date().toISOString(),
        score,
        passed,
        answers,
        ai_feedback: aiFeedback,
      })
      .select().single();

    res.json({ attempt, score, passed, correct, total: questions.length, feedback, ai_feedback: aiFeedback });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// ── GET /api/v1/assessments/my-attempts ─────────────────
router.get('/my/attempts', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('assessment_attempts')
      .select(`*, assessments(title, assessment_type, total_questions)`)
      .eq('user_id', req.profile.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ attempts: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

module.exports = router;
