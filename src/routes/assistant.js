const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const AI = require('../services/ai');

const router = express.Router();

const SYSTEM_PROMPT = `You are EduMantra AI Assistant, an expert learning advisor for government officials in India's Official Statistical System. You help users:
- Understand their skill gaps and competency requirements
- Find relevant courses on iGOT Karmayogi platform
- Navigate statistical concepts (Survey Design, National Accounts, SDGs, etc.)
- Learn technical tools (Python, R, SQL, GIS, SPSS, etc.)
- Understand digital governance and data privacy
- Plan their learning journey and career progression

Be concise, practical, and supportive. Use simple language. When referencing courses or resources, suggest checking the iGOT platform.`;

// ── POST /api/v1/assistant/chat ──────────────────────────
router.post('/chat', authenticate, async (req, res) => {
  const { message, session_id } = req.body;
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

    const response = await AI.tutorChat(messages, {
      full_name: req.profile.full_name,
      designation: req.profile.designation,
      role: req.profile.role,
      subject: 'Statistics and Government Learning',
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
