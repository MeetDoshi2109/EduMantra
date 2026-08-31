/**
 * EduMantra Adaptive Assessment Engine
 *
 * Implements IRT-lite (Item Response Theory simplified) adaptive algorithm:
 *   - Difficulty escalates on correct answers
 *   - Difficulty drops on wrong answers
 *   - Prerequisite backtracking on persistent failure
 *   - Knowledge gap detection on consecutive wrong answers
 *   - Mastery update after session completion
 */

const { supabaseAdmin } = require('../../config/supabase');
const { ADAPTIVE_MAX_QUESTIONS, ADAPTIVE_GAP_THRESHOLD, ADAPTIVE_MIN_MASTERY_FOR_ADVANCE } = require('../../config/env');
const logger = require('../../config/logger');

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
const DIFFICULTY_SCORES = { easy: 30, medium: 60, hard: 100 };

const cleanUuid = v => (v && typeof v === 'string' && v !== 'null' && v !== 'undefined' && v.trim().length > 0 ? v.trim() : null);

/**
 * Get next difficulty based on current difficulty and last answer.
 * @param {string} currentDifficulty
 * @param {boolean} wasCorrect
 * @param {number} consecutiveCorrect
 * @param {number} consecutiveWrong
 * @returns {string}
 */
function getNextDifficulty(currentDifficulty, wasCorrect, consecutiveCorrect, consecutiveWrong) {
  const idx = DIFFICULTY_ORDER.indexOf(currentDifficulty);

  if (wasCorrect) {
    // Escalate after 2 consecutive correct answers
    if (consecutiveCorrect >= 2 && idx < DIFFICULTY_ORDER.length - 1) {
      return DIFFICULTY_ORDER[idx + 1];
    }
    return currentDifficulty;
  } else {
    // Drop after 1 wrong answer
    if (idx > 0) return DIFFICULTY_ORDER[idx - 1];
    return 'easy'; // Already at easy
  }
}

/**
 * Pick a question from the question bank that:
 * 1. Matches the required difficulty
 * 2. Is for the correct topic/concept scope
 * 3. Has not been shown in this session
 * 4. Is approved
 *
 * Falls back to adjacent difficulties if no exact match.
 */
async function selectQuestion(sessionState, conceptId = null) {
  const { session, shownQuestionIds, difficulty } = sessionState;

  const tryDifficulties = [difficulty];
  const dIdx = DIFFICULTY_ORDER.indexOf(difficulty);
  if (dIdx > 0)                              tryDifficulties.push(DIFFICULTY_ORDER[dIdx - 1]);
  if (dIdx < DIFFICULTY_ORDER.length - 1)   tryDifficulties.push(DIFFICULTY_ORDER[dIdx + 1]);

  for (const diff of tryDifficulties) {
    let query = supabaseAdmin
      .from('question_bank')
      .select('id, question_text, question_type, options, difficulty, concept_id, topic_id')
      .eq('validation_status', 'approved')
      .eq('is_active', true)
      .eq('difficulty', diff);

    const cleanConceptId = cleanUuid(conceptId);
    const cleanTopicId = cleanUuid(session?.topic_id);
    const cleanChapterId = cleanUuid(session?.chapter_id);

    if (cleanConceptId)          query = query.eq('concept_id', cleanConceptId);
    else if (cleanTopicId) query = query.eq('topic_id', cleanTopicId);
    else if (cleanChapterId) query = query.eq('chapter_id', cleanChapterId);

    if (shownQuestionIds.length > 0) {
      query = query.not('id', 'in', `(${shownQuestionIds.join(',')})`);
    }

    const { data: questions } = await query.limit(10);

    if (questions && questions.length > 0) {
      // Random selection among candidates to avoid always giving same question
      return questions[Math.floor(Math.random() * questions.length)];
    }
  }

  return null; // No more questions available
}

/**
 * Get prerequisite concepts for a concept (ordered by criticality).
 * @param {string} conceptId
 * @returns {Promise<Array>}
 */
async function getPrerequisiteConcepts(conceptId) {
  const { data } = await supabaseAdmin
    .from('concept_prerequisites')
    .select(`
      is_critical,
      prerequisite:concepts!prerequisite_id(id, title, topic_id)
    `)
    .eq('concept_id', conceptId)
    .order('is_critical', { ascending: false });

  return data || [];
}

