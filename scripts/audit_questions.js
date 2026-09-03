const { supabaseAdmin } = require('../src/config/supabase');

async function audit() {
  const { data: sampleQuestions } = await supabaseAdmin
    .from('question_bank')
    .select('id, question_text, question_type, options, correct_answer')
    .ilike('question_text', '%What is n %')
    .limit(5);

  console.log('Sample questions with "What is n ":');
  (sampleQuestions || []).forEach(q => console.log(' -', q.question_text.slice(0, 80)));

  const { count: bulletCount } = await supabaseAdmin
    .from('question_bank')
    .select('id', { count: 'exact' })
    .ilike('question_text', '%■%');
  console.log('Questions with bullet ■:', bulletCount);

  const { count: totalQ } = await supabaseAdmin
    .from('question_bank')
    .select('id', { count: 'exact' });
  console.log('Total questions in DB:', totalQ);
}

audit().catch(console.error);
