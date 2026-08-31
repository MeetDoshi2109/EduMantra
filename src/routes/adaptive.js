/**
 * Adaptive Assessment Routes
 * POST /api/v1/adaptive/sessions/start       — start adaptive session
 * GET  /api/v1/adaptive/sessions/:id/next    — get next question
 * POST /api/v1/adaptive/sessions/:id/answer  — submit an answer
 * POST /api/v1/adaptive/sessions/:id/submit  — finish session
 * GET  /api/v1/adaptive/sessions/:id/result  — get session result
 * GET  /api/v1/adaptive/sessions             — student's session history
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { ADAPTIVE_MAX_QUESTIONS } = require('../config/env');
const engine = require('../services/adaptive/engine');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// ── POST /api/v1/adaptive/sessions/start ────────────────────
router.post('/sessions/start', authenticate, [
  body('topic_id').optional().isUUID(),
  body('chapter_id').optional().isUUID(),
  body('assessment_id').optional().isUUID(),
], validate, async (req, res) => {
  const {
    topic_id, chapter_id, subject_id, board_id, class_id,
    assessment_id, max_questions,
  } = req.body;

  if (!topic_id && !chapter_id && !assessment_id) {
    return res.status(422).json({ error: 'Provide topic_id, chapter_id, or assessment_id' });
  }

  try {
    let resolvedTopicId   = cleanUuid(topic_id);
    let resolvedChapterId = cleanUuid(chapter_id);
    let resolvedSubjectId = cleanUuid(subject_id);
    let resolvedBoardId   = cleanUuid(board_id) || cleanUuid(req.profile.board_id);
    let resolvedClassId   = cleanUuid(class_id) || cleanUuid(req.profile.class_id);
    let resolvedAssessmentId = cleanUuid(assessment_id);

    if (resolvedTopicId && (!resolvedChapterId || !resolvedSubjectId)) {
      const { data: topic } = await supabaseAdmin
        .from('topics')
        .select('id, chapter_id, chapters(id, book_id, books(subject_id, class_id, board_id))')
        .eq('id', resolvedTopicId).single();

      if (topic) {
        resolvedChapterId = cleanUuid(topic.chapter_id);
        resolvedSubjectId = cleanUuid(topic.chapters?.books?.subject_id);
        resolvedClassId   = cleanUuid(topic.chapters?.books?.class_id) || resolvedClassId;
        resolvedBoardId   = cleanUuid(topic.chapters?.books?.board_id) || resolvedBoardId;
      }
    }

    // If still no topic or chapter provided (e.g. random practice mode), find the first available
    if (!resolvedTopicId && !resolvedChapterId && !resolvedAssessmentId) {
      const { data: firstTopic } = await supabaseAdmin
        .from('topics')
        .select('id, chapter_id, chapters(id, book_id, books(subject_id, class_id, board_id))')
        .limit(1);

      if (firstTopic?.[0]) {
        resolvedTopicId = firstTopic[0].id;
        resolvedChapterId = firstTopic[0].chapter_id;
        resolvedSubjectId = cleanUuid(firstTopic[0].chapters?.books?.subject_id) || resolvedSubjectId;
      }
    }

    const maxQ = max_questions || ADAPTIVE_MAX_QUESTIONS;

    const { data: session, error } = await supabaseAdmin
      .from('adaptive_sessions')
      .insert({
        student_id:         cleanUuid(req.profile.id),
        assessment_id:      resolvedAssessmentId,
        board_id:           resolvedBoardId,
        class_id:           resolvedClassId,
        subject_id:         resolvedSubjectId,
        chapter_id:         resolvedChapterId,
        topic_id:           resolvedTopicId,
        status:             'active',
        current_difficulty: 'medium',
        max_questions:      maxQ,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Get first question
    const firstQuestion = await engine.selectQuestion({
      session,
      shownQuestionIds: [],
      difficulty: 'medium',
    });

    if (!firstQuestion) {
      // No questions available — complete session immediately
      await supabaseAdmin.from('adaptive_sessions').update({ status: 'completed' }).eq('id', session.id);
      return res.status(200).json({
        session,
        next_question: null,
        message: 'No questions available for this topic yet. Please try another topic or check back later.',
      });
    }

    res.status(201).json({
      session_id: session.id,
      session,
      next_question: {
        id: firstQuestion.id,
        question_text: firstQuestion.question_text,
        question_type: firstQuestion.question_type,
        options: firstQuestion.options,
        difficulty: firstQuestion.difficulty,
        sequence: 1,
      },
    });
  } catch (err) {
    logger.error('Adaptive session start failed', { error: err.message });
    res.status(500).json({ error: 'Failed to start adaptive session', detail: err.message });
  }
});

// ── GET /api/v1/adaptive/sessions/:id/next ──────────────────
router.get('/sessions/:id/next', authenticate, async (req, res) => {
  try {
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('adaptive_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('student_id', req.profile.id)
      .single();

    if (sessionErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active', status: session.status });

    const { data: deliveries } = await supabaseAdmin
      .from('adaptive_question_deliveries')
      .select('question_id, is_correct, difficulty, concept_id')
      .eq('session_id', req.params.id)
      .order('sequence');

    const shownIds = (deliveries || []).map(d => d.question_id);

    if (session.questions_answered >= session.max_questions) {
      return res.json({ next_question: null, message: 'Session complete — submit to see results' });
    }

    const nextQuestion = await engine.selectQuestion({
      session,
      shownQuestionIds: shownIds,
      difficulty: session.current_difficulty || 'medium',
    });

    if (!nextQuestion) {
      return res.json({ next_question: null, message: 'No more questions available for this session' });
    }

    res.json({
      next_question: {
        id: nextQuestion.id,
        question_text: nextQuestion.question_text,
        question_type: nextQuestion.question_type,
        options: nextQuestion.options,
        difficulty: nextQuestion.difficulty,
        sequence: (deliveries?.length || 0) + 1,
      },
      progress: {
        answered: session.questions_answered,
        max: session.max_questions,
        current_difficulty: session.current_difficulty,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get next question', detail: err.message });
  }
});

// ── POST /api/v1/adaptive/sessions/:id/answer ───────────────
router.post('/sessions/:id/answer', authenticate, [
  body('question_id').isUUID().withMessage('question_id is required'),
  body('answer').notEmpty().withMessage('answer is required'),
], validate, async (req, res) => {
  const { question_id, answer, time_taken_secs = 0, hint_used = false } = req.body;
  const sessionId = req.params.id;

  try {
    // Fetch session
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('adaptive_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('student_id', req.profile.id)
      .single();

    if (sessErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is no longer active' });

    // Fetch question with correct answer + concept
    const { data: question } = await supabaseAdmin
      .from('question_bank')
      .select('id, correct_answer, explanation, difficulty, concept_id, topic_id')
      .eq('id', question_id)
      .single();

    if (!question) return res.status(404).json({ error: 'Question not found' });

    const isCorrect = answer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase();

    // Fetch deliveries so far
    const { data: deliveries } = await supabaseAdmin
      .from('adaptive_question_deliveries')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence');

    const sequence = (deliveries?.length || 0) + 1;

    // Save delivery
    await supabaseAdmin.from('adaptive_question_deliveries').insert({
      session_id:    sessionId,
      question_id,
      concept_id:    question.concept_id,
      sequence,
      difficulty:    question.difficulty,
      student_answer: answer,
      is_correct:    isCorrect,
      time_taken_secs: Number(time_taken_secs),
      hint_used,
    });

    // Update question bank usage stats
    await supabaseAdmin.from('question_bank').update({
      times_used: supabaseAdmin.rpc('increment', { row_id: question_id, column_name: 'times_used' }),
      ...(isCorrect ? { times_correct: supabaseAdmin.rpc('increment', { row_id: question_id, column_name: 'times_correct' }) } : {}),
    }).eq('id', question_id).catch(() => {}); // Non-critical, ignore failures

    // Process answer through adaptive engine
    const { nextQuestion, sessionUpdates, gapDetected, gapConceptId } = await engine.processAnswer(
      session,
      [...(deliveries || []), { question_id, concept_id: question.concept_id, is_correct: isCorrect, difficulty: question.difficulty }],
      question_id,
      isCorrect
    );

    // Update session state
    const newAnswered = session.questions_answered + 1;
    const newCorrect  = session.questions_correct + (isCorrect ? 1 : 0);

    await supabaseAdmin.from('adaptive_sessions').update({
      questions_answered:  newAnswered,
      questions_correct:   newCorrect,
      consecutive_wrong:   sessionUpdates.consecutive_wrong,
      consecutive_correct: sessionUpdates.consecutive_correct,
      current_difficulty:  sessionUpdates.current_difficulty,
    }).eq('id', sessionId);

    const sessionComplete = !nextQuestion || newAnswered >= session.max_questions;

    res.json({
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      gap_detected: gapDetected,
      gap_concept_id: gapConceptId,
      session_complete: sessionComplete,
      next_question: !sessionComplete && nextQuestion ? {
        id: nextQuestion.id,
        question_text: nextQuestion.question_text,
        question_type: nextQuestion.question_type,
        options: nextQuestion.options,
        difficulty: nextQuestion.difficulty,
        sequence: sequence + 1,
      } : null,
      progress: {
        answered: newAnswered,
        correct:  newCorrect,
        max:      session.max_questions,
        current_difficulty: sessionUpdates.current_difficulty,
      },
    });
  } catch (err) {
    logger.error('Adaptive answer error', { error: err.message });
    res.status(500).json({ error: 'Failed to process answer', detail: err.message });
  }
});

// ── POST /api/v1/adaptive/sessions/:id/submit ───────────────
router.post('/sessions/:id/submit', authenticate, async (req, res) => {
  const sessionId = req.params.id;

  try {
    const { data: session } = await supabaseAdmin
      .from('adaptive_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('student_id', req.profile.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'completed') return res.status(400).json({ error: 'Session already submitted' });

    // Fetch all deliveries
    const { data: deliveries } = await supabaseAdmin
      .from('adaptive_question_deliveries')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence');

    const performance = engine.calculatePerformanceSummary(deliveries || [], session);

    // Get AI feedback
    let aiFeedback = '';
    try {
      const feedbackData = await AI.analyzePerformance({
        student: { class: req.profile.grade, board: req.profile.board_id },
        score: performance.score,
        total: performance.total,
        correct: performance.correct,
        topic_performance: Object.entries(performance.by_concept || {}).map(([id, data]) => ({
          topic: id,
          correct: data.correct,
          total: data.total,
        })),
        language: req.profile.preferred_language || 'en',
      });
      aiFeedback = feedbackData.feedback || '';
    } catch (_) {
      aiFeedback = performance.score >= 70 ? 'Great work! Keep it up.' : 'Good effort! Review the weak areas and try again.';
    }

    // Mark session completed
    await supabaseAdmin.from('adaptive_sessions').update({
      status:       'completed',
      completed_at: new Date().toISOString(),
      score:        performance.score,
      ai_feedback:  aiFeedback,
      performance_data: performance,
    }).eq('id', sessionId);

    // Update student mastery for all concepts encountered
    const conceptsEncountered = {};
    for (const d of (deliveries || [])) {
      if (!d.concept_id) continue;
      if (!conceptsEncountered[d.concept_id]) {
        conceptsEncountered[d.concept_id] = {
          concept_id: d.concept_id,
          correct: 0, total: 0,
          topic_id:   session.topic_id,
          chapter_id: session.chapter_id,
          subject_id: session.subject_id,
          board_id:   session.board_id,
          class_id:   session.class_id,
        };
      }
      conceptsEncountered[d.concept_id].total++;
      if (d.is_correct) conceptsEncountered[d.concept_id].correct++;
    }

    await engine.updateMastery(req.profile.id, Object.values(conceptsEncountered), sessionId);

    // Log learning activity
    await supabaseAdmin.from('learning_activities').insert({
      student_id: req.profile.id,
      activity_type: 'assessment',
      subject_id: session.subject_id,
      chapter_id: session.chapter_id,
      topic_id:   session.topic_id,
      session_id: sessionId,
      score:      performance.score,
      duration_mins: Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000),
    }).catch(() => {});

    res.json({
      session_id: sessionId,
      score:      performance.score,
      total:      performance.total,
      correct:    performance.correct,
      performance,
      ai_feedback: aiFeedback,
      message: 'Session submitted successfully',
    });
  } catch (err) {
    logger.error('Session submit error', { error: err.message });
    res.status(500).json({ error: 'Failed to submit session', detail: err.message });
  }
});

// ── GET /api/v1/adaptive/sessions/:id/result ────────────────
router.get('/sessions/:id/result', authenticate, async (req, res) => {
  try {
    const { data: session } = await supabaseAdmin
      .from('adaptive_sessions')
      .select(`
        *,
        subjects(name, color_hex), chapters(title), topics(title)
      `)
      .eq('id', req.params.id)
      .eq('student_id', req.profile.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: deliveries } = await supabaseAdmin
      .from('adaptive_question_deliveries')
      .select(`
        sequence, difficulty, is_correct, time_taken_secs,
        student_answer,
        question:question_bank(question_text, correct_answer, explanation, question_type, options)
      `)
      .eq('session_id', req.params.id)
      .order('sequence');

    // Get updated mastery for concepts in this session
    const conceptIds = [...new Set((deliveries || []).map(d => d.question?.concept_id).filter(Boolean))];
    let masteryUpdates = [];
    if (conceptIds.length > 0) {
      const { data: mastery } = await supabaseAdmin
        .from('student_mastery')
        .select('concept_id, mastery_score, mastery_level, is_gap, concepts(title)')
        .eq('student_id', req.profile.id)
        .in('concept_id', conceptIds);
      masteryUpdates = mastery || [];
    }

    res.json({
      session,
      deliveries: deliveries || [],
      mastery_updates: masteryUpdates,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session result', detail: err.message });
  }
});

// ── GET /api/v1/adaptive/sessions ───────────────────────────
router.get('/sessions', authenticate, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabaseAdmin
      .from('adaptive_sessions')
      .select(`
        id, status, score, questions_answered, questions_correct,
        current_difficulty, started_at, completed_at,
        subjects(name, color_hex), chapters(title), topics(title)
      `, { count: 'exact' })
      .eq('student_id', req.profile.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    res.json({ sessions: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions', detail: err.message });
  }
});

module.exports = router;
