/**
 * EduMantra Adaptive Assessment Engine — v2
 *
 * Improvements over v1:
 *   - 5 difficulty levels: beginner / easy / medium / hard / advanced
 *   - Confidence-weighted scoring: fast correct = 1.0pt, slow correct = 0.7pt
 *   - Spaced repetition: prefer concepts not reviewed in 7+ days
 *   - 3-level prerequisite backtracking on persistent failure
 *   - Session warm-up: starting difficulty derived from last session score
 */

const { supabaseAdmin } = require("../../config/supabase");
const { ADAPTIVE_MAX_QUESTIONS, ADAPTIVE_GAP_THRESHOLD, ADAPTIVE_MIN_MASTERY_FOR_ADVANCE } = require("../../config/env");
const logger = require("../../config/logger");

const DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "advanced"];
const FAST_THRESHOLD_SECS = { beginner: 15, easy: 20, medium: 30, hard: 45, advanced: 60 };
const SPACED_REPETITION_DAYS = 7;

const cleanUuid = v => (v && typeof v === "string" && v !== "null" && v !== "undefined" && v.trim().length > 0 ? v.trim() : null);

/**
 * Determine starting difficulty for a new session based on prior performance.
 */
async function getWarmUpDifficulty(studentId, subjectId = null) {
  try {
    let query = supabaseAdmin
      .from("adaptive_sessions")
      .select("score, current_difficulty")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(3);
    if (subjectId) query = query.eq("subject_id", subjectId);
    const { data: sessions } = await query;
    if (!sessions || sessions.length === 0) return "easy";
    const avgScore = sessions.reduce((s, sess) => s + (sess.score || 0), 0) / sessions.length;
    if (avgScore >= 85) return "hard";
    if (avgScore >= 70) return "medium";
    if (avgScore >= 50) return "easy";
    return "beginner";
  } catch (_) {
    return "easy";
  }
}

/**
 * Get next difficulty — escalate after 2 consecutive correct; drop after 1 wrong.
 */
function getNextDifficulty(currentDifficulty, wasCorrect, consecutiveCorrect, consecutiveWrong) {
  const idx = DIFFICULTY_ORDER.indexOf(currentDifficulty);
  const safeIdx = idx === -1 ? 2 : idx;
  if (wasCorrect) {
    if (consecutiveCorrect >= 2 && safeIdx < DIFFICULTY_ORDER.length - 1) {
      return DIFFICULTY_ORDER[safeIdx + 1];
    }
    return currentDifficulty;
  } else {
    if (safeIdx > 0) return DIFFICULTY_ORDER[safeIdx - 1];
    return "beginner";
  }
}

/**
 * Fetch concept IDs due for spaced repetition (not reviewed for 7+ days, not yet mastered).
 */
