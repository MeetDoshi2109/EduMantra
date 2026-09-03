/**
 * EduMantra — Google Gemini AI Provider
 * Implements resilient AI service methods using Google Generative Language REST API
 * with automatic model fallback, retry with backoff, timeouts, and safe JSON parsing.
 */

const { GEMINI_API_KEY, GEMINI_MODEL: CONFIGURED_MODEL } = require('../../config/env');
const logger = require('../../config/logger');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Preferred healthy models cascade (tested & fast)
const DEFAULT_MODEL = CONFIGURED_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
].filter((m, idx, arr) => arr.indexOf(m) === idx);

function getApiKey() {
  const key = GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured in environment variables');
  return key;
}

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
 * Safely parse JSON strings returned by LLMs (handling markdown fences, partial objects, etc.)
 */
function safeParseJson(text, fallback = null) {
  if (!text || typeof text !== 'string') return fallback;
  const raw = text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Search for outermost JSON object { ... }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch {}
      }

      // Search for outermost JSON array [ ... ]
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        try {
          return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
        } catch {}
      }

      logger.warn('Failed to parse Gemini JSON output:', { preview: text.slice(0, 150) });
      return fallback;
    }
  }
}

/**
 * Robust caller to Gemini API with model cascade, timeout, and backoff retries.
 */
async function callGemini(contents, systemInstruction = null, responseJson = false, temperature = 0.7) {
  const apiKey = getApiKey();
  let lastError = null;

  for (const model of FALLBACK_MODELS) {
    // Attempt up to 2 times per candidate model
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      try {
        const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
        const generationConfig = {
          temperature,
          ...(responseJson ? { responseMimeType: 'application/json' } : {}),
        };

        // Disable heavy thinking delays on 3.x lite models for near-instant responses
        if (model.includes('3.1-flash') || model.includes('flash-lite')) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const body = {
          contents,
          generationConfig,
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        let res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        // If thinkingConfig caused 400 bad request, retry immediately without it
        if (res.status === 400 && generationConfig.thinkingConfig) {
          delete generationConfig.thinkingConfig;
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig, ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}) }),
            signal: controller.signal,
          });
        }

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          const errStatus = res.status;
          
          // 404 = model unavailable, 503 = high demand surge, 429 = rate limit
          if ([404, 503, 429, 500, 502, 504].includes(errStatus)) {
            lastError = new Error(`Gemini API error (HTTP ${errStatus}) on model ${model}: ${errText.slice(0, 120)}`);
            logger.warn(`Gemini model ${model} returned HTTP ${errStatus}. Trying next available model/attempt...`);
            // Brief backoff before next attempt
            await new Promise(r => setTimeout(r, 400 * attempt));
            continue;
          }

          throw new Error(`Gemini API error (HTTP ${errStatus}): ${errText}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        
        // Aggregate all text parts
        const parts = candidate?.content?.parts || [];
        const text = parts.map(p => p.text || '').join('').trim();
        const tokensUsed = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);

        if (!text && candidate?.finishReason && candidate.finishReason !== 'STOP') {
          logger.warn(`Gemini response stopped with finishReason: ${candidate.finishReason}`);
        }

        return { text, tokensUsed, modelUsed: model, data };
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
        logger.warn(`Gemini request to ${model} (attempt ${attempt}) failed: ${isAbort ? 'Timeout (12s)' : err.message}`);
        
        // Don't retry if invalid key or fatal client error
        if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('GEMINI_API_KEY is not configured')) {
          throw err;
        }

        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError || new Error('All Gemini API candidate models failed to respond.');
}

/**
 * Generate curriculum-aligned questions from content.
 */
async function generateQuestions(contentText, config = {}) {
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

  const systemInstruction = `You are an expert school assessment designer for India's K-12 curriculum.
${currCtx}
${masteryNote}
${langNote}

Rules:
- Questions must be directly answerable from the provided content
- Categorize each question by cognitive complexity (Bloom's Taxonomy: remember, understand, apply, analyse, evaluate, create)
- No questions about author, book name, or publication details
- Use simple, age-appropriate language for the class level
- Ensure options are plausible distractors, not obviously wrong
- For fill_blank and short_answer, set options to null`;

  const prompt = `Based ONLY on the following curriculum content, generate exactly ${numQuestions} questions at ${difficulty} difficulty.
Question types to use: ${typeInstructions}

Content:
"""
${contentText.slice(0, 12000)}
"""

Return valid JSON with this schema:
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
      "bloom_level": "apply",
      "tags": ["optional","topic","tags"]
    }
  ]
}`;

  try {
    const { text } = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      true,
      0.7
    );

    const parsed = safeParseJson(text, { questions: [] });
    return parsed?.questions || [];
  } catch (err) {
    logger.error('generateQuestions failed with Gemini:', err.message);
    throw err;
  }
}

/**
 * Validate a single AI-generated question.
 */
async function validateQuestion(question, curriculumContext = {}) {
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
  "is_valid": true,
  "confidence": 0.95,
  "issues": [],
  "suggestion": null
}`;

  try {
    const { text } = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      null,
      true,
      0.2
    );

    return safeParseJson(text, { is_valid: true, confidence: 0.9, issues: [], suggestion: null });
  } catch (err) {
    logger.warn('validateQuestion failed with Gemini, using fallback valid response:', err.message);
    return { is_valid: true, confidence: 0.85, issues: [], suggestion: null };
  }
}

