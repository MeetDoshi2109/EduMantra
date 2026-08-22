const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/v1/notifications ───────────────────────────
router.get('/', authenticate, async (req, res) => {
  const { unread_only } = req.query;
  try {
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (unread_only === 'true') query = query.eq('is_read', false);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ notifications: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── PUT /api/v1/notifications/:id/read ──────────────────
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.profile.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ── PUT /api/v1/notifications/read-all ──────────────────
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.profile.id)
      .eq('is_read', false);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ── POST /api/v1/notifications/broadcast (admin) ────────
router.post('/broadcast', authenticate, authorize('organization_admin', 'developer'), async (req, res) => {
  const { title, body, type = 'info', org_id, role } = req.body;
  if (!title || !body) return res.status(422).json({ error: 'title and body required' });

  try {
    let query = supabaseAdmin.from('users').select('id');
    if (org_id) query = query.eq('organization_id', org_id);
    else if (req.profile.role === 'organization_admin') {
      query = query.eq('organization_id', req.profile.organization_id);
    }
    if (role) query = query.eq('role', role);

    const { data: targets } = await query;
    if (!targets?.length) return res.json({ message: 'No users matched' });

    const notifications = targets.map(u => ({ user_id: u.id, title, body, type }));
    const { error } = await supabaseAdmin.from('notifications').insert(notifications);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: `Sent to ${notifications.length} users` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

module.exports = router;
