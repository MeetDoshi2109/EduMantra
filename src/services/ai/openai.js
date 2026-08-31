/**
 * EduMantra — OpenAI AI Provider
 * Implements all AI service methods using OpenAI API.
 */

const OpenAI = require('openai');
const { OPENAI_API_KEY, OPENAI_MODEL } = require('../../config/env');

let _client = null;

function getClient() {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  if (!_client) _client = new OpenAI({ apiKey: OPENAI_API_KEY });
  return _client;
}

/**
 * Build curriculum context string for system prompts.
 */
function buildCurriculumContext(ctx = {}) {
  if (!ctx) return '';
  const parts = [];
  if (ctx.board)   parts.push(`Board: ${ctx.board}`);
  if (ctx.class)   parts.push(`Class: ${ctx.class}`);
  if (ctx.medium)  parts.push(`Medium: ${ctx.medium}`);
  if (ctx.subject) parts.push(`Subject: ${ctx.subject}`);
  if (ctx.book)    parts.push(`Book: ${ctx.book}`);
  if (ctx.chapter) parts.push(`Chapter: ${ctx.chapter}`);
  if (ctx.topic)   parts.push(`Topic: ${ctx.topic}`);
  if (ctx.concept) parts.push(`Concept: ${ctx.concept}`);
  return parts.length ? `Curriculum context: ${parts.join(' | ')}.` : '';
}

/**
 * Generate curriculum-aligned questions from content.
 * @param {string} contentText - source curriculum content
 * @param {import('./providers').QuestionConfig} config
 * @returns {Promise<import('./providers').GeneratedQuestion[]>}
 */
async function generateQuestions(contentText, config = {}) {
  const openai = getClient();
  const {
    numQuestions = 5,
    difficulty = 'medium',
    questionTypes = ['mcq'],
    language = 'en',
    curriculumContext = {},
    masteryScore = null,
  } = config;

  const currCtx = buildCurriculumContext(curriculumContext);
  const langNote = language === 'hi' ? 'Respond in Hindi.' : language === 'gu' ? 'Respond in Gujarati.' : '';
  const masteryNote = masteryScore !== null
    ? `The student's current mastery for this topic is ${masteryScore}%. Calibrate question depth accordingly.`
    : '';

  const typeInstructions = questionTypes.map(t => {
    if (t === 'mcq') return 'MCQ: 4 options (A-D), one correct';
    if (t === 'true_false') return 'True/False: options are [{"key":"A","text":"True"},{"key":"B","text":"False"}]';
    if (t === 'fill_blank') return 'Fill-in-the-blank: question has _____ for the missing word, options: null, correct_answer is the word/phrase';
    if (t === 'short_answer') return 'Short answer: options: null, correct_answer is a brief model answer (1-2 sentences)';
    return t;
  }).join('; ');

  const prompt = `You are an expert school assessment designer for India's K-12 curriculum.
${currCtx}
${masteryNote}
${langNote}

Based ONLY on the following curriculum content, generate exactly ${numQuestions} questions at ${difficulty} difficulty.
Question types to use: ${typeInstructions}

Content:
"""
${contentText.slice(0, 6000)}
"""

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question_text": "Question here?",
      "question_type": "mcq",
      "options": [
        {"key": "A", "text": "Option A"},
        {"key": "B", "text": "Option B"},
        {"key": "C", "text": "Option C"},
        {"key": "D", "text": "Option D"}
      ],
      "correct_answer": "A",
      "explanation": "Brief, student-friendly explanation",
      "difficulty": "${difficulty}",
      "tags": ["optional","topic","tags"]
    }
  ]
}

Rules:
- Questions must be directly answerable from the provided content
- No questions about author, book name, or publication details
- Use simple, age-appropriate language for the class level
- Ensure options are plausible distractors, not obviously wrong
- For fill_blank and short_answer, set options to null`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: 0.7,
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return parsed.questions || [];
}

/**
 * Validate a single AI-generated question for quality and accuracy.
 * @param {Object} question
 * @param {Object} curriculumContext
 * @returns {Promise<import('./providers').ValidationResult>}
 */
async function validateQuestion(question, curriculumContext = {}) {
  const openai = getClient();
  const currCtx = buildCurriculumContext(curriculumContext);

  const prompt = `You are a curriculum quality reviewer for India's school education system.
${currCtx}

Review this question for quality and accuracy:

Question: ${question.question_text}
Type: ${question.question_type}
Options: ${JSON.stringify(question.options)}
Correct Answer: ${question.correct_answer}
Explanation: ${question.explanation}

Check for:
1. Correct answer is actually correct
2. Question is unambiguous and clearly worded
3. Question is appropriate for the curriculum level
4. No factual errors or hallucinated facts
5. Explanation accurately explains why the answer is correct
6. No inappropriate, unsafe, or offensive content
7. Options are plausible (not obviously wrong distractors)

Return JSON:
{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "issues": ["issue1", "issue2"],
  "suggestion": "optional: corrected question text if fixable"
}`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.2,
  });

  return JSON.parse(completion.choices[0].message.content);
}

