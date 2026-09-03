/**
 * Curriculum-Grounded STEM Tutor Routes
 * POST   /api/v1/tutor/chat              — send message to tutor
 * POST   /api/v1/tutor/chat/stream       — stream message via SSE
 * POST   /api/v1/tutor/hint              — get 3-level progressive hint
 * POST   /api/v1/tutor/challenge         — get Socratic follow-up question
 * GET    /api/v1/tutor/sessions          — list sessions
 * GET    /api/v1/tutor/sessions/:id      — session messages
 * PUT    /api/v1/tutor/sessions/:id      — update session context
 * DELETE /api/v1/tutor/sessions/:id      — delete session
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

/**
 * Helper to resolve tutor session context and load recent history.
 */
async function resolveTutorState(req, body) {
  const {
    message, session_id,
    board_id, class_id, subject_id, chapter_id, topic_id, concept_id,
    question_id,
  } = body;

  let sessionId = cleanUuid(session_id);
  let sessionContext = {};

  if (!sessionId) {
    const [boardRes, classRes, subjectRes, chapterRes, topicRes, conceptRes] = await Promise.all([
      (board_id || req.profile.board_id) ? supabaseAdmin.from('boards').select('name').eq('id', cleanUuid(board_id || req.profile.board_id)).single() : { data: null },
      (class_id || req.profile.class_id) ? supabaseAdmin.from('classes').select('grade,name').eq('id', cleanUuid(class_id || req.profile.class_id)).single() : { data: null },
      cleanUuid(subject_id) ? supabaseAdmin.from('subjects').select('name').eq('id', cleanUuid(subject_id)).single() : { data: null },
      cleanUuid(chapter_id) ? supabaseAdmin.from('chapters').select('title').eq('id', cleanUuid(chapter_id)).single() : { data: null },
      cleanUuid(topic_id)   ? supabaseAdmin.from('topics').select('title').eq('id', cleanUuid(topic_id)).single()     : { data: null },
      cleanUuid(concept_id) ? supabaseAdmin.from('concepts').select('title').eq('id', cleanUuid(concept_id)).single() : { data: null },
    ]);

    const { data: session, error: sessErr } = await supabaseAdmin
      .from('tutor_sessions')
      .insert({
        student_id: req.profile.id,
        title:      message ? message.slice(0, 60) : 'STEM Tutoring Session',
        board_id:   cleanUuid(board_id   || req.profile.board_id),
        class_id:   cleanUuid(class_id   || req.profile.class_id),
        subject_id: cleanUuid(subject_id),
        chapter_id: cleanUuid(chapter_id),
        topic_id:   cleanUuid(topic_id),
        concept_id: cleanUuid(concept_id),
      })
      .select().single();

    if (sessErr) throw new Error(sessErr.message);
    sessionId = session.id;

    sessionContext = {
      board:   boardRes.data?.name,
      class:   classRes.data?.name || (classRes.data?.grade ? `Class ${classRes.data.grade}` : undefined),
      subject: subjectRes.data?.name,
      chapter: chapterRes.data?.title,
      topic:   topicRes.data?.title,
      concept: conceptRes.data?.title,
    };
  } else {
    const { data: session } = await supabaseAdmin
      .from('tutor_sessions')
      .select(`
        *,
        boards(name), classes(grade, name), subjects(name), chapters(title), topics(title), concepts(title)
      `)
      .eq('id', sessionId)
      .eq('student_id', req.profile.id)
      .single();

    if (!session) throw new Error('Tutor session not found');

    sessionContext = {
      board:   session.boards?.name,
      class:   session.classes?.name || (session.classes?.grade ? `Class ${session.classes.grade}` : undefined),
      subject: session.subjects?.name,
      chapter: session.chapters?.title,
      topic:   session.topics?.title,
      concept: session.concepts?.title,
    };
  }

  // Fetch conversation history — expanded to last 20 messages for rich multi-turn tutoring
  const { data: history } = await supabaseAdmin
    .from('tutor_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20);

  // Fetch current question context if provided
  let currentQuestion = null;
  if (cleanUuid(question_id)) {
    const { data: q } = await supabaseAdmin
      .from('question_bank')
      .select('question_text')
      .eq('id', cleanUuid(question_id))
      .single();
    currentQuestion = q?.question_text;
  }

  // Fetch current student mastery (concept level preferred, fallback to topic)
  let masteryScore;
  if (cleanUuid(concept_id)) {
    const { data: m } = await supabaseAdmin
      .from('student_mastery')
      .select('mastery_score')
      .eq('student_id', req.profile.id)
      .eq('concept_id', cleanUuid(concept_id))
      .single();
    masteryScore = m?.mastery_score;
  }
  if (masteryScore === undefined && cleanUuid(topic_id)) {
    const { data: m } = await supabaseAdmin
      .from('student_mastery')
      .select('mastery_score')
      .eq('student_id', req.profile.id)
      .eq('topic_id', cleanUuid(topic_id))
      .order('mastery_score', { ascending: false })
      .limit(1);
    masteryScore = m?.[0]?.mastery_score;
  }

  const messages = [
    ...(history || []).map(m => ({ role: m.role, content: m.content })),
    ...(message ? [{ role: 'user', content: message }] : []),
  ];

  return {
    sessionId,
    sessionContext,
    messages,
    masteryScore,
    currentQuestion,
  };
}

// ── POST /api/v1/tutor/chat ─────────────────────────────────
router.post('/chat', authenticate, [
  body('message').trim().notEmpty().withMessage('message is required'),
], validate, async (req, res) => {
  try {
    const { sessionId, sessionContext, messages, masteryScore, currentQuestion } = await resolveTutorState(req, req.body);

    const response = await AI.tutorChat(messages, {
      full_name:       req.profile.full_name,
      class:           sessionContext.class || req.profile.grade,
      board:           sessionContext.board,
      subject:         sessionContext.subject,
      chapter:         sessionContext.chapter,
      topic:           sessionContext.topic,
      concept:         sessionContext.concept,
      mastery:         masteryScore,
      currentQuestion,
      language:        req.profile.preferred_language || 'en',
    });

    await supabaseAdmin.from('tutor_messages').insert([
      { session_id: sessionId, role: 'user',      content: req.body.message, question_id: cleanUuid(req.body.question_id) },
      { session_id: sessionId, role: 'assistant', content: response.content, tokens_used: response.tokens_used },
    ]);

    await supabaseAdmin.from('tutor_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

    res.json({
      reply:       response.content,
      session_id:  sessionId,
      tokens_used: response.tokens_used,
    });
  } catch (err) {
    logger.error('Tutor chat error', { error: err.message });
    res.status(500).json({ error: 'Tutor unavailable. Please try again.', detail: err.message });
  }
});

// ── POST /api/v1/tutor/chat/stream ──────────────────────────
// Server-Sent Events (SSE) streaming for real-time response rendering
router.post('/chat/stream', authenticate, [
  body('message').trim().notEmpty().withMessage('message is required'),
], validate, async (req, res) => {
  try {
    const { sessionId, sessionContext, messages, masteryScore, currentQuestion } = await resolveTutorState(req, req.body);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let fullReply = '';

    await AI.tutorChatStream(messages, {
      full_name:       req.profile.full_name,
      class:           sessionContext.class || req.profile.grade,
      board:           sessionContext.board,
      subject:         sessionContext.subject,
      chapter:         sessionContext.chapter,
      topic:           sessionContext.topic,
      concept:         sessionContext.concept,
      mastery:         masteryScore,
      currentQuestion,
      language:        req.profile.preferred_language || 'en',
    }, (chunk) => {
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    // Save conversation to DB
    try {
      await supabaseAdmin.from('tutor_messages').insert([
        { session_id: sessionId, role: 'user',      content: req.body.message, question_id: cleanUuid(req.body.question_id) },
        { session_id: sessionId, role: 'assistant', content: fullReply,        tokens_used: Math.round(fullReply.length / 4) },
      ]);
      await supabaseAdmin.from('tutor_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
    } catch (_) {}

    res.write(`data: ${JSON.stringify({ done: true, session_id: sessionId })}\n\n`);
    res.end();
  } catch (err) {
    logger.error('Tutor stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Tutor streaming unavailable', detail: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
      res.end();
    }
  }
});

// ── POST /api/v1/tutor/hint ─────────────────────────────────
// Get a tiered Socratic hint (Level 1: Nudge, Level 2: Formula/Rule, Level 3: Setup step)
router.post('/hint', authenticate, [
  body('question_id').isUUID().withMessage('valid question_id is required'),
  body('hint_level').optional().isInt({ min: 1, max: 3 }),
], validate, async (req, res) => {
  const { question_id, hint_level = 1 } = req.body;

  try {
    const { data: question, error } = await supabaseAdmin
      .from('question_bank')
      .select('id, question_text, options, explanation, difficulty')
      .eq('id', question_id)
      .single();

    if (error || !question) return res.status(404).json({ error: 'Question not found' });

    const hintData = await AI.generateHint(question, Number(hint_level), {
      class: req.profile.grade,
      language: req.profile.preferred_language || 'en',
    });

    res.json({
      question_id,
      hint_level: Number(hint_level),
      hint: hintData.hint,
    });
  } catch (err) {
    logger.error('Hint generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate hint', detail: err.message });
  }
});

// ── POST /api/v1/tutor/challenge ────────────────────────────
// Socratic follow-up comprehension check
router.post('/challenge', authenticate, async (req, res) => {
  const { topic, concept, difficulty = 'medium' } = req.body;
  try {
    const challenge = await AI.generateFollowUpQuestion(topic, concept, difficulty);
    if (!challenge) {
      return res.json({
        challenge: {
          question_text: `How would you test or apply the concept of ${concept || topic || 'this principle'} in a new experiment?`,
          options: [
            { key: 'A', text: 'Vary one parameter while keeping others constant' },
            { key: 'B', text: 'Change all variables simultaneously' },
            { key: 'C', text: 'Ignore observational measurement' },
            { key: 'D', text: 'Disregard initial boundary conditions' },
          ],
          correct_answer: 'A',
          explanation: 'Valid scientific experiments test one independent variable at a time.',
        }
      });
    }
    res.json({ challenge });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
});

// ── GET /api/v1/tutor/sessions ──────────────────────────────
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tutor_sessions')
      .select(`
        id, title, created_at, updated_at,
        subjects(name), chapters(title), topics(title), concepts(title)
      `)
      .eq('student_id', req.profile.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ sessions: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tutor sessions', detail: err.message });
  }
});

// ── GET /api/v1/tutor/sessions/:id ──────────────────────────
router.get('/sessions/:id', authenticate, async (req, res) => {
  try {
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('tutor_sessions')
      .select(`*, boards(name), classes(grade), subjects(name), chapters(title), topics(title), concepts(title)`)
      .eq('id', req.params.id)
      .eq('student_id', req.profile.id)
      .single();

    if (sessErr || !session) return res.status(404).json({ error: 'Session not found' });

    const { data: messages } = await supabaseAdmin
      .from('tutor_messages')
      .select('id, role, content, created_at')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: true });

    res.json({ session, messages: messages || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tutor session', detail: err.message });
  }
});

// ── DELETE /api/v1/tutor/sessions/:id ───────────────────────
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    await supabaseAdmin
      .from('tutor_sessions')
      .delete()
      .eq('id', req.params.id)
      .eq('student_id', req.profile.id);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session', detail: err.message });
  }
});

module.exports = router;