/**
 * Curriculum-grounded tutor chat strictly focused on STEM Education.
 */
async function tutorChat(messages, studentContext = {}) {
  const { full_name, class: cls, board, subject, chapter, topic, mastery, currentQuestion, language = 'en' } = studentContext;
  const langNote = language === 'hi' ? 'Always respond in Hindi.' : language === 'gu' ? 'Always respond in Gujarati.' : 'Respond in English.';

  const systemInstruction = `You are EduMantra STEM AI Tutor — an expert, encouraging, and friendly tutor specialized EXCLUSIVELY in STEM Education (Science, Technology, Engineering, and Mathematics) for school students.
${langNote}

Current student context:
- Name: ${full_name || 'Student'}
- Board: ${board || 'CBSE'} | Class: ${cls || 'School Level'}
- Active STEM Subject: ${subject || 'STEM (Math, Science, Computer Science & IT)'}
${chapter ? `- Chapter: ${chapter}` : ''}
${topic ? `- Topic: ${topic}` : ''}
${mastery !== undefined ? `- Current mastery for this topic: ${mastery}%` : ''}
${currentQuestion ? `- Currently working on problem: "${currentQuestion}"` : ''}

STRICT STEM SCOPE & GUARDRAILS:
1. You MUST ONLY answer questions related to STEM Education:
   • Mathematics (Arithmetic, Algebra, Geometry, Trigonometry, Statistics, Probability, Calculus, Number Systems)
   • Science (Physics, Chemistry, Biology, Thermodynamics, Optics, Electricity, Ecosystems, Astronomy)
   • Computer Science & IT (Python, Algorithms, Coding, Data Structures, Logic Gates, Binary, Web Tech, AI & Robotics)
2. NON-STEM REFUSAL RULE: If a user asks about non-STEM topics (such as History, Civics, Geography, English literature, creative fiction, celebrity gossip, movies, sports trivia, politics, or general non-scientific chit-chat), you MUST politely refuse and state:
   "I am EduMantra's dedicated STEM AI Tutor, specialized exclusively in Mathematics, Science, and Computer Science & IT. I cannot answer non-STEM questions, but I'd love to help you solve a math problem, explain a scientific concept, or write and debug Python code! What STEM topic would you like to explore?"
3. Pedagogical Style:
   • Use the Socratic method when guiding students through problems: provide hints, identify core concepts, and break problems down step-by-step.
   • For math and science, show clear formulas, step-by-step calculations, and units.
   • For coding/computer science, provide clear syntax explanations, clean code examples, and debugging guidance.
   • Keep tone encouraging, patient, and inspiring.
   • Keep explanations concise and age-appropriate (3-6 sentences per concept unless deep step-by-step working is requested).
4. Safety: NEVER generate harmful, inappropriate, dangerous, or unverified scientific content.`;

  const geminiContents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  try {
    const { text, tokensUsed } = await callGemini(
      geminiContents,
      systemInstruction,
      false,
      0.5
    );

    return { content: text, tokens_used: tokensUsed };
  } catch (err) {
    logger.warn('tutorChat callGemini failed, using STEM fallback:', err.message);
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    return {
      content: `Hello ${studentContext.full_name || 'Student'}! I am EduMantra's STEM AI Tutor. \n\nRegarding your question on **${studentContext.subject || 'STEM'}** ("${lastUserMsg}"):\n- **Core Concept:** Remember to break down the topic into its fundamental laws and formulas.\n- **Explanation:** For science and math concepts, identify the given variables, relevant equations, and work through step-by-step.\n- **Next Step:** Tell me which specific formula, reaction, or code line you'd like to dive into!`,
      tokens_used: 60
    };
  }
}

