/**
 * Question Bank Routes
 * POST /api/v1/questions/generate       — AI generation from curriculum content
 * GET  /api/v1/questions/bank           — browse approved question bank
 * GET  /api/v1/questions/:id            — single question
 * PUT  /api/v1/questions/:id/approve    — teacher approves
 * PUT  /api/v1/questions/:id/reject     — teacher rejects
 * PUT  /api/v1/questions/:id            — edit question
 * GET  /api/v1/questions/:id/validation — validation report
 * GET  /api/v1/questions/pending        — questions awaiting teacher review
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const AI = require('../services/ai');
const { validateBatch, validateQuestion, ruleBasedValidation } = require('../services/questionValidator');
const logger = require('../config/logger');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// ── POST /api/v1/questions/generate ─────────────────────────
router.post('/generate',
  authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  [
    body('num_questions').optional().isInt({ min: 1, max: 50 }),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard', 'mixed']),
  ],
  validate,
  async (req, res) => {
    const {
      board_id, class_id, subject_id, book_id, chapter_id,
      topic_id, concept_id, content_id,
      num_questions = 5,
      difficulty = 'medium',
      question_types = ['mcq'],
      language = 'en',
      content_text,  // explicit content text, or fetched from content_id
    } = req.body;

    try {
      let rawText = content_text || '';

      // Fetch curriculum content if content_id provided
      if (content_id && !rawText) {
        const { data: content } = await supabaseAdmin
          .from('curriculum_content')
          .select('content_text, title')
          .eq('id', content_id)
          .single();
        if (content?.content_text) rawText = content.content_text;
      }

      // If still no text, fetch all content for the given scope
      if (!rawText && (chapter_id || topic_id || concept_id)) {
        const scopeField = concept_id ? 'concept_id' : topic_id ? 'topic_id' : 'chapter_id';
        const scopeValue = concept_id || topic_id || chapter_id;
        const { data: contents } = await supabaseAdmin
          .from('curriculum_content')
          .select('content_text, title')
          .eq(scopeField, scopeValue)
          .eq('is_permitted', true)
          .limit(5);
        if (contents?.length) rawText = contents.map(c => `${c.title}:\n${c.content_text}`).join('\n\n');
      }

      if (!rawText?.trim()) {
        return res.status(422).json({
          error: 'No content available for question generation. Provide content_text or ensure curriculum_content exists for the selected scope.',
        });
      }

      // Fetch curriculum context for better prompting
      const [boardRes, classRes, subjectRes, chapterRes, topicRes, conceptRes] = await Promise.all([
        board_id   ? supabaseAdmin.from('boards').select('name').eq('id', board_id).single()     : { data: null },
        class_id   ? supabaseAdmin.from('classes').select('grade,name').eq('id', class_id).single() : { data: null },
        subject_id ? supabaseAdmin.from('subjects').select('name').eq('id', subject_id).single()  : { data: null },
        chapter_id ? supabaseAdmin.from('chapters').select('title').eq('id', chapter_id).single() : { data: null },
        topic_id   ? supabaseAdmin.from('topics').select('title').eq('id', topic_id).single()     : { data: null },
        concept_id ? supabaseAdmin.from('concepts').select('title').eq('id', concept_id).single() : { data: null },
      ]);

      const curriculumContext = {
        board:   boardRes.data?.name,
        class:   classRes.data?.name || (classRes.data?.grade ? `Class ${classRes.data.grade}` : undefined),
        subject: subjectRes.data?.name,
        chapter: chapterRes.data?.title,
        topic:   topicRes.data?.title,
        concept: conceptRes.data?.title,
      };

      // Generate questions via AI service
      const generated = await AI.generateQuestions(rawText, {
        numQuestions: Number(num_questions),
        difficulty,
        questionTypes: Array.isArray(question_types) ? question_types : [question_types],
        language,
        curriculumContext,
      });

      if (!generated.length) {
        return res.status(500).json({ error: 'AI did not generate any questions. Try providing more content.' });
      }

      // Validate all generated questions
      const validationResults = await validateBatch(generated, { curriculumContext, skipAI: generated.length > 10 });

      // Save all questions to question_bank (both valid and invalid — marked by status)
      const questionInserts = validationResults.map(({ question, validation }) => ({
        board_id:   board_id   || null,
        class_id:   class_id   || null,
        subject_id: subject_id || null,
        book_id:    book_id    || null,
        chapter_id: chapter_id || null,
        topic_id:   topic_id   || null,
        concept_id: concept_id || null,
        content_id: content_id || null,
        question_text:  question.question_text,
        question_type:  question.question_type || 'mcq',
        options:        question.options || null,
        correct_answer: question.correct_answer,
        explanation:    question.explanation || '',
        difficulty:     question.difficulty || difficulty,
        language,
        tags:           question.tags || [],
        ai_generated:   true,
        created_by:     req.profile.id,
        // Auto-approve if valid and AI confidence is high
        validation_status: validation.overall_valid && (validation.ai_check?.confidence || 0) >= 0.8
          ? 'approved'
          : validation.overall_valid
            ? 'needs_review'
            : 'rejected',
      }));

      const { data: savedQuestions, error: saveErr } = await supabaseAdmin
        .from('question_bank')
        .insert(questionInserts)
        .select('id, question_text, validation_status, difficulty');

      if (saveErr) {
        logger.error('Failed to save questions', { error: saveErr.message });
        return res.status(500).json({ error: 'Failed to save generated questions', detail: saveErr.message });
      }

      // Save validation records
      const validationInserts = validationResults.map((vr, idx) => {
        const savedQ = savedQuestions?.[idx];
        if (!savedQ) return null;
        return [
          {
            question_id:     savedQ.id,
            validation_type: 'rule_check',
            is_valid:        vr.validation.rule_check.is_valid,
            confidence:      1.0,
            issues:          vr.validation.rule_check.issues,
          },
          {
            question_id:     savedQ.id,
            validation_type: 'duplicate_check',
            is_valid:        !vr.validation.duplicate_check.is_duplicate,
            confidence:      1.0,
            issues:          vr.validation.duplicate_check.is_duplicate ? ['Possible duplicate'] : [],
          },
          vr.validation.ai_check ? {
            question_id:     savedQ.id,
            validation_type: 'ai_check',
            is_valid:        vr.validation.ai_check.is_valid,
            confidence:      vr.validation.ai_check.confidence,
            issues:          vr.validation.ai_check.issues || [],
            suggestion:      vr.validation.ai_check.suggestion,
          } : null,
        ].filter(Boolean);
      }).flat().filter(Boolean);

      if (validationInserts.length) {
        await supabaseAdmin.from('question_validations').insert(validationInserts);
      }

      const approved = (savedQuestions || []).filter(q => q.validation_status === 'approved').length;
      const needsReview = (savedQuestions || []).filter(q => q.validation_status === 'needs_review').length;
      const rejected = (savedQuestions || []).filter(q => q.validation_status === 'rejected').length;

      res.status(201).json({
        generated: generated.length,
        saved: savedQuestions?.length || 0,
        approved,
        needs_review: needsReview,
        rejected,
        questions: savedQuestions,
        message: `Generated ${generated.length} questions. ${approved} auto-approved, ${needsReview} need teacher review, ${rejected} failed validation.`,
      });
    } catch (err) {
      logger.error('Question generation error', { error: err.message });
      res.status(500).json({ error: 'Question generation failed', detail: err.message });
    }
  }
);

// ── GET /api/v1/questions/pending ───────────────────────────
router.get('/pending',
  authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    try {
      const { data, error, count } = await supabaseAdmin
        .from('question_bank')
        .select(`
          id, question_text, question_type, difficulty, language, created_at,
          boards(name), classes(grade), subjects(name), chapters(title), topics(title)
        `, { count: 'exact' })
        .eq('validation_status', 'needs_review')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ questions: data, total: count, page: Number(page), limit: Number(limit) });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch pending questions' });
    }
  }
);

// ── GET /api/v1/questions/bank ──────────────────────────────
router.get('/bank', authenticate, async (req, res) => {
  const {
    board_id, class_id, subject_id, chapter_id, topic_id, concept_id,
    difficulty, question_type, language, status = 'approved',
    page = 1, limit = 20,
  } = req.query;

  const isTeacher = ['instructor', 'organization_admin', 'developer'].includes(req.profile.role);
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabaseAdmin
      .from('question_bank')
      .select(`
        id, question_text, question_type, difficulty, language, validation_status,
        tags, times_used, times_correct, created_at,
        boards(name, code), classes(grade, name), subjects(name), chapters(title), topics(title), concepts(title)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // Students only see approved questions (without answers)
    if (!isTeacher) {
      query = query.eq('validation_status', 'approved');
    } else {
      if (status) query = query.eq('validation_status', status);
    }

    if (cleanUuid(board_id))     query = query.eq('board_id', cleanUuid(board_id));
    if (cleanUuid(class_id))     query = query.eq('class_id', cleanUuid(class_id));
    if (cleanUuid(subject_id))   query = query.eq('subject_id', cleanUuid(subject_id));
    if (cleanUuid(chapter_id))   query = query.eq('chapter_id', cleanUuid(chapter_id));
    if (cleanUuid(topic_id))     query = query.eq('topic_id', cleanUuid(topic_id));
    if (cleanUuid(concept_id))   query = query.eq('concept_id', cleanUuid(concept_id));
    if (difficulty)   query = query.eq('difficulty', difficulty);
    if (question_type) query = query.eq('question_type', question_type);
    if (language)     query = query.eq('language', language);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    // Strip answers for students
    const safeData = isTeacher ? data : (data || []).map(q => {
      const { correct_answer, explanation, ...safe } = q;
      return safe;
    });

    res.json({ questions: safeData, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch question bank' });
  }
});

// ── GET /api/v1/questions/:id ────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const isTeacher = ['instructor', 'organization_admin', 'developer'].includes(req.profile.role);
  try {
    const selectFields = isTeacher
      ? `*, boards(name), classes(grade), subjects(name), chapters(title), topics(title), concepts(title)`
      : `id, question_text, question_type, options, difficulty, language, tags, boards(name), classes(grade), subjects(name), chapters(title), topics(title)`;

    const { data, error } = await supabaseAdmin
      .from('question_bank')
      .select(selectFields)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Question not found' });
    if (!isTeacher && data.validation_status !== 'approved') {
      return res.status(403).json({ error: 'Question not available' });
    }
    res.json({ question: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

// ── GET /api/v1/questions/:id/validation ────────────────────
router.get('/:id/validation',
  authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('question_validations')
        .select('*')
        .eq('question_id', req.params.id)
        .order('created_at', { ascending: false });

      if (error) return res.status(400).json({ error: error.message });
      res.json({ validations: data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch validation' });
    }
  }
);

// ── PUT /api/v1/questions/:id/approve ───────────────────────
router.put('/:id/approve',
  authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('question_bank')
        .update({
          validation_status: 'approved',
          validated_by: req.profile.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select('id, validation_status, question_text')
        .single();

      if (error) return res.status(400).json({ error: error.message });

      // Save teacher review record
      await supabaseAdmin.from('question_validations').insert({
        question_id: req.params.id,
        validation_type: 'teacher_review',
        is_valid: true,
        confidence: 1.0,
        issues: [],
        validated_by: req.profile.id,
      });

      res.json({ question: data, message: 'Question approved' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to approve question' });
    }
  }
);

// ── PUT /api/v1/questions/:id/reject ────────────────────────
router.put('/:id/reject',
  authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  async (req, res) => {
    const { reason } = req.body;
    try {
      const { data, error } = await supabaseAdmin
        .from('question_bank')
        .update({
          validation_status: 'rejected',
          validated_by: req.profile.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select('id, validation_status')
        .single();

      if (error) return res.status(400).json({ error: error.message });

      await supabaseAdmin.from('question_validations').insert({
        question_id: req.params.id,
        validation_type: 'teacher_review',
        is_valid: false,
        confidence: 1.0,
        issues: reason ? [reason] : ['Rejected by teacher'],
        validated_by: req.profile.id,
      });

      res.json({ question: data, message: 'Question rejected' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to reject question' });
    }
  }
);

// ── PUT /api/v1/questions/:id ────────────────────────────────
router.put('/:id',
  authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  async (req, res) => {
    const allowed = ['question_text', 'options', 'correct_answer', 'explanation', 'difficulty', 'tags'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (Object.keys(updates).length === 0) {
      return res.status(422).json({ error: 'No valid fields to update' });
    }

    // Re-run rule validation after edit
    try {
      const { data: current } = await supabaseAdmin
        .from('question_bank').select('*').eq('id', req.params.id).single();
      const merged = { ...current, ...updates };
      const ruleCheck = ruleBasedValidation(merged);

      const { data, error } = await supabaseAdmin
        .from('question_bank')
        .update({ ...updates, validation_status: 'needs_review' })  // re-queue for review
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      res.json({ question: data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update question' });
    }
  }
);

module.exports = router;
