const { supabaseAdmin } = require('../src/config/supabase');

function sanitizeText(raw) {
  if (!raw) return raw;
  let text = raw
    .replace(/■/g, '')
    .replace(/\b([Ww]hat is|[Ee]xplain|[Dd]efine|[Dd]escribe)\s+n\s+/g, '$1 ')
    .replace(/\b([Ii]s|[Oo]f|[Tt]o|[Ww]ith|[Aa]nd|[Ff]or|[Aa]bout)\s+n\s+/g, '$1 ')
    .replace(/\bn\s+([A-Z0-9])/g, '$1')
    .replace(/\s*,\s*and what are its main features\?/gi, ', and what are its core properties?')
    .replace(/\s*Use a simple example\.?/gi, '')
    .replace(/\s*Use a school-life example\.?/gi, '')
    .replace(/\s*Use a real-world example\.?/gi, '')
    .replace(/\s*Explain in your own words\.?/gi, '')
    .replace(/\s*Justify your response\.?/gi, '')
    .replace(/\s*Show the idea with a diagram where appropriate\.?/gi, '')
    .replace(/\s*Mention one common misconception\.?/gi, '')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.endsWith(',')) text = text.slice(0, -1);
  if (!text.endsWith('?') && !text.endsWith('.')) text += '?';

  return text;
}

async function cleanAll() {
  console.log('🧹 Fast Concurrent Question Sanitizer Starting...');
  const pageSize = 500;
  let offset = 0;
  let totalCleaned = 0;

  while (true) {
    const { data: questions, error } = await supabaseAdmin
      .from('question_bank')
      .select('id, question_text, explanation')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Fetch error at offset', offset, error.message);
      break;
    }
    if (!questions || questions.length === 0) break;

    const updates = [];
    for (const q of questions) {
      const cleaned = sanitizeText(q.question_text);
      let cleanedExp = q.explanation ? sanitizeText(q.explanation) : q.explanation;
      if (cleaned !== q.question_text || cleanedExp !== q.explanation) {
        updates.push({
          id: q.id,
          question_text: cleaned,
          explanation: cleanedExp,
        });
      }
    }

    if (updates.length > 0) {
      // Run updates in parallel batches of 25
      for (let i = 0; i < updates.length; i += 25) {
        const chunk = updates.slice(i, i + 25);
        await Promise.all(chunk.map(u =>
          supabaseAdmin
            .from('question_bank')
            .update({
              question_text: u.question_text,
              explanation: u.explanation,
            })
            .eq('id', u.id)
        ));
      }
      totalCleaned += updates.length;
    }

    offset += pageSize;
    console.log(`   Processed ${offset} questions (${totalCleaned} sanitized so far)...`);
  }

  console.log(`\n✅ Finished! Sanitized ${totalCleaned} questions.`);
}

cleanAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