/**
 * Update student mastery after a session.
 * Uses weighted rolling average: new = 0.7 * old + 0.3 * session_score
 *
 * @param {string} studentId
 * @param {Object[]} conceptPerformance - [{concept_id, correct, total, topic_id, chapter_id, subject_id, board_id, class_id}]
 * @param {string} sessionId
 */
async function updateMastery(studentId, conceptPerformance, sessionId) {
  for (const cp of conceptPerformance) {
    if (!cp.concept_id || cp.total === 0) continue;

    const sessionScore = Math.round((cp.correct / cp.total) * 100);

    // Get current mastery
    const { data: current } = await supabaseAdmin
      .from('student_mastery')
      .select('mastery_score, total_attempts, correct_attempts')
      .eq('student_id', studentId)
      .eq('concept_id', cp.concept_id)
      .single();

    let newScore;
    let totalAttempts;
    let correctAttempts;

    if (current) {
      // Rolling weighted average
      newScore = Math.round(0.7 * current.mastery_score + 0.3 * sessionScore);
      totalAttempts = current.total_attempts + cp.total;
      correctAttempts = current.correct_attempts + cp.correct;
    } else {
      newScore = sessionScore;
      totalAttempts = cp.total;
      correctAttempts = cp.correct;
    }

    newScore = Math.min(100, Math.max(0, newScore));
    const isGap = newScore < 40; // Flag as gap if below 40%
    const masteryLevel = getMasteryLevel(newScore);

    const { data: updated, error } = await supabaseAdmin
      .from('student_mastery')
      .upsert({
        student_id:      cleanUuid(studentId),
        concept_id:      cleanUuid(cp.concept_id),
        topic_id:        cleanUuid(cp.topic_id),
        chapter_id:      cleanUuid(cp.chapter_id),
        subject_id:      cleanUuid(cp.subject_id),
        board_id:        cleanUuid(cp.board_id),
        class_id:        cleanUuid(cp.class_id),
        mastery_score:   newScore,
        mastery_level:   masteryLevel,
        total_attempts:  totalAttempts,
        correct_attempts: correctAttempts,
        last_assessed_at: new Date().toISOString(),
        is_gap:          isGap,
      }, { onConflict: 'student_id,concept_id' })
      .select('mastery_score')
      .single();

    if (error) {
      logger.error('Mastery update failed', { error: error.message, studentId, conceptId: cp.concept_id });
      continue;
    }

    // Record mastery history
    const delta = current ? newScore - current.mastery_score : newScore;
    await supabaseAdmin.from('mastery_history').insert({
      student_id:   studentId,
      concept_id:   cp.concept_id,
      mastery_score: newScore,
      delta,
      session_id:   sessionId,
    });
  }
}

/**
 * Convert numeric mastery score to mastery level label.
 */
function getMasteryLevel(score) {
  if (score === 0)    return 'not_started';
  if (score < 30)     return 'novice';
  if (score < 55)     return 'developing';
  if (score < 75)     return 'proficient';
  if (score < 90)     return 'advanced';
  return 'mastered';
}

/**
 * Detect knowledge gaps from a session.
 * A gap is detected when:
 *   - Student got 3+ consecutive wrong for a concept, OR
 *   - Session score for concept is < 40%
 *
 * @param {Object[]} deliveries - adaptive_question_deliveries records
 * @returns {Object[]} - [{concept_id, concept_title, consecutive_wrong, gap_score}]
 */
function detectGaps(deliveries) {
  const conceptStats = {};

  for (const d of deliveries) {
    if (!d.concept_id) continue;
    if (!conceptStats[d.concept_id]) {
      conceptStats[d.concept_id] = { correct: 0, total: 0, consecutive_wrong: 0, max_consecutive: 0 };
    }
    const s = conceptStats[d.concept_id];
    s.total++;
    if (d.is_correct) {
      s.correct++;
      s.consecutive_wrong = 0;
    } else {
      s.consecutive_wrong++;
      if (s.consecutive_wrong > s.max_consecutive) s.max_consecutive = s.consecutive_wrong;
    }
  }

  const gaps = [];
  for (const [conceptId, stats] of Object.entries(conceptStats)) {
    const score = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    if (stats.max_consecutive >= ADAPTIVE_GAP_THRESHOLD || score < 40) {
      gaps.push({ concept_id: conceptId, score, consecutive_wrong: stats.max_consecutive });
    }
  }

  return gaps;
}

