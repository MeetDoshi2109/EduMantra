/**
 * Curriculum Hierarchy Routes
 * GET /api/v1/curriculum/boards
 * GET /api/v1/curriculum/classes
 * GET /api/v1/curriculum/mediums
 * GET /api/v1/curriculum/subjects
 * GET /api/v1/curriculum/books
 * GET /api/v1/curriculum/chapters
 * GET /api/v1/curriculum/topics
 * GET /api/v1/curriculum/concepts
 * GET /api/v1/curriculum/concepts/:id/prerequisites
 */

const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

// Cache curriculum hierarchy in memory for 10 minutes (reduces DB calls)
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cached(key, fn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return Promise.resolve(entry.data);
  return fn().then(data => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

// ── GET /api/v1/curriculum/boards ───────────────────────────
router.get('/boards', optionalAuth, async (req, res) => {
  try {
    const data = await cached('boards', async () => {
      const { data, error } = await supabaseAdmin
        .from('boards')
        .select('id, name, code, board_type, description')
        .eq('is_active', true)
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    });
    res.json({ boards: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch boards', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/classes?board_id= ────────────────
router.get('/classes', optionalAuth, async (req, res) => {
  const boardId = cleanUuid(req.query.board_id);
  try {
    const key = `classes:${boardId || 'all'}`;
    const data = await cached(key, async () => {
      let query = supabaseAdmin
        .from('classes')
        .select('id, board_id, grade, name, boards(name, code)')
        .eq('is_active', true)
        .order('grade');
      if (boardId) query = query.eq('board_id', boardId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    });
    res.json({ classes: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classes', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/mediums ──────────────────────────
router.get('/mediums', optionalAuth, async (req, res) => {
  try {
    const data = await cached('mediums', async () => {
      const { data, error } = await supabaseAdmin
        .from('mediums')
        .select('id, name, code, medium_type')
        .eq('is_active', true)
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    });
    res.json({ mediums: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mediums', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/subjects?board_id=&class_id= ─────
const STEM_CODES = ['math', 'science', 'cs_it', 'ai_robotics', 'physics', 'chemistry', 'biology', 'computer'];

router.get('/subjects', optionalAuth, async (req, res) => {
  const boardId = cleanUuid(req.query.board_id);
  const classId = cleanUuid(req.query.class_id);
  const stemOnly = req.query.stem_only !== 'false';
  try {
    const key = `subjects:${boardId || 'all'}:${classId || 'all'}:${stemOnly}`;
    const data = await cached(key, async () => {
      let query = supabaseAdmin
        .from('subjects')
        .select('id, board_id, name, code, description, icon_url, color_hex')
        .eq('is_active', true)
        .order('name');
      if (boardId) query = query.eq('board_id', boardId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (stemOnly && data) {
        return data.filter(s => {
          const n = (s.name || '').toLowerCase();
          const c = (s.code || '').toLowerCase();
          if (n.includes('social') || c === 'sst') return false;
          if (STEM_CODES.includes(c)) return true;
          return n.includes('math') || n.includes('science') || n.includes('computer') || n.includes('coding') || n.includes('physics') || n.includes('chem') || n.includes('bio');
        });
      }
      return data;
    });
    res.json({ subjects: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/books?board_id=&class_id=&subject_id= ──
router.get('/books', optionalAuth, async (req, res) => {
  const boardId   = cleanUuid(req.query.board_id);
  const classId   = cleanUuid(req.query.class_id);
  const subjectId = cleanUuid(req.query.subject_id);
  const mediumId  = cleanUuid(req.query.medium_id);
  try {
    let query = supabaseAdmin
      .from('books')
      .select(`
        id, title, publisher, edition, academic_year, cover_url,
        boards(name, code), classes(grade, name), subjects(name, code), mediums(name, code)
      `)
      .eq('is_active', true)
      .order('title');

    if (boardId)   query = query.eq('board_id', boardId);
    if (classId)   query = query.eq('class_id', classId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (mediumId)  query = query.eq('medium_id', mediumId);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ books: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch books', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/chapters?book_id= ────────────────
router.get('/chapters', optionalAuth, async (req, res) => {
  const bookId = cleanUuid(req.query.book_id);
  if (!bookId) return res.status(422).json({ error: 'book_id is required' });

  try {
    const key = `chapters:${bookId}`;
    const data = await cached(key, async () => {
      const { data, error } = await supabaseAdmin
        .from('chapters')
        .select('id, book_id, chapter_number, title, description, learning_goals, estimated_hours')
        .eq('book_id', bookId)
        .eq('is_active', true)
        .order('chapter_number');
      if (error) throw new Error(error.message);
      return data;
    });
    res.json({ chapters: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chapters', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/topics?chapter_id= ───────────────
router.get('/topics', optionalAuth, async (req, res) => {
  const chapterId = cleanUuid(req.query.chapter_id);
  if (!chapterId) return res.status(422).json({ error: 'chapter_id is required' });

  try {
    const key = `topics:${chapterId}`;
    const data = await cached(key, async () => {
      const { data, error } = await supabaseAdmin
        .from('topics')
        .select('id, chapter_id, title, description, sequence_order')
        .eq('chapter_id', chapterId)
        .eq('is_active', true)
        .order('sequence_order');
      if (error) throw new Error(error.message);
      return data;
    });
    res.json({ topics: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch topics', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/concepts?topic_id= ───────────────
router.get('/concepts', optionalAuth, async (req, res) => {
  const topicId = cleanUuid(req.query.topic_id);
  if (!topicId) return res.status(422).json({ error: 'topic_id is required' });

  try {
    const key = `concepts:${topicId}`;
    const data = await cached(key, async () => {
      const { data, error } = await supabaseAdmin
        .from('concepts')
        .select(`
          id, topic_id, title, description, key_terms, sequence_order,
          learning_objectives(id, objective, verb)
        `)
        .eq('topic_id', topicId)
        .eq('is_active', true)
        .order('sequence_order');
      if (error) throw new Error(error.message);
      return data;
    });
    res.json({ concepts: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch concepts', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/concepts/:id/prerequisites ───────
router.get('/concepts/:id/prerequisites', authenticate, async (req, res) => {
  const id = cleanUuid(req.params.id);
  if (!id) return res.status(422).json({ error: 'concept id is required' });
  try {
    const { data, error } = await supabaseAdmin
      .from('concept_prerequisites')
      .select(`
        id, is_critical,
        prerequisite:concepts!prerequisite_id(
          id, title, description,
          topics(id, title, chapters(id, title))
        )
      `)
      .eq('concept_id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ prerequisites: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prerequisites', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/tree?board_id=&class_id=&subject_id= ─
router.get('/tree', authenticate, async (req, res) => {
  const boardId   = cleanUuid(req.query.board_id);
  const classId   = cleanUuid(req.query.class_id);
  const subjectId = cleanUuid(req.query.subject_id);
  if (!boardId || !classId || !subjectId) {
    return res.status(422).json({ error: 'board_id, class_id, and subject_id are required' });
  }

  try {
    const { data: books, error } = await supabaseAdmin
      .from('books')
      .select(`
        id, title, publisher, edition,
        chapters(
          id, chapter_number, title, learning_goals, estimated_hours,
          topics(
            id, title, sequence_order,
            concepts(id, title, key_terms, sequence_order)
          )
        )
      `)
      .eq('board_id', boardId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('is_active', true)
      .order('title');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ tree: books || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch curriculum tree', detail: err.message });
  }
});

// ── GET /api/v1/curriculum/student-context ──────────────────
router.get('/student-context', authenticate, async (req, res) => {
  const profile = req.profile || {};
  const boardId = cleanUuid(profile.board_id);
  const classId = cleanUuid(profile.class_id);
  const mediumId = cleanUuid(profile.medium_id);

  if (!boardId || !classId) {
    return res.json({ context: null, message: 'Student has not selected a board/class yet' });
  }

  try {
    const [boardRes, classRes, mediumRes] = await Promise.all([
      boardId ? supabaseAdmin.from('boards').select('id,name,code').eq('id', boardId).single() : { data: null },
      classId ? supabaseAdmin.from('classes').select('id,grade,name').eq('id', classId).single() : { data: null },
      mediumId ? supabaseAdmin.from('mediums').select('id,name,code').eq('id', mediumId).single() : { data: null },
    ]);

    res.json({
      context: {
        board: boardRes.data,
        class: classRes.data,
        medium: mediumRes.data,
        grade: profile.grade,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student context', detail: err.message });
  }
});

// ── PUT /api/v1/curriculum/student-context ──────────────────
router.put('/student-context', authenticate, async (req, res) => {
  const boardId  = cleanUuid(req.body.board_id);
  const classId  = cleanUuid(req.body.class_id);
  const mediumId = cleanUuid(req.body.medium_id);

  if (!boardId || !classId) {
    return res.status(422).json({ error: 'board_id and class_id are required' });
  }

  try {
    const { data: cls } = await supabaseAdmin
      .from('classes')
      .select('id, grade')
      .eq('id', classId)
      .eq('board_id', boardId)
      .single();

    if (!cls) return res.status(400).json({ error: 'Invalid class for this board' });

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ board_id: boardId, class_id: classId, medium_id: mediumId, grade: cls.grade })
      .eq('id', req.profile.id)
      .select('id, board_id, class_id, medium_id, grade')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    cache.clear();
    res.json({ context: data, message: 'Curriculum context updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update student context', detail: err.message });
  }
});

module.exports = router;
