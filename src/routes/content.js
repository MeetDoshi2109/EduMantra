/**
 * Curriculum Content Routes
 * GET  /api/v1/content?chapter_id=&topic_id=&concept_id=
 * GET  /api/v1/content/:id
 * POST /api/v1/content          (instructor/admin: ingest content)
 * PUT  /api/v1/content/:id      (instructor/admin: update)
 * DELETE /api/v1/content/:id   (admin only)
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// ── GET /api/v1/content ─────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const { board_id, class_id, subject_id, chapter_id, topic_id, concept_id, language, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabaseAdmin
      .from('curriculum_content')
      .select(`
        id, title, content_type, source, source_reference, language, version,
        is_verified, created_at,
        boards(name, code), classes(grade, name), subjects(name), chapters(title), topics(title), concepts(title)
      `, { count: 'exact' })
      .eq('is_permitted', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (board_id)   query = query.eq('board_id', board_id);
    if (class_id)   query = query.eq('class_id', class_id);
    if (subject_id) query = query.eq('subject_id', subject_id);
    if (chapter_id) query = query.eq('chapter_id', chapter_id);
    if (topic_id)   query = query.eq('topic_id', topic_id);
    if (concept_id) query = query.eq('concept_id', concept_id);
    if (language)   query = query.eq('language', language);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    res.json({ content: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content', detail: err.message });
  }
});

// ── GET /api/v1/content/:id ─────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('curriculum_content')
      .select(`
        *,
        boards(name, code), classes(grade, name), subjects(name, code),
        books(title, publisher), chapters(title, chapter_number),
        topics(title), concepts(title, description)
      `)
      .eq('id', req.params.id)
      .eq('is_permitted', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Content not found' });
    res.json({ content: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content', detail: err.message });
  }
});

// ── POST /api/v1/content ────────────────────────────────────
router.post('/', authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('source').isIn(['ncert', 'cbse', 'state_board', 'teacher_created', 'curated']).withMessage('Invalid source'),
    body('language').optional().isLength({ min: 2, max: 5 }),
  ],
  validate,
  async (req, res) => {
    const {
      board_id, class_id, subject_id, book_id, chapter_id,
      topic_id, concept_id, learning_objective_id,
      title, content_text, content_type = 'text', source, source_reference,
      source_page, language = 'en', is_permitted = true, metadata,
    } = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from('curriculum_content')
        .insert({
          board_id: board_id || null,
          class_id: class_id || null,
          subject_id: subject_id || null,
          book_id: book_id || null,
          chapter_id: chapter_id || null,
          topic_id: topic_id || null,
          concept_id: concept_id || null,
          learning_objective_id: learning_objective_id || null,
          title,
          content_text: content_text || null,
          content_type,
          source,
          source_reference: source_reference || null,
          source_page: source_page || null,
          language,
          is_permitted,
          metadata: metadata || null,
          created_by: req.profile.id,
          version: '1.0',
        })
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      res.status(201).json({ content: data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create content', detail: err.message });
    }
  }
);

// ── PUT /api/v1/content/:id ─────────────────────────────────
router.put('/:id', authenticate,
  authorize('instructor', 'organization_admin', 'developer'),
  async (req, res) => {
    const allowed = ['title', 'content_text', 'source_reference', 'source_page', 'language', 'is_verified', 'metadata'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (Object.keys(updates).length === 0) {
      return res.status(422).json({ error: 'No valid fields to update' });
    }

    try {
      // Save version before updating
      const { data: current } = await supabaseAdmin
        .from('curriculum_content')
        .select('version, content_text')
        .eq('id', req.params.id)
        .single();

      if (current && updates.content_text && updates.content_text !== current.content_text) {
        await supabaseAdmin.from('content_versions').insert({
          content_id: req.params.id,
          version: current.version,
          content_text: current.content_text,
          changed_by: req.profile.id,
          change_reason: req.body.change_reason || 'Content updated',
        });
        // Increment version
        const vParts = (current.version || '1.0').split('.');
        updates.version = `${vParts[0]}.${parseInt(vParts[1] || 0) + 1}`;
      }

      const { data, error } = await supabaseAdmin
        .from('curriculum_content')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      res.json({ content: data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update content', detail: err.message });
    }
  }
);

// ── DELETE /api/v1/content/:id ──────────────────────────────
router.delete('/:id', authenticate,
  authorize('organization_admin', 'developer'),
  async (req, res) => {
    try {
      // Soft delete by marking is_permitted = false rather than hard delete
      const { error } = await supabaseAdmin
        .from('curriculum_content')
        .update({ is_permitted: false })
        .eq('id', req.params.id);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ message: 'Content removed from active set' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to remove content', detail: err.message });
    }
  }
);

module.exports = router;