/**
 * Process session answer and compute next question state.
 * This is the core adaptive decision function.
 *
 * @param {Object} session - adaptive_sessions record
 * @param {Object[]} deliveries - all deliveries so far in this session
 * @param {string} questionId - question just answered
 * @param {boolean} isCorrect
 * @returns {Promise<{nextQuestion, sessionUpdates, gapDetected, gapConceptId}>}
 */
async function processAnswer(session, deliveries, questionId, isCorrect) {
  const { consecutive_wrong, consecutive_correct, questions_answered, max_questions } = session;
  let newConsecWrong  = isCorrect ? 0 : consecutive_wrong + 1;
  let newConsecCorrect = isCorrect ? consecutive_correct + 1 : 0;

  // Determine next difficulty
  const nextDifficulty = getNextDifficulty(
    session.current_difficulty || 'medium',
    isCorrect,
    newConsecCorrect,
    newConsecWrong
  );

  // Check if we've hit the question limit
  if (questions_answered + 1 >= max_questions) {
    return {
      nextQuestion: null,
      sessionUpdates: { current_difficulty: nextDifficulty, consecutive_wrong: newConsecWrong, consecutive_correct: newConsecCorrect },
      gapDetected: false,
      gapConceptId: null,
    };
  }

  // Gap detection: if 3+ wrong in a row, check prerequisites
  let nextConceptId = null;
  let gapDetected = false;
  let gapConceptId = null;

  if (newConsecWrong >= ADAPTIVE_GAP_THRESHOLD) {
    // Find the concept of the last question answered
    const lastDelivery = deliveries[deliveries.length - 1];
    if (lastDelivery?.concept_id) {
      gapConceptId = lastDelivery.concept_id;
      gapDetected = true;

      // Check prerequisites and fall back to those
      const prereqs = await getPrerequisiteConcepts(lastDelivery.concept_id);
      if (prereqs.length > 0) {
        nextConceptId = prereqs[0].prerequisite?.id;
        newConsecWrong = 0; // reset as we switch concept
        newConsecCorrect = 0;
      }
    }
  }

  // Select next question
  const shownIds = deliveries.map(d => d.question_id);
  const nextQuestion = await selectQuestion(
    { session, shownQuestionIds: shownIds, difficulty: nextDifficulty },
    nextConceptId
  );

  return {
    nextQuestion,
    sessionUpdates: {
      current_difficulty:  nextDifficulty,
      consecutive_wrong:   newConsecWrong,
      consecutive_correct: newConsecCorrect,
    },
    gapDetected,
    gapConceptId,
  };
}

/**
 * Calculate session performance summary.
 * @param {Object[]} deliveries
 * @param {Object} session
 * @returns {Object}
 */
function calculatePerformanceSummary(deliveries, session) {
  const total  = deliveries.length;
  const correct = deliveries.filter(d => d.is_correct).length;
  const score  = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Per-concept breakdown
  const byConceptId = {};
  for (const d of deliveries) {
    const cid = d.concept_id || 'unknown';
    if (!byConceptId[cid]) byConceptId[cid] = { correct: 0, total: 0, difficulty_progression: [] };
    byConceptId[cid].total++;
    if (d.is_correct) byConceptId[cid].correct++;
    byConceptId[cid].difficulty_progression.push(d.difficulty);
  }

  // Difficulty progression
  const byDifficulty = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
  for (const d of deliveries) {
    const diff = d.difficulty || 'medium';
    if (byDifficulty[diff]) {
      byDifficulty[diff].total++;
      if (d.is_correct) byDifficulty[diff].correct++;
    }
  }

  const gaps = detectGaps(deliveries);

  return {
    score,
    total,
    correct,
    incorrect: total - correct,
    by_concept: byConceptId,
    by_difficulty: byDifficulty,
    detected_gaps: gaps,
    avg_time_secs: deliveries.length > 0
      ? Math.round(deliveries.reduce((s, d) => s + (d.time_taken_secs || 0), 0) / deliveries.length)
      : 0,
  };
}

module.exports = {
  selectQuestion,
  processAnswer,
  updateMastery,
  getMasteryLevel,
  detectGaps,
  calculatePerformanceSummary,
  getPrerequisiteConcepts,
};