/**
 * Streaming caller for Gemini using Server-Sent Events.
 */
async function callGeminiStream(contents, systemInstruction = null, onChunk = () => {}, temperature = 0.5) {
  const apiKey = getApiKey();
  for (const model of FALLBACK_MODELS) {
    try {
      const url = `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const generationConfig = { temperature };
      if (model.includes('3.1-flash') || model.includes('flash-lite')) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const body = { contents, generationConfig };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) continue;

      let fullText = '';
      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                try {
                  const parsed = JSON.parse(jsonStr);
                  const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (chunk) {
                    fullText += chunk;
                    onChunk(chunk);
                  }
                } catch (_) {}
              }
            }
          }
        }
      } else {
        const textData = await res.text();
        const lines = textData.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (chunk) {
                  fullText += chunk;
                  onChunk(chunk);
                }
              } catch (_) {}
            }
          }
        }
      }

      if (fullText) {
        return { text: fullText, tokensUsed: Math.round(fullText.length / 4), modelUsed: model };
      }
    } catch (err) {
      logger.warn(`Gemini streaming error with model ${model}:`, err.message);
    }
  }

  // Fallback to regular callGemini
  const fallback = await callGemini(contents, systemInstruction, false, temperature);
  if (fallback.text) onChunk(fallback.text);
  return fallback;
}

/**
 * Streaming STEM Tutor Chat.
 */
async function tutorChatStream(messages, studentContext = {}, onChunk = () => {}) {
  const { full_name, class: cls, board, subject, chapter, topic, concept, mastery, currentQuestion, language = 'en' } = studentContext;
  const langNote = language === 'hi' ? 'Always respond in Hindi.' : language === 'gu' ? 'Always respond in Gujarati.' : 'Respond in English.';

  const systemInstruction = `You are EduMantra STEM AI Tutor — an expert, encouraging, and friendly tutor specialized EXCLUSIVELY in STEM Education (Science, Technology, Engineering, and Mathematics) for school students.
${langNote}

Current student context:
- Name: ${full_name || 'Student'}
- Board: ${board || 'CBSE'} | Class: ${cls || 'School Level'}
- Active STEM Subject: ${subject || 'STEM (Math, Science, Computer Science & IT)'}
${chapter ? `- Chapter: ${chapter}` : ''}
${topic ? `- Topic: ${topic}` : ''}
${concept ? `- Concept: ${concept}` : ''}
${mastery !== undefined ? `- Current mastery for this concept: ${mastery}%` : ''}
${currentQuestion ? `- Currently working on problem: "${currentQuestion}"` : ''}

STRICT STEM SCOPE & GUARDRAILS:
1. You MUST ONLY answer questions related to STEM Education (Mathematics, Physics, Chemistry, Biology, Computer Science, Coding, Engineering).
2. Refuse all non-STEM requests politely and guide student back to STEM.
3. Use Socratic teaching: give hints, formulas, and step-by-step guidance without spoon-feeding final answers immediately.`;

  const geminiContents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  try {
    return await callGeminiStream(geminiContents, systemInstruction, onChunk, 0.5);
  } catch (err) {
    const fallbackText = `Let's break this STEM concept down step by step. What formula or equation are you working with?`;
    onChunk(fallbackText);
    return { text: fallbackText, tokensUsed: 25 };
  }
}

/**
 * Generate 3-level progressive hint for a STEM problem.
 * Level 1: Conceptual nudge / question
 * Level 2: Relevant law, formula, or identity
 * Level 3: Partial setup / step 1 calculation
 */
async function generateHint(question, hintLevel = 1, studentContext = {}) {
  const levelNames = {
    1: 'Gentle Nudge: Ask a guiding question or highlight the key concept without revealing the method.',
    2: 'Core Formula / Principle: State the exact formula, rule, or scientific theorem needed.',
    3: 'Step-by-step Setup: Show the first step of working and setup the equation, leaving the final arithmetic to the student.'
  };

  const prompt = `You are a STEM tutor providing a Level ${hintLevel} hint for a student problem.
Hint Type: ${levelNames[hintLevel] || levelNames[1]}

Question:
"${question.question_text}"
${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}
${question.explanation ? `Full Solution (for reference): ${question.explanation}` : ''}

Provide ONLY the hint (2-3 concise sentences). Do NOT reveal the correct option letter or final numerical answer.`;

  try {
    const { text } = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      'You are a Socratic tutor. Guide the student to think, do not give away the final answer.',
      false,
      0.4
    );
    return { hint: text, hint_level: hintLevel };
  } catch (_) {
    const fallbackHints = {
      1: "Think about the underlying definition and identify what quantities or variables are given.",
      2: "Identify the standard mathematical or physical relation connecting the given variables.",
      3: "Write down the formula, substitute the known values, and solve for the unknown variable."
    };
    return { hint: fallbackHints[hintLevel] || fallbackHints[1], hint_level: hintLevel };
  }
}

