
const fs = require('fs');
const { supabaseAdmin } = require('../src/config/supabase');

const BOARDS = {
  cbse: '20000000-0000-0000-0000-000000000001',
  ncert: '20000000-0000-0000-0000-000000000002',
  gujarat: '20000000-0000-0000-0000-000000000003',
};

const STEM_SUBS = [
  { code: 'math',        name: 'Mathematics',           description: 'Numbers, Algebra, Geometry, Calculus & Statistics', color: '#4F46E5' },
  { code: 'science',     name: 'Science',               description: 'Integrated Science & Natural Inquiry',              color: '#059669' },
  { code: 'cs_it',       name: 'Computer Science & IT', description: 'Coding, Python, Web Tech & Data Systems',            color: '#0284C7' },
  { code: 'physics',     name: 'Physics',               description: 'Mechanics, Electromagnetism, Optics & Modern Physics',color: '#2563EB' },
  { code: 'chemistry',   name: 'Chemistry',             description: 'Physical, Inorganic, and Organic Chemistry',        color: '#D97706' },
  { code: 'biology',     name: 'Biology',               description: 'Cell Biology, Genetics, Physiology & Ecology',      color: '#10B981' },
  { code: 'ai_robotics', name: 'AI & Robotics',         description: 'Artificial Intelligence & Intelligent Systems',     color: '#7C3AED' },
];

async function seedAll() {
  console.log('1. Ensuring Classes 1-12...');
  for (const [code, bId] of Object.entries(BOARDS)) {
    for (let g = 1; g <= 12; g++) {
      await supabaseAdmin.from('classes').upsert({
        board_id: bId,
        grade: g,
        name: 'Class ' + g,
        is_active: true,
      }, { onConflict: 'board_id,grade' });
    }
  }

  console.log('2. Ensuring STEM subjects...');
  const subjectMap = {};
  for (const bId of [BOARDS.cbse, BOARDS.ncert]) {
    for (const sub of STEM_SUBS) {
      const { data } = await supabaseAdmin.from('subjects').upsert({
        board_id: bId,
        code: sub.code,
        name: sub.name,
        description: sub.description,
        color_hex: sub.color,
        is_active: true,
      }, { onConflict: 'board_id,code' }).select('id').single();
      if (data) subjectMap[bId + ':' + sub.code] = data.id;
    }
  }

  console.log('3. Seeding NCERT Curriculum from JSON...');
  const raw = fs.readFileSync('scripts/curriculum_ncert_full.json', 'utf-8');
  const curriculum = JSON.parse(raw);

  let bCount = 0, cCount = 0, tCount = 0;

  for (const item of curriculum) {
    const grade = item.grade;
    const { data: cbseClass } = await supabaseAdmin.from('classes').select('id').eq('board_id', BOARDS.cbse).eq('grade', grade).single();

    for (const bk of item.books) {
      const subId = subjectMap[BOARDS.cbse + ':' + bk.subject] || subjectMap[BOARDS.ncert + ':' + bk.subject];
      if (!subId) continue;

      let bookId;
      const { data: existingBook } = await supabaseAdmin.from('books').select('id').eq('class_id', cbseClass.id).eq('subject_id', subId).eq('title', bk.title).maybeSingle();
      if (existingBook) {
        bookId = existingBook.id;
      } else {
        const { data: newBook, error: bErr } = await supabaseAdmin.from('books').insert({
          board_id: BOARDS.cbse,
          class_id: cbseClass.id,
          subject_id: subId,
          title: bk.title,
          publisher: 'NCERT',
          edition: '2026-27 (NCF-SE 2023)',
          academic_year: '2026-27',
          is_active: true,
        }).select('id').single();
        if (bErr || !newBook) {
          console.error('Book insert error:', bk.title, bErr?.message);
          continue;
        }
        bookId = newBook.id;
      }
      bCount++;

      for (const ch of bk.chapters) {
        let chapterId;
        const { data: existingCh } = await supabaseAdmin.from('chapters').select('id').eq('book_id', bookId).eq('chapter_number', ch.num).maybeSingle();
        if (existingCh) {
          chapterId = existingCh.id;
        } else {
          const { data: newCh, error: cErr } = await supabaseAdmin.from('chapters').insert({
            book_id: bookId,
            chapter_number: ch.num,
            title: ch.title,
            description: 'NCERT Class ' + grade + ' ' + bk.title + ' Chapter ' + ch.num,
            estimated_hours: 6,
            is_active: true,
          }).select('id').single();
          if (cErr || !newCh) {
            console.error('Chapter insert error:', ch.title, cErr?.message);
            continue;
          }
          chapterId = newCh.id;
        }
        cCount++;

        let seq = 1;
        for (const t of ch.topics) {
          let topicId;
          const { data: existingTop } = await supabaseAdmin.from('topics').select('id').eq('chapter_id', chapterId).eq('title', t).maybeSingle();
          if (existingTop) {
            topicId = existingTop.id;
          } else {
            const { data: newTop, error: tErr } = await supabaseAdmin.from('topics').insert({
              chapter_id: chapterId,
              title: t,
              sequence_order: seq++,
              is_active: true,
            }).select('id').single();
            if (tErr || !newTop) continue;
            topicId = newTop.id;
          }
          tCount++;

          const { data: existingConcept } = await supabaseAdmin.from('concepts').select('id').eq('topic_id', topicId).maybeSingle();
          if (!existingConcept) {
            await supabaseAdmin.from('concepts').insert({
              topic_id: topicId,
              title: t + ' - Core Principles',
              description: 'Core foundational principles for ' + t,
              sequence_order: 1,
              is_active: true,
            });
          }
        }
      }
    }
    console.log('   ✓ Class ' + grade + ' seeded.');
  }

  console.log('\n✅ Full NCERT Curriculum Seeding Complete!');
  console.log('   Books:    ' + bCount);
  console.log('   Chapters: ' + cCount);
  console.log('   Topics:   ' + tCount);
}

seedAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
