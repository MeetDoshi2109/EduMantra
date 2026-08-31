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

const { AI_PROVIDER = 'openai' } = process.env;
const logger = require('../../config/logger');

let provider;

switch (AI_PROVIDER.toLowerCase()) {
  case 'openai':
    provider = require('./openai');
    break;
  case 'gemini':
    provider = require('./gemini');
    break;
  default:
    logger.warn(`Unknown AI_PROVIDER "${AI_PROVIDER}", falling back to openai`);
    provider = require('./openai');
}

logger.info(`AI Service initialised with provider: ${AI_PROVIDER}`);

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
