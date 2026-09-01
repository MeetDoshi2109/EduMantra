const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');
const logger = require('../config/logger');

const router = express.Router();

// ── POST /api/v1/assistant/chat ──────────────────────────
router.post('/chat', authenticate, async (req, res) => {
  const { message, session_id, subject_id, chapter_id, topic_id } = req.body;
  if (!message?.trim()) return res.status(422).json({ error: 'message is required' });

  try {
    let sessionId = session_id;
    let history = [];

    // Ensure the user exists in users table (prevents FK violations)
    if (req.profile?.id) {
      try {
        await supabaseAdmin.from('users').upsert({
          id: req.profile.id,
          email: req.profile.email || req.user?.email || 'user@example.com',
          full_name: req.profile.full_name || 'Student',
          role: req.profile.role || 'student',
        });
      } catch (_) {}
    }

    // Create session if none provided
    if (!sessionId && req.profile?.id) {
      try {
        const { data: session } = await supabaseAdmin
          .from('ai_chat_sessions')
          .insert({
            user_id: req.profile.id,
            title: message.slice(0, 60),
          })
          .select()
          .single();
        if (session?.id) sessionId = session.id;
      } catch (err) {
        logger.warn('Could not persist ai_chat_session:', err.message);
      }
    }

    // Fetch conversation history (last 10 messages for context)
    if (sessionId) {
      try {
        const { data: hist } = await supabaseAdmin
          .from('ai_chat_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(10);
        if (hist) history = hist;
      } catch (err) {
        logger.warn('Could not load chat history:', err.message);
      }
    }

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    let subjectName = 'STEM (Mathematics, Science, Computer Science & IT)';
    if (subject_id && typeof subject_id === 'string' && subject_id !== 'null') {
      try {
        const { data: sub } = await supabaseAdmin.from('subjects').select('name').eq('id', subject_id).single();
        if (sub?.name) subjectName = sub.name;
      } catch (_) {}
    }

    const response = await AI.tutorChat(messages, {
      full_name: req.profile?.full_name || 'Student',
      class: req.profile?.grade ? `Class ${req.profile.grade}` : 'School Student',
      board: req.profile?.board || 'CBSE',
      subject: subjectName,
      language: req.profile?.preferred_language || 'en',
    });

    const reply = response.content || 'I am ready to help with your STEM questions! What would you like to explore?';
    const tokensUsed = response.tokens_used || 0;

    // Save messages if session exists
    if (sessionId) {
      try {
        await supabaseAdmin.from('ai_chat_messages').insert([
          { session_id: sessionId, role: 'user', content: message },
          { session_id: sessionId, role: 'assistant', content: reply, tokens_used: tokensUsed },
        ]);
      } catch (err) {
        logger.warn('Could not save ai_chat_messages:', err.message);
      }
    }

    res.json({
      reply,
      session_id: sessionId || ('sess_' + Date.now()),
      tokens_used: tokensUsed,
    });
  } catch (err) {
    logger.error('Assistant chat failed:', err.message);
    res.status(500).json({
      error: 'Assistant failed',
      detail: err.message,
    });
  }
});

// ── GET /api/v1/assistant/sessions ──────────────────────
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', req.profile.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) return res.json({ sessions: [] });
    res.json({ sessions: data || [] });
  } catch (err) {
    res.json({ sessions: [] });
  }
});

// ── GET /api/v1/assistant/sessions/:id ──────────────────
router.get('/sessions/:id', authenticate, async (req, res) => {
  try {
    const { data: messages, error } = await supabaseAdmin
      .from('ai_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) return res.json({ messages: [] });
    res.json({ messages: messages || [] });
  } catch (err) {
    res.json({ messages: [] });
  }
});

// ── DELETE /api/v1/assistant/sessions/:id ───────────────
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    await supabaseAdmin
      .from('ai_chat_sessions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.profile.id);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;
