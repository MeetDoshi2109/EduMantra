/**
 * EduMantra AI Provider Contracts
 * All providers must implement these method signatures.
 */

/**
 * @typedef {Object} QuestionConfig
 * @property {number}  numQuestions  - How many questions to generate
 * @property {string}  difficulty    - 'easy' | 'medium' | 'hard' | 'mixed'
 * @property {string[]} questionTypes - ['mcq','true_false','fill_blank','short_answer']
 * @property {string}  [language]    - 'en' | 'hi' | 'gu'
 * @property {Object}  [curriculumContext] - board/class/subject/chapter/topic metadata
 * @property {number}  [masteryScore] - student's current mastery 0-100
 */

/**
 * @typedef {Object} GeneratedQuestion
 * @property {string}   question_text
 * @property {string}   question_type  - 'mcq'|'true_false'|'fill_blank'|'short_answer'
 * @property {Object[]|null} options   - [{key,text}] for MCQ/TF, null for others
 * @property {string}   correct_answer
 * @property {string}   explanation
 * @property {string}   difficulty
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} is_valid
 * @property {number}  confidence   - 0-1
 * @property {string[]} issues      - list of problems found
 * @property {string}  [suggestion] - corrected version suggestion
 */

/**
 * @typedef {Object} TutorResponse
 * @property {string} content      - the reply text
 * @property {number} tokens_used
 * @property {string[]} [suggestions] - follow-up question suggestions
 */

/**
 * @typedef {Object} RecommendationResult
 * @property {Object[]} recommendations - [{type, title, description, priority, metadata}]
 * @property {string}   rationale
 */

module.exports = {};
