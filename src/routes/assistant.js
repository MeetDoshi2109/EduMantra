const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');

const router = express.Router();

const SYSTEM_PROMPT = `You are EduMantra STEM AI Assistant — an expert academic tutor and study advisor specialized EXCLUSIVELY in STEM Education (Science, Technology, Engineering, and Mathematics).
You assist students with:
- Mathematics (Integers, Equations, Geometry, Trigonometry, Fractions, Statistics, Calculus)
- Science (Physics, Chemistry, Biology, Physical/Chemical changes, Thermodynamics, Electricity, Optics)
- Computer Science & IT (Python programming, Algorithms, Data structures, Binary & logic, Web tech, AI & Robotics)
- Step-by-step problem-solving, formulas, code debugging, and concept clarity.

STRICT RULE: You only answer STEM topics. If asked about non-STEM subjects (history, civics, entertainment, celebrity news, non-STEM essays), politely decline and offer to help with math, science, or computer science.`;

// ── POST /api/v1/assistant/chat ──────────────────────────
router.post('/chat', authenticate, async (req, res) => {
  const { message, session_id, subject_id, chapter_id, topic_id } = req.body;
  if (!message?.trim()) return res.status(422).json({ error: 'message is required' });

  try {
    let sessionId = session_id;

    // Create session if none provided
    if (!sessionId) {
      const { data: session } = await supabaseAdmin
        .from('ai_chat_sessions')
        .insert({
          user_id: req.profile.id,
          title: message.slice(0, 60),
        })
        .select().single();
      sessionId = session.id;
    }

    // Fetch conversation history (last 10 messages for context)
    const { data: history } = await supabaseAdmin
      .from('ai_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    const messages = [
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    let subjectName = 'STEM (Mathematics, Science, Computer Science & IT)';
    if (subject_id && typeof subject_id === 'string' && subject_id !== 'null') {
      const { data: sub } = await supabaseAdmin.from('subjects').select('name').eq('id', subject_id).single();
      if (sub?.name) subjectName = sub.name;
    }

    const response = await AI.tutorChat(messages, {
      full_name: req.profile.full_name,
      class: req.profile.grade ? `Class ${req.profile.grade}` : 'School Student',
      board: req.profile.board || 'CBSE',
      subject: subjectName,
      language: req.profile.preferred_language || 'en',
    });

    const reply = response.content;
    const tokensUsed = response.tokens_used || 0;

    // Save both messages
    await supabaseAdmin.from('ai_chat_messages').insert([
      { session_id: sessionId, role: 'user', content: message },
      { session_id: sessionId, role: 'assistant', content: reply, tokens_used: tokensUsed },
    ]);

    res.json({ reply, session_id: sessionId, tokens_used: tokensUsed });
  } catch (err) {
    res.status(500).json({ error: 'Assistant failed', detail: err.message });
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
    if (error) return res.status(400).json({ error: error.message });
    res.json({ sessions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
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
    if (error) return res.status(400).json({ error: error.message });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
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
