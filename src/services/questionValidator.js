/**
 * EduMantra Question Validator
 * Runs AI + rule-based validation pipeline on generated questions.
 * Used by questions route and adaptive engine.
 */

const AI = require('./ai');
const { QUESTION_VALIDATION_ENABLED } = require('../config/env');

const LEVEL_WORDS = {
  1:  ['simple', 'basic', 'know', 'name', 'list', 'match'],
  2:  ['describe', 'explain', 'what', 'how', 'why', 'identify'],
  3:  ['compare', 'calculate', 'solve', 'apply', 'find'],
  4:  ['analyse', 'evaluate', 'design', 'create', 'justify'],
};

/**
 * Rule-based validation — fast, no AI call needed.
 * @param {Object} question
 * @returns {{ is_valid: boolean, issues: string[] }}
 */
function ruleBasedValidation(question) {
  const issues = [];

  // 1. Question text not empty
  if (!question.question_text || question.question_text.trim().length < 10) {
    issues.push('Question text is too short or empty');
  }

  // 2. MCQ must have exactly 4 options
  if (question.question_type === 'mcq') {
    if (!question.options || !Array.isArray(question.options)) {
      issues.push('MCQ question must have options array');
    } else if (question.options.length < 2 || question.options.length > 6) {
      issues.push(`MCQ should have 2-6 options, found ${question.options?.length}`);
    }
  }

  // 3. Correct answer must exist
  if (!question.correct_answer || question.correct_answer.trim() === '') {
    issues.push('Correct answer is missing');
  }

  // 4. Correct answer key must match an option key for MCQ/TF
  if (question.question_type === 'mcq' || question.question_type === 'true_false') {
    const keys = (question.options || []).map(o => o.key);
    if (!keys.includes(question.correct_answer)) {
      issues.push(`Correct answer "${question.correct_answer}" does not match any option key: ${keys.join(', ')}`);
    }
  }

  // 5. Explanation should exist
  if (!question.explanation || question.explanation.trim().length < 5) {
    issues.push('Explanation is missing or too short');
  }

  // 6. Check for obviously inappropriate content patterns
  const lowerText = question.question_text.toLowerCase();
  const banned = ['violence', 'hate', 'racist', 'sexual', 'bomb', 'drug'];
  const hasBanned = banned.some(w => lowerText.includes(w));
  if (hasBanned) {
    issues.push('Question may contain inappropriate content');
  }

  // 7. Question should end with ? or be properly structured
  const qText = question.question_text.trim();
  if (!qText.endsWith('?') && !qText.endsWith('.') && !qText.includes('_____')) {
    issues.push('Question should end with a ? or . or contain _____ for fill-in-the-blank');
  }

  // 8. Duplicate options check (MCQ)
  if (question.question_type === 'mcq' && question.options) {
    const texts = question.options.map(o => o.text?.toLowerCase().trim());
    const unique = new Set(texts);
    if (unique.size < texts.length) {
      issues.push('Question has duplicate option texts');
    }
  }

  return {
    is_valid: issues.length === 0,
    issues,
  };
}

/**
 * Duplicate detection using text similarity.
 * @param {string} newQuestionText
 * @param {string[]} existingTexts
 * @returns {{ is_duplicate: boolean, similarity: number }}
 */
function checkDuplicate(newQuestionText, existingTexts = []) {
  if (!existingTexts.length) return { is_duplicate: false, similarity: 0 };

  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const newNorm = normalize(newQuestionText);

  let maxSimilarity = 0;
  for (const existing of existingTexts) {
    const existNorm = normalize(existing);

    // Simple word overlap similarity
    const newWords = new Set(newNorm.split(' '));
    const existWords = new Set(existNorm.split(' '));
    const intersection = [...newWords].filter(w => existWords.has(w)).length;
    const union = new Set([...newWords, ...existWords]).size;
    const similarity = union > 0 ? intersection / union : 0;

    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }

  return {
    is_duplicate: maxSimilarity > 0.85, // 85% word overlap threshold
    similarity: Math.round(maxSimilarity * 100),
  };
}

/**
 * Full validation pipeline for a single question.
 * @param {Object} question
 * @param {Object} [options]
 * @param {Object} [options.curriculumContext] - for AI validation
 * @param {string[]} [options.existingQuestions] - for duplicate check
 * @param {boolean} [options.skipAI] - skip AI check for speed
 * @returns {Promise<{
 *   overall_valid: boolean,
 *   rule_check: Object,
 *   duplicate_check: Object,
 *   ai_check: Object|null,
 *   issues: string[]
 * }>}
 */
async function validateQuestion(question, options = {}) {
  const { curriculumContext = {}, existingQuestions = [], skipAI = false } = options;

  // 1. Rule-based (fast, synchronous)
  const ruleCheck = ruleBasedValidation(question);

  // 2. Duplicate check
  const dupCheck = checkDuplicate(question.question_text, existingQuestions);

  // 3. AI validation (async, optional)
  let aiCheck = null;
  if (!skipAI && QUESTION_VALIDATION_ENABLED && ruleCheck.is_valid && !dupCheck.is_duplicate) {
    try {
      aiCheck = await AI.validateQuestion(question, curriculumContext);
    } catch (err) {
      // AI validation failure should not block question creation — log and continue
      aiCheck = { is_valid: true, confidence: 0.5, issues: ['AI validation unavailable'], suggestion: null };
    }
  }

  // Aggregate all issues
  const allIssues = [
    ...ruleCheck.issues,
    ...(dupCheck.is_duplicate ? [`Possible duplicate question (${dupCheck.similarity}% similar to existing)`] : []),
    ...(aiCheck?.issues || []),
  ];

  const overallValid = ruleCheck.is_valid &&
    !dupCheck.is_duplicate &&
    (aiCheck === null || aiCheck.is_valid !== false);

  return {
    overall_valid: overallValid,
    rule_check: ruleCheck,
    duplicate_check: dupCheck,
    ai_check: aiCheck,
    issues: allIssues,
  };
}

/**
 * Validate a batch of questions.
 * @param {Object[]} questions
 * @param {Object} options
 * @returns {Promise<Array<{question, validation}>>}
 */
async function validateBatch(questions, options = {}) {
  const existingTexts = [];
  const results = [];

  for (const question of questions) {
    const validation = await validateQuestion(question, {
      ...options,
      existingQuestions: existingTexts,
    });
    results.push({ question, validation });
    // Add to existing so subsequent questions check against previous ones too
    existingTexts.push(question.question_text);
  }

  return results;
}

module.exports = { validateQuestion, validateBatch, ruleBasedValidation, checkDuplicate };