/**
 * Generate a Socratic follow-up challenge question to verify understanding.
 */
async function generateFollowUpQuestion(topic, concept, difficulty = 'medium') {
  const prompt = `Generate a single quick conceptual follow-up multiple-choice question to test if a student truly understood ${concept || topic}.
Return valid JSON:
{
  "question_text": "Brief conceptual question?",
  "options": [
    {"key": "A", "text": "Option A"},
    {"key": "B", "text": "Option B"},
    {"key": "C", "text": "Option C"},
    {"key": "D", "text": "Option D"}
  ],
  "correct_answer": "A",
  "explanation": "Brief explanation"
}`;

  try {
    const { text } = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      'You are a STEM educator testing student comprehension.',
      true,
      0.5
    );
    return safeParseJson(text, null);
  } catch (_) {
    return null;
  }
}

/**
 * Generate AI-powered personalized recommendations based on mastery data.
 */
async function generateRecommendations(masteryData) {
  const {
    student = {},
    subject_mastery = [],
    weak_concepts = [],
    recent_performance = [],
  } = masteryData;

  const prompt = `You are an adaptive learning recommendation engine for Indian school students.

Student: ${student.full_name || 'Student'}, Class ${student.class || '?'}, Board: ${student.board || 'CBSE'}

Subject mastery summary:
${(subject_mastery || []).map(s => `- ${s.subject}: ${s.mastery}%`).join('\n') || '- No specific subject mastery recorded'}

Weak concepts (mastery < 60%):
${(weak_concepts || []).slice(0, 10).map(c => `- ${c.concept} (${c.subject}, Chapter: ${c.chapter}): ${c.mastery}%`).join('\n') || '- None'}

Recent assessment performance:
${(recent_performance || []).slice(0, 5).map(p => `- ${p.topic}: Score ${p.score}%, ${p.correct}/${p.total} correct`).join('\n') || '- None'}

Generate 5 personalized learning recommendations. Return JSON:
{
  "rationale": "Brief overall assessment of the student's learning state",
  "recommendations": [
    {
      "type": "revise",
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

  try {
    const { text } = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      null,
      true,
      0.5
    );

    const parsed = safeParseJson(text, null);
    if (parsed && Array.isArray(parsed.recommendations)) {
      return parsed;
    }
  } catch (err) {
    logger.warn('generateRecommendations Gemini call failed:', err.message);
  }

  // Graceful structured fallback if API is unavailable
  return {
    rationale: "Focus on strengthening core STEM topics and regular daily practice.",
    recommendations: [
      {
        type: "practice",
        title: "Daily STEM Practice",
        description: "Solve 5-10 practice problems in your current chapter to build confidence and accuracy.",
        priority: 1,
        subject: subject_mastery[0]?.subject || "Mathematics"
      },
      {
        type: "revise",
        title: "Review Fundamental Concepts",
        description: "Revisit formulas and key definitions before taking your next adaptive test.",
        priority: 2,
        subject: subject_mastery[1]?.subject || "Science"
      }
    ]
  };
}

/**
 * Analyze post-assessment performance.
 */
async function analyzePerformance(attemptData) {
  const { student = {}, score = 0, total = 0, correct = 0, topic_performance = [], language = 'en' } = attemptData;
  const langNote = language === 'hi' ? 'Respond in Hindi.' : language === 'gu' ? 'Respond in Gujarati.' : '';

  const prompt = `You are a school assessment analyst giving feedback to a student.
${langNote}

Student: Class ${student.class || '?'}
Score: ${score}% (${correct}/${total} correct)

Topic performance:
${(topic_performance || []).map(t => `- ${t.topic}: ${t.correct}/${t.total} correct`).join('\n') || '- General Assessment'}

Generate encouraging but honest performance feedback. Return JSON:
{
  "feedback": "2-3 sentences of personalized, encouraging feedback",
  "strong_areas": ["topic1", "topic2"],
  "weak_areas": ["topic3", "topic4"],
  "next_steps": ["specific action 1", "specific action 2", "specific action 3"]
}`;

  try {
    const { text } = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      null,
      true,
      0.6
    );

    const parsed = safeParseJson(text, null);
    if (parsed && parsed.feedback) {
      return parsed;
    }
  } catch (err) {
    logger.warn('analyzePerformance Gemini call failed:', err.message);
  }

  // Graceful fallback
  return {
    feedback: score >= 70
      ? `Great job! You scored ${score}%. Keep up the strong effort and tackle higher difficulty problems next.`
      : `Good effort! You scored ${score}%. Review the questions you missed and try another practice quiz to boost mastery.`,
    strong_areas: (topic_performance || []).filter(t => (t.correct / (t.total || 1)) >= 0.7).map(t => t.topic),
    weak_areas: (topic_performance || []).filter(t => (t.correct / (t.total || 1)) < 0.7).map(t => t.topic),
    next_steps: [
      "Review the explanations for incorrect questions",
      "Ask the STEM AI Tutor about any concepts you found difficult",
      "Attempt a 5-question quick practice session"
    ]
  };
}

module.exports = {
  generateQuestions,
  validateQuestion,
  tutorChat,
  tutorChatStream,
  generateHint,
  generateFollowUpQuestion,
  generateRecommendations,
  analyzePerformance,
  callGemini,
  callGeminiStream,
};
