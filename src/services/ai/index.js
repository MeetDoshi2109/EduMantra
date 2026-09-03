/**
 * EduMantra AI Service — Provider Factory
 *
 * Selects the configured AI provider and exports a unified interface.
 * Set AI_PROVIDER env var to switch providers: 'openai' (default) | 'gemini'
 *
 * Usage:
 *   const AI = require('../services/ai');
 *   const questions = await AI.generateQuestions(text, config);
 */

const { AI_PROVIDER = 'gemini' } = require('../../config/env');
const logger = require('../../config/logger');

let provider;

switch ((AI_PROVIDER || 'gemini').toLowerCase()) {
  case 'gemini':
    provider = require('./gemini');
    break;
  case 'openai':
    provider = require('./openai');
    break;
  default:
    logger.warn(`Unknown AI_PROVIDER "${AI_PROVIDER}", falling back to gemini`);
    provider = require('./gemini');
}

logger.info(`AI Service initialised with provider: ${AI_PROVIDER || 'gemini'}`);

module.exports = {
  /**
   * Generate curriculum-aligned questions from content.
   * @param {string} contentText
   * @param {import('./providers').QuestionConfig} config
   */
  generateQuestions: (contentText, config) => provider.generateQuestions(contentText, config),

  /**
   * Validate a single question for quality, accuracy, and safety.
   * @param {Object} question
   * @param {Object} curriculumContext
   */
  validateQuestion: (question, curriculumContext) => provider.validateQuestion(question, curriculumContext),

  /**
   * Grounded curriculum tutor chat.
   * @param {Object[]} messages
   * @param {Object} studentContext
   */
  tutorChat: (messages, studentContext) => provider.tutorChat(messages, studentContext),

  /**
   * Grounded curriculum tutor chat streaming chunks via SSE.
   * @param {Object[]} messages
   * @param {Object} studentContext
   * @param {Function} onChunk
   */
  tutorChatStream: (messages, studentContext, onChunk) => {
    if (typeof provider.tutorChatStream === 'function') {
      return provider.tutorChatStream(messages, studentContext, onChunk);
    }
    return provider.tutorChat(messages, studentContext).then(res => {
      if (res && res.content) onChunk(res.content);
      return res;
    });
  },

  /**
   * Tiered progressive hint generator (Levels 1, 2, 3).
   * @param {Object} question
   * @param {number} hintLevel
   * @param {Object} studentContext
   */
  generateHint: (question, hintLevel, studentContext) => {
    if (typeof provider.generateHint === 'function') {
      return provider.generateHint(question, hintLevel, studentContext);
    }
    return Promise.resolve({
      hint: 'Think about the core law or formula connecting the given values.',
      hint_level: hintLevel || 1,
    });
  },

  /**
   * Socratic follow-up challenge question generator.
   */
  generateFollowUpQuestion: (topic, concept, difficulty) => {
    if (typeof provider.generateFollowUpQuestion === 'function') {
      return provider.generateFollowUpQuestion(topic, concept, difficulty);
    }
    return Promise.resolve(null);
  },

  /**
   * Generate personalized learning recommendations.
   * @param {Object} masteryData
   */
  generateRecommendations: (masteryData) => provider.generateRecommendations(masteryData),

  /**
   * Analyze assessment performance and generate feedback.
   * @param {Object} attemptData
   */
  analyzePerformance: (attemptData) => provider.analyzePerformance(attemptData),
};