async function getSpacedRepetitionConcepts(studentId, subjectId = null) {
  try {
    const cutoff = new Date(Date.now() - SPACED_REPETITION_DAYS * 24 * 3600 * 1000).toISOString();
    let query = supabaseAdmin
      .from("student_mastery")
      .select("concept_id, mastery_score, last_assessed_at")
      .eq("student_id", studentId)
      .lt("last_assessed_at", cutoff)
      .lt("mastery_score", 85)
      .order("last_assessed_at", { ascending: true })
      .limit(10);
    if (subjectId) query = query.eq("subject_id", subjectId);
    const { data } = await query;
    return (data || []).map(d => d.concept_id).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Pick a question from the question bank with spaced repetition preference,
 * progressive scoping, and difficulty cascades.
 */
async function selectQuestion(sessionState, conceptId = null, spacedConceptIds = []) {
  const { session, shownQuestionIds = [], difficulty = "easy" } = sessionState;

  const tryDifficulties = [difficulty];
  const dIdx = DIFFICULTY_ORDER.indexOf(difficulty);
  if (dIdx > 0)                            tryDifficulties.push(DIFFICULTY_ORDER[dIdx - 1]);
  if (dIdx < DIFFICULTY_ORDER.length - 1) tryDifficulties.push(DIFFICULTY_ORDER[dIdx + 1]);
  if (dIdx > 1)                            tryDifficulties.push(DIFFICULTY_ORDER[dIdx - 2]);
  if (dIdx < DIFFICULTY_ORDER.length - 2) tryDifficulties.push(DIFFICULTY_ORDER[dIdx + 2]);

  const cleanConceptId = cleanUuid(conceptId);
  const cleanTopicId   = cleanUuid(session && session.topic_id);
  const cleanChapterId = cleanUuid(session && session.chapter_id);
  const cleanSubjectId = cleanUuid(session && session.subject_id);
  const cleanClassId   = cleanUuid(session && session.class_id);

  // Spaced repetition: try stale concepts first
  if (spacedConceptIds.length > 0) {
    for (const srConceptId of spacedConceptIds) {
      for (const diff of tryDifficulties) {
        let q = supabaseAdmin
          .from("question_bank")
          .select("id, question_text, question_type, options, correct_answer, explanation, difficulty, concept_id, topic_id")
          .eq("validation_status", "approved")
          .eq("is_active", true)
          .eq("difficulty", diff)
          .eq("concept_id", srConceptId);
        if (shownQuestionIds.length > 0) q = q.not("id", "in", "(" + shownQuestionIds.join(",") + ")");
        const { data } = await q.limit(5);
        if (data && data.length > 0) {
          return await rephraseSelected(data[Math.floor(Math.random() * data.length)], session);
        }
      }
    }
  }

  // Progressive scope cascade
  const scopes = [];
  if (cleanConceptId) scopes.push({ type: "concept_id", val: cleanConceptId });
  if (cleanTopicId)   scopes.push({ type: "topic_id",   val: cleanTopicId });
  if (cleanChapterId) scopes.push({ type: "chapter_id", val: cleanChapterId });
  if (cleanSubjectId) scopes.push({ type: "subject_id", val: cleanSubjectId });
  if (cleanClassId)   scopes.push({ type: "class_id",   val: cleanClassId });
  scopes.push({ type: "any", val: null });

  for (const scope of scopes) {
    for (const diff of tryDifficulties) {
      let query = supabaseAdmin
        .from("question_bank")
        .select("id, question_text, question_type, options, correct_answer, explanation, difficulty, concept_id, topic_id")
        .eq("validation_status", "approved")
        .eq("is_active", true)
        .eq("difficulty", diff);
      if (scope.type !== "any" && scope.val) query = query.eq(scope.type, scope.val);
      if (shownQuestionIds.length > 0) query = query.not("id", "in", "(" + shownQuestionIds.join(",") + ")");
      const { data: questions } = await query.limit(10);
      if (questions && questions.length > 0) {
        return await rephraseSelected(questions[Math.floor(Math.random() * questions.length)], session);
      }
    }
  }

  // Final fallback
  let fallbackQuery = supabaseAdmin
    .from("question_bank")
    .select("id, question_text, question_type, options, correct_answer, explanation, difficulty, concept_id, topic_id")
    .eq("is_active", true);
  if (shownQuestionIds.length > 0) fallbackQuery = fallbackQuery.not("id", "in", "(" + shownQuestionIds.join(",") + ")");
  const { data: anyQ } = await fallbackQuery.limit(10);
  if (anyQ && anyQ.length > 0) {
    return await rephraseSelected(anyQ[Math.floor(Math.random() * anyQ.length)], session);
  }
  return null;
}

async function rephraseSelected(question, session) {
  if (!question) return question;
  try {
    const AI = require('../ai');
    return await AI.rephraseAndContextualizeQuestion(question, {
      chapter: session?.chapter_id || '',
      topic: session?.topic_id || '',
    });
  } catch (_) {
    return question;
  }
}

/**
 * Get prerequisite concepts recursively up to maxDepth levels.
 */
async function getPrerequisiteConcepts(conceptId, maxDepth, visited) {
  if (maxDepth === undefined) maxDepth = 3;
  if (visited === undefined) visited = new Set();
  if (!conceptId || visited.has(conceptId) || maxDepth <= 0) return [];
  visited.add(conceptId);
  const { data } = await supabaseAdmin
    .from("concept_prerequisites")
    .select("is_critical, prerequisite:concepts!prerequisite_id(id, title, topic_id)")
    .eq("concept_id", conceptId)
    .order("is_critical", { ascending: false });
  const prereqs = data || [];
  const deeper = [];
  for (const p of prereqs) {
    const sub = await getPrerequisiteConcepts(p.prerequisite && p.prerequisite.id, maxDepth - 1, visited);
    deeper.push.apply(deeper, sub);
  }
  return prereqs.concat(deeper);
}

/**
 * Confidence-weighted score for a delivery (fast correct = 1.0, slow correct = 0.7, wrong = 0).
 */
function getConfidenceWeight(delivery) {
  if (!delivery.is_correct) return 0;
  const threshold = FAST_THRESHOLD_SECS[delivery.difficulty] || 30;
  const timeTaken = delivery.time_taken_secs || threshold;
  return timeTaken <= threshold ? 1.0 : 0.7;
}

/**
 * Update student mastery using weighted rolling average.
 */
async function updateMastery(studentId, conceptPerformance, sessionId) {
  for (const cp of conceptPerformance) {
    if (!cp.concept_id || cp.total === 0) continue;
    const sessionScore = Math.round((cp.correct / cp.total) * 100);
    const { data: current } = await supabaseAdmin
      .from("student_mastery")
      .select("mastery_score, total_attempts, correct_attempts")
      .eq("student_id", studentId)
      .eq("concept_id", cp.concept_id)
      .single();
    let newScore, totalAttempts, correctAttempts;
    if (current) {
      newScore = Math.round(0.7 * current.mastery_score + 0.3 * sessionScore);
      totalAttempts = current.total_attempts + cp.total;
      correctAttempts = current.correct_attempts + cp.correct;
    } else {
      newScore = sessionScore;
      totalAttempts = cp.total;
      correctAttempts = cp.correct;
    }
    newScore = Math.min(100, Math.max(0, newScore));
    const isGap = newScore < 40;
    const masteryLevel = getMasteryLevel(newScore);
    const { error } = await supabaseAdmin
      .from("student_mastery")
      .upsert({
        student_id:       cleanUuid(studentId),
        concept_id:       cleanUuid(cp.concept_id),
        topic_id:         cleanUuid(cp.topic_id),
        chapter_id:       cleanUuid(cp.chapter_id),
        subject_id:       cleanUuid(cp.subject_id),
        board_id:         cleanUuid(cp.board_id),
        class_id:         cleanUuid(cp.class_id),
        mastery_score:    newScore,
        mastery_level:    masteryLevel,
        total_attempts:   totalAttempts,
        correct_attempts: correctAttempts,
        last_assessed_at: new Date().toISOString(),
        is_gap:           isGap,
      }, { onConflict: "student_id,concept_id" })
      .select("mastery_score").single();
    if (error) { logger.error("Mastery update failed", { error: error.message, studentId, conceptId: cp.concept_id }); continue; }
    const delta = current ? newScore - current.mastery_score : newScore;
    await supabaseAdmin.from("mastery_history").insert({ student_id: studentId, concept_id: cp.concept_id, mastery_score: newScore, delta, session_id: sessionId });
  }
}

function getMasteryLevel(score) {
  if (score === 0)  return "not_started";
  if (score < 30)   return "novice";
  if (score < 55)   return "developing";
  if (score < 75)   return "proficient";
  if (score < 90)   return "advanced";
  return "mastered";
}

function detectGaps(deliveries) {
  const conceptStats = {};
  for (const d of deliveries) {
    if (!d.concept_id) continue;
    if (!conceptStats[d.concept_id]) conceptStats[d.concept_id] = { correct: 0, total: 0, consecutive_wrong: 0, max_consecutive: 0, weighted_score: 0 };
    const s = conceptStats[d.concept_id];
    s.total++;
    s.weighted_score += getConfidenceWeight(d);
    if (d.is_correct) { s.correct++; s.consecutive_wrong = 0; }
    else { s.consecutive_wrong++; if (s.consecutive_wrong > s.max_consecutive) s.max_consecutive = s.consecutive_wrong; }
  }
  const gaps = [];
  for (const [conceptId, stats] of Object.entries(conceptStats)) {
    const rawScore = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    const weightedScore = stats.total > 0 ? (stats.weighted_score / stats.total) * 100 : 0;
    const effectiveScore = Math.round((rawScore + weightedScore) / 2);
    if (stats.max_consecutive >= ADAPTIVE_GAP_THRESHOLD || effectiveScore < 40) {
      gaps.push({ concept_id: conceptId, score: effectiveScore, consecutive_wrong: stats.max_consecutive });
    }
  }
  return gaps;
}

async function processAnswer(session, deliveries, questionId, isCorrect) {
  const { consecutive_wrong, consecutive_correct, questions_answered, max_questions } = session;
  let newConsecWrong  = isCorrect ? 0 : consecutive_wrong + 1;
  let newConsecCorrect = isCorrect ? consecutive_correct + 1 : 0;

  const nextDifficulty = getNextDifficulty(
    session.current_difficulty || "easy",
    isCorrect,
    newConsecCorrect,
    newConsecWrong
  );

  if (questions_answered + 1 >= max_questions) {
    return {
      nextQuestion: null,
      sessionUpdates: { current_difficulty: nextDifficulty, consecutive_wrong: newConsecWrong, consecutive_correct: newConsecCorrect },
      gapDetected: false,
      gapConceptId: null,
    };
  }

  let nextConceptId = null;
  let gapDetected = false;
  let gapConceptId = null;

  if (newConsecWrong >= ADAPTIVE_GAP_THRESHOLD) {
    const lastDelivery = deliveries[deliveries.length - 1];
    if (lastDelivery && lastDelivery.concept_id) {
      gapConceptId = lastDelivery.concept_id;
      gapDetected = true;
      const prereqs = await getPrerequisiteConcepts(lastDelivery.concept_id, 3);
      if (prereqs.length > 0) {
        nextConceptId = prereqs[0].prerequisite && prereqs[0].prerequisite.id;
        newConsecWrong = 0;
        newConsecCorrect = 0;
      }
    }
  }

  const shownIds = deliveries.map(d => d.question_id);
  const spacedConcepts = await getSpacedRepetitionConcepts(session.student_id, session.subject_id);

  const nextQuestion = await selectQuestion(
    { session, shownQuestionIds: shownIds, difficulty: nextDifficulty },
    nextConceptId,
    spacedConcepts
  );

  return {
    nextQuestion,
    sessionUpdates: { current_difficulty: nextDifficulty, consecutive_wrong: newConsecWrong, consecutive_correct: newConsecCorrect },
    gapDetected,
    gapConceptId,
  };
}

function calculatePerformanceSummary(deliveries, session) {
  const total   = deliveries.length;
  const correct = deliveries.filter(d => d.is_correct).length;
  const score   = total > 0 ? Math.round((correct / total) * 100) : 0;
  const totalWeight = deliveries.reduce((s, d) => s + getConfidenceWeight(d), 0);
  const confidenceScore = total > 0 ? Math.round((totalWeight / total) * 100) : 0;
  const byConceptId = {};
  for (const d of deliveries) {
    const cid = d.concept_id || "unknown";
    if (!byConceptId[cid]) byConceptId[cid] = { correct: 0, total: 0, difficulty_progression: [] };
    byConceptId[cid].total++;
    if (d.is_correct) byConceptId[cid].correct++;
    byConceptId[cid].difficulty_progression.push(d.difficulty);
  }
  const byDifficulty = {};
  for (const level of DIFFICULTY_ORDER) byDifficulty[level] = { correct: 0, total: 0 };
  for (const d of deliveries) {
    const diff = d.difficulty || "easy";
    if (byDifficulty[diff]) { byDifficulty[diff].total++; if (d.is_correct) byDifficulty[diff].correct++; }
  }
  const gaps = detectGaps(deliveries);
  return {
    score,
    confidence_score: confidenceScore,
    total,
    correct,
    incorrect: total - correct,
    by_concept: byConceptId,
    by_difficulty: byDifficulty,
    detected_gaps: gaps,
    avg_time_secs: total > 0 ? Math.round(deliveries.reduce((s, d) => s + (d.time_taken_secs || 0), 0) / total) : 0,
  };
}

module.exports = {
  selectQuestion,
  processAnswer,
  evaluateAnswer: (question, studentAnswer) => require('../ai').evaluateStudentAnswer(question, studentAnswer),
  updateMastery,
  getMasteryLevel,
  detectGaps,
  calculatePerformanceSummary,
  getPrerequisiteConcepts,
  getWarmUpDifficulty,
  getSpacedRepetitionConcepts,
  getConfidenceWeight,
  DIFFICULTY_ORDER,
};

