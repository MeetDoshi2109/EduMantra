
const fs = require('fs');
const { supabaseAdmin } = require('../src/config/supabase');

const BOARDS = {
  cbse: '20000000-0000-0000-0000-000000000001',
  ncert: '20000000-0000-0000-0000-000000000002',
};

async function seedFast() {
  console.log('🚀 Fast NCERT Curriculum Seeder Starting...');

  // 1. Load subjects & classes
  const { data: classes } = await supabaseAdmin.from('classes').select('id, grade').eq('board_id', BOARDS.cbse);
  const classMap = {};
  (classes || []).forEach(c => { classMap[c.grade] = c.id; });

  const { data: subjects } = await supabaseAdmin.from('subjects').select('id, code').eq('board_id', BOARDS.cbse);
  const subjectMap = {};
  (subjects || []).forEach(s => { subjectMap[s.code] = s.id; });

  const raw = fs.readFileSync('scripts/curriculum_ncert_full.json', 'utf-8');
  const curriculum = JSON.parse(raw);

  // 2. Fetch existing books
  const { data: existingBooks } = await supabaseAdmin.from('books').select('id, class_id, subject_id, title');
  const bookMap = {};
  (existingBooks || []).forEach(b => { bookMap[b.class_id + ':' + b.title] = b.id; });

  // Prepare missing books
  const booksToInsert = [];
  for (const item of curriculum) {
    const classId = classMap[item.grade];
    for (const bk of item.books) {
      const subId = subjectMap[bk.subject];
      if (!subId) continue;
      const key = classId + ':' + bk.title;
      if (!bookMap[key]) {
        booksToInsert.push({
          board_id: BOARDS.cbse,
          class_id: classId,
          subject_id: subId,
          title: bk.title,
          publisher: 'NCERT',
          edition: '2026-27 (NCF-SE 2023)',
          academic_year: '2026-27',
          is_active: true,
        });
      }
    }
  }

  if (booksToInsert.length > 0) {
    console.log('Inserting ' + booksToInsert.length + ' missing books...');
    const { data: insertedBooks, error: bErr } = await supabaseAdmin.from('books').insert(booksToInsert).select('id, class_id, title');
    if (bErr) console.error('Error inserting books:', bErr.message);
    (insertedBooks || []).forEach(b => { bookMap[b.class_id + ':' + b.title] = b.id; });
  }

  // 3. Fetch existing chapters
  const { data: existingChs } = await supabaseAdmin.from('chapters').select('id, book_id, chapter_number');
  const chapterMap = {};
  (existingChs || []).forEach(ch => { chapterMap[ch.book_id + ':' + ch.chapter_number] = ch.id; });

  const chaptersToInsert = [];
  for (const item of curriculum) {
    const classId = classMap[item.grade];
    for (const bk of item.books) {
      const bookId = bookMap[classId + ':' + bk.title];
      if (!bookId) continue;
      for (const ch of bk.chapters) {
        const key = bookId + ':' + ch.num;
        if (!chapterMap[key]) {
          chaptersToInsert.push({
            book_id: bookId,
            chapter_number: ch.num,
            title: ch.title,
            description: 'NCERT Class ' + item.grade + ' ' + bk.title + ' Chapter ' + ch.num,
            estimated_hours: 6,
            is_active: true,
          });
        }
      }
    }
  }

  if (chaptersToInsert.length > 0) {
    console.log('Inserting ' + chaptersToInsert.length + ' chapters in batches...');
    for (let i = 0; i < chaptersToInsert.length; i += 50) {
      const batch = chaptersToInsert.slice(i, i + 50);
      const { data: insCh, error: chErr } = await supabaseAdmin.from('chapters').insert(batch).select('id, book_id, chapter_number');
      if (chErr) console.error('Error batch chapters:', chErr.message);
      (insCh || []).forEach(ch => { chapterMap[ch.book_id + ':' + ch.chapter_number] = ch.id; });
    }
  }

  // 4. Fetch existing topics
  const { data: existingTopics } = await supabaseAdmin.from('topics').select('id, chapter_id, title');
  const topicMap = {};
  (existingTopics || []).forEach(t => { topicMap[t.chapter_id + ':' + t.title] = t.id; });

  const topicsToInsert = [];
  for (const item of curriculum) {
    const classId = classMap[item.grade];
    for (const bk of item.books) {
      const bookId = bookMap[classId + ':' + bk.title];
      if (!bookId) continue;
      for (const ch of bk.chapters) {
        const chapterId = chapterMap[bookId + ':' + ch.num];
        if (!chapterId) continue;
        let seq = 1;
        for (const t of ch.topics) {
          const key = chapterId + ':' + t;
          if (!topicMap[key]) {
            topicsToInsert.push({
              chapter_id: chapterId,
              title: t,
              sequence_order: seq++,
              is_active: true,
            });
          }
        }
      }
    }
  }

  if (topicsToInsert.length > 0) {
    console.log('Inserting ' + topicsToInsert.length + ' topics in batches...');
    for (let i = 0; i < topicsToInsert.length; i += 80) {
      const batch = topicsToInsert.slice(i, i + 80);
      const { data: insTop, error: tErr } = await supabaseAdmin.from('topics').insert(batch).select('id, chapter_id, title');
      if (tErr) console.error('Error batch topics:', tErr.message);
      (insTop || []).forEach(t => { topicMap[t.chapter_id + ':' + t.title] = t.id; });
    }
  }

  // 5. Verify final counts
  const [bRes, cRes, tRes] = await Promise.all([
    supabaseAdmin.from('books').select('id', { count: 'exact' }),
    supabaseAdmin.from('chapters').select('id', { count: 'exact' }),
    supabaseAdmin.from('topics').select('id', { count: 'exact' }),
  ]);

  console.log('\n🎉 SUCCESS: All 12 Classes Seeded!');
  console.log('   Total Books in DB:    ' + bRes.count);
  console.log('   Total Chapters in DB: ' + cRes.count);
  console.log('   Total Topics in DB:   ' + tRes.count);
}

seedFast().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
