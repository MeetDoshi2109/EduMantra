/**
 * Curriculum-Grounded Tutor Routes
 * POST   /api/v1/tutor/chat              — send message to tutor
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

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// ── POST /api/v1/tutor/chat ─────────────────────────────────
router.post('/chat', authenticate, [
  body('message').trim().notEmpty().withMessage('message is required'),
], validate, async (req, res) => {
  const {
    message, session_id,
    // Curriculum context (can override stored session context)
    board_id, class_id, subject_id, chapter_id, topic_id, concept_id,
    question_id,  // if student is asking about a specific question
  } = req.body;

  try {
    let sessionId = session_id;
    let sessionContext = {};

    // Create new session if none provided
    if (!sessionId) {
      // Resolve curriculum context names for the tutor prompt
      const [boardRes, classRes, subjectRes, chapterRes, topicRes] = await Promise.all([
        (board_id   || req.profile.board_id)  ? supabaseAdmin.from('boards').select('name').eq('id', board_id || req.profile.board_id).single()   : { data: null },
        (class_id   || req.profile.class_id)  ? supabaseAdmin.from('classes').select('grade,name').eq('id', class_id || req.profile.class_id).single() : { data: null },
        subject_id  ? supabaseAdmin.from('subjects').select('name').eq('id', subject_id).single()  : { data: null },
        chapter_id  ? supabaseAdmin.from('chapters').select('title').eq('id', chapter_id).single() : { data: null },
        topic_id    ? supabaseAdmin.from('topics').select('title').eq('id', topic_id).single()     : { data: null },
      ]);

      const { data: session, error: sessErr } = await supabaseAdmin
        .from('tutor_sessions')
        .insert({
          student_id: req.profile.id,
          title:      message.slice(0, 60),
          board_id:   board_id   || req.profile.board_id   || null,
          class_id:   class_id   || req.profile.class_id   || null,
          subject_id: subject_id || null,
          chapter_id: chapter_id || null,
          topic_id:   topic_id   || null,
          concept_id: concept_id || null,
        })
        .select().single();

      if (sessErr) return res.status(400).json({ error: sessErr.message });
      sessionId = session.id;

      sessionContext = {
        board:   boardRes.data?.name,
        class:   classRes.data?.name || (classRes.data?.grade ? `Class ${classRes.data.grade}` : undefined),
        subject: subjectRes.data?.name,
        chapter: chapterRes.data?.title,
        topic:   topicRes.data?.title,
      };
    } else {
      // Fetch existing session context
      const { data: session } = await supabaseAdmin
        .from('tutor_sessions')
        .select(`
          *,
          boards(name), classes(grade, name), subjects(name), chapters(title), topics(title)
        `)
        .eq('id', sessionId)
        .eq('student_id', req.profile.id)
        .single();

      if (!session) return res.status(404).json({ error: 'Tutor session not found' });

      sessionContext = {
        board:   session.boards?.name,
        class:   session.classes?.name || (session.classes?.grade ? `Class ${session.classes.grade}` : undefined),
        subject: session.subjects?.name,
        chapter: session.chapters?.title,
        topic:   session.topics?.title,
      };
    }

    // Fetch conversation history (last 8 messages)
    const { data: history } = await supabaseAdmin
      .from('tutor_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(8);

    // Fetch current question context if question_id provided
    let currentQuestion = null;
    if (question_id) {
      const { data: q } = await supabaseAdmin
        .from('question_bank')
        .select('question_text')
        .eq('id', question_id)
        .single();
      currentQuestion = q?.question_text;
    }

    // Fetch current mastery for the topic
    let masteryScore;
    if (topic_id) {
      const { data: mastery } = await supabaseAdmin
        .from('student_mastery')
        .select('mastery_score')
        .eq('student_id', req.profile.id)
        .eq('topic_id', topic_id)
        .order('mastery_score', { ascending: false })
        .limit(1);
      masteryScore = mastery?.[0]?.mastery_score;
    }

    // Build messages for AI
    const messages = [
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // Call curriculum tutor
    const response = await AI.tutorChat(messages, {
      full_name:       req.profile.full_name,
      class:           sessionContext.class || req.profile.grade,
      board:           sessionContext.board,
      subject:         sessionContext.subject,
      chapter:         sessionContext.chapter,
      topic:           sessionContext.topic,
      mastery:         masteryScore,
      currentQuestion,
      language:        req.profile.preferred_language || 'en',
    });

    // Save both messages
    await supabaseAdmin.from('tutor_messages').insert([
      { session_id: sessionId, role: 'user',      content: message,           question_id: question_id || null },
      { session_id: sessionId, role: 'assistant', content: response.content,  tokens_used: response.tokens_used },
    ]);

    // Touch session updated_at
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

// ── GET /api/v1/tutor/sessions ──────────────────────────────
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tutor_sessions')
      .select(`
        id, title, created_at, updated_at,
        subjects(name), chapters(title), topics(title)
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
      .select(`*, boards(name), classes(grade), subjects(name), chapters(title), topics(title)`)
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