/**
 * Curriculum-grounded tutor chat.
 * @param {Object[]} messages - conversation history [{role, content}]
 * @param {Object} studentContext - {full_name, class, board, subject, chapter, topic, mastery, currentQuestion}
 * @returns {Promise<import('./providers').TutorResponse>}
 */
async function tutorChat(messages, studentContext = {}) {
  const openai = getClient();

  const { full_name, class: cls, board, subject, chapter, topic, mastery, currentQuestion, language = 'en' } = studentContext;
  const langNote = language === 'hi' ? 'Always respond in Hindi.' : language === 'gu' ? 'Always respond in Gujarati.' : 'Respond in English.';

  const systemPrompt = `You are EduMantra AI Tutor — a friendly, encouraging school tutor for Indian students.
${langNote}

Current student context:
- Name: ${full_name || 'Student'}
- Board: ${board || 'CBSE'} | Class: ${cls || 'Unknown'}
- Subject: ${subject || 'Not specified'} | Chapter: ${chapter || 'Not specified'} | Topic: ${topic || 'Not specified'}
- Current mastery for this topic: ${mastery !== undefined ? `${mastery}%` : 'Not assessed yet'}
${currentQuestion ? `- Currently working on question: "${currentQuestion}"` : ''}

Your responsibilities:
1. Explain concepts clearly at the student's class level — simple words, relatable examples
2. If a student got a question wrong, gently explain why and what the correct answer means
3. Provide hints before giving full answers
4. Encourage and motivate, never shame or discourage
5. Stay grounded in the curriculum — do NOT discuss topics outside ${subject || 'the subject'}
6. Keep explanations concise — 3-5 sentences for most answers
7. If asked about a different subject or off-curriculum topic, politely redirect
8. NEVER generate harmful, inappropriate, or politically charged content`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 700,
    temperature: 0.6,
  });

  const reply = completion.choices[0].message.content;
  const tokensUsed = completion.usage?.total_tokens || 0;

  return { content: reply, tokens_used: tokensUsed };
}

/**
 * Generate AI-powered personalized recommendations based on mastery data.
 * @param {Object} masteryData - {student, subject_mastery, weak_concepts, strong_concepts, recent_performance}
 * @returns {Promise<import('./providers').RecommendationResult>}
 */
async function generateRecommendations(masteryData) {
  const openai = getClient();

  const {
    student = {},
    subject_mastery = [],
    weak_concepts = [],
    recent_performance = [],
  } = masteryData;

  const prompt = `You are an adaptive learning recommendation engine for Indian school students.

Student: ${student.full_name || 'Student'}, Class ${student.class || '?'}, Board: ${student.board || 'CBSE'}

Subject mastery summary:
${subject_mastery.map(s => `- ${s.subject}: ${s.mastery}%`).join('\n')}

Weak concepts (mastery < 60%):
${weak_concepts.slice(0, 10).map(c => `- ${c.concept} (${c.subject}, Chapter: ${c.chapter}): ${c.mastery}%`).join('\n')}

Recent assessment performance:
${recent_performance.slice(0, 5).map(p => `- ${p.topic}: Score ${p.score}%, ${p.correct}/${p.total} correct`).join('\n')}

Generate 5 personalized learning recommendations. Return JSON:
{
  "rationale": "Brief overall assessment of the student's learning state",
  "recommendations": [
    {
      "type": "revise|practice|assess|explore",
      "title": "Short action title",
      "description": "2-sentence description of what to do and why",
      "priority": 1,
      "subject": "subject name",
      "concept": "concept name if applicable",
      "chapter": "chapter name if applicable"
    }
  ]
}

Priority 1 = most urgent. Types: revise=review weak material, practice=more questions, assess=take a test, explore=advance to new topic.`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
    temperature: 0.5,
  });

  return JSON.parse(completion.choices[0].message.content);
}

/**
 * Analyze post-assessment performance and generate feedback.
 * @param {Object} attemptData - {student, assessment, answers, score, topic_performance}
 * @returns {Promise<{feedback: string, strong_areas: string[], weak_areas: string[], next_steps: string[]}>}
 */
async function analyzePerformance(attemptData) {
  const openai = getClient();

  const { student = {}, score = 0, total = 0, correct = 0, topic_performance = [], language = 'en' } = attemptData;
  const langNote = language === 'hi' ? 'Respond in Hindi.' : language === 'gu' ? 'Respond in Gujarati.' : '';

  const prompt = `You are a school assessment analyst giving feedback to a student.
${langNote}

Student: Class ${student.class || '?'}
Score: ${score}% (${correct}/${total} correct)

Topic performance:
${topic_performance.map(t => `- ${t.topic}: ${t.correct}/${t.total} correct`).join('\n')}

Generate encouraging but honest performance feedback. Return JSON:
{
  "feedback": "2-3 sentences of personalized, encouraging feedback",
  "strong_areas": ["topic1", "topic2"],
  "weak_areas": ["topic3", "topic4"],
  "next_steps": ["specific action 1", "specific action 2", "specific action 3"]
}`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.6,
  });

  return JSON.parse(completion.choices[0].message.content);
}

module.exports = { generateQuestions, validateQuestion, tutorChat, generateRecommendations, analyzePerformance };
