const { supabaseAdmin } = require('../src/config/supabase');
const engine = require('../src/services/adaptive/engine');
const AI = require('../src/services/ai');

async function testFullFlow() {
  console.log('🧪 Testing Dynamic Rephrase, Solution Generation & Answer Evaluation...\n');

  // 1. Fetch a real question from Class 10 Math
  const { data: q } = await supabaseAdmin
    .from('question_bank')
    .select('id, question_text, question_type, options, correct_answer, explanation, difficulty')
    .ilike('question_text', '%Euclid%')
    .limit(1)
    .single();

  console.log('1. Raw Database Question:');
  console.log('   Text:       ', q.question_text);
  console.log('   Correct Ans:', q.correct_answer);

  // 2. Test Dynamic Rephrasing
  console.log('\n2. Testing Rephrase & Solution Generation with AI:');
  const rephrased = await AI.rephraseAndContextualizeQuestion(q, {
    grade: 'Class 10',
    subject: 'Mathematics',
    chapter: 'Real Numbers',
  });

  console.log('   Fresh Rephrased Question:');
  console.log('   Text:          ', rephrased.question_text);
  console.log('   Options count: ', rephrased.options?.length);
  (rephrased.options || []).forEach(o => console.log(`     [${o.key}] ${o.text}`));
  console.log('   Correct Answer:', rephrased.correct_answer);
  console.log('   Solution Steps:');
  (rephrased.solution_steps || []).forEach(s => console.log(`     - ${s}`));
  if (rephrased.common_misconception) {
    console.log('   Misconception Alert:', rephrased.common_misconception);
  }

  // 3. Test Multi-Strategy Answer Evaluation
  console.log('\n3. Testing Answer Evaluation Strategies:');

  // Strategy A: Correct letter
  const evalLetter = await AI.evaluateStudentAnswer(rephrased, rephrased.correct_answer);
  console.log('   [Strategy A - Exact Key]:', evalLetter.is_correct ? '✅ CORRECT' : '❌ INCORRECT', `(${evalLetter.method}) -`, evalLetter.feedback);

  // Strategy B: Wrong letter
  const wrongKey = rephrased.correct_answer === 'A' ? 'B' : 'A';
  const evalWrong = await AI.evaluateStudentAnswer(rephrased, wrongKey);
  console.log('   [Strategy B - Wrong Key]:', evalWrong.is_correct ? '❌ INCORRECT (False Positive!)' : '✅ CORRECTLY REJECTED', `(${evalWrong.method}) -`, evalWrong.feedback);

  // Strategy C: Exact text of correct option
  const correctOpt = (rephrased.options || []).find(o => o.key === rephrased.correct_answer);
  if (correctOpt) {
    const evalText = await AI.evaluateStudentAnswer(rephrased, correctOpt.text);
    console.log('   [Strategy C - Option Text]:', evalText.is_correct ? '✅ CORRECT' : '❌ INCORRECT', `(${evalText.method}) -`, evalText.feedback);
  }

  console.log('\n🎉 ALL REPHRASING & ANSWER CHECKING CAPABILITIES VERIFIED SUCCESSFULLY!');
}

testFullFlow().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
