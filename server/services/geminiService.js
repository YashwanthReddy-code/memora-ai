import { getGeminiClient } from '../config/gemini.js';

// Deterministic fallback embedding generator (768 dimensions)
const generateFallbackEmbedding = (text) => {
  const embedding = new Array(768).fill(0);
  const clean = text.toLowerCase().trim();
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const index = (code * 31 + i * 17) % 768;
    embedding[index] += Math.sin(code) * 0.1;
  }
  // Normalize vector to unit length
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(val => Number((val / norm).toFixed(6)));
};

/**
 * Generate 768-dimensional vector embedding for a given text
 */
export const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string') return generateFallbackEmbedding('empty');

  const { client, isConfigured } = await getGeminiClient();
  if (!isConfigured || !client) {
    return generateFallbackEmbedding(text);
  }

  try {
    const model = client.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    if (result?.embedding?.values && result.embedding.values.length > 0) {
      return result.embedding.values;
    }
    return generateFallbackEmbedding(text);
  } catch (err) {
    console.warn(`[Gemini Embedding Warning] Falling back to local vector: ${err.message}`);
    return generateFallbackEmbedding(text);
  }
};

/**
 * Extract atomic memories, categories, confidence, and conflict detection from chat turn
 */
export const extractMemoriesFromTurn = async (userMessage, assistantMessage = '', existingActiveMemories = []) => {
  const { client, isConfigured } = await getGeminiClient();

  const existingMemorySummary = existingActiveMemories.map(m => `- [ID: ${m._id}] (${m.category}) ${m.content}`).join('\n');

  if (!isConfigured || !client) {
    // Intelligent heuristic extraction fallback when Gemini API key is pending
    return heuristicExtraction(userMessage, existingActiveMemories);
  }

  const prompt = `You are the Agentic Memory Extractor for Memora AI.
Analyze the following conversation turn between a User and an Assistant.
Identify any factual, personal, preference, constraint, goal, temporal, or corrective information about the user that should be remembered for future sessions.

Active Existing Memories about the user:
${existingMemorySummary || 'None recorded yet.'}

Current User Message: "${userMessage}"
Current Assistant Response: "${assistantMessage}"

RULES:
1. Extract only meaningful, enduring, or explicitly stated facts/preferences/constraints/goals/temporary contexts.
2. DO NOT extract greetings, generic questions, pleasantries, or ephemeral conversational remarks like "hi", "how are you", "thanks".
3. Check against Active Existing Memories:
   - If the new statement contradicts or updates an existing memory (e.g., "I moved to Seattle" contradicts "I live in New York"), mark "isContradiction": true, specify "conflictsWithId" with that memory's ID, and explain "conflictReason".
4. Categories allowed: "personal", "preference", "work", "constraint", "goal", "temporal", "correction".
5. Temporal memories: If it represents a temporary state (e.g., "visiting Tokyo until next Tuesday", "meeting at 3pm"), mark "isTemporal": true and specify "ttlHours" (e.g., 24, 72, 168). For permanent memories, set "ttlHours": null.
6. Return a valid JSON array only. No markdown formatting, no other text.

JSON Schema:
[
  {
    "content": "Statement in third person (e.g. 'User lives in Seattle, WA')",
    "category": "personal | preference | work | constraint | goal | temporal | correction",
    "confidence": 0.85 to 1.0,
    "tags": ["tag1", "tag2"],
    "isTemporal": false,
    "ttlHours": null,
    "isContradiction": false,
    "conflictsWithId": null,
    "conflictReason": null
  }
]`;

  try {
    const model = client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const response = await model.generateContent(prompt);
    const rawText = response.response.text();
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[Gemini Extraction Warning]: ${err.message}. Falling back to heuristic extraction.`);
    return heuristicExtraction(userMessage, existingActiveMemories);
  }
};

/**
 * Heuristic fallback extraction if API key is not yet set
 */
const heuristicExtraction = (text, existingMemories = []) => {
  const extracted = [];
  const lower = text.toLowerCase();

  // Pattern detection
  const patterns = [
    { regex: /i (?:live|reside) in ([a-zA-Z\s,]+)/i, category: 'personal', template: loc => `User lives in ${loc.trim()}`, tags: ['location'] },
    { regex: /i (?:am|work as) an? ([a-zA-Z\s]+(?:developer|engineer|designer|manager|student|doctor|lawyer|teacher))/i, category: 'work', template: role => `User works as ${role.trim()}`, tags: ['career', 'role'] },
    { regex: /i (?:prefer|love|like|enjoy) ([a-zA-Z\s0-9]+)/i, category: 'preference', template: item => `User prefers ${item.trim()}`, tags: ['preference'] },
    { regex: /i (?:am allergic to|can't eat|cannot eat) ([a-zA-Z\s]+)/i, category: 'constraint', template: item => `User is allergic to ${item.trim()}`, tags: ['allergy', 'dietary', 'health'] },
    { regex: /my name is ([a-zA-Z]+)/i, category: 'personal', template: name => `User's name is ${name.trim()}`, tags: ['identity', 'name'] },
    { regex: /my goal is (?:to )?([a-zA-Z\s0-9]+)/i, category: 'goal', template: goal => `User's goal is to ${goal.trim()}`, tags: ['goal'] },
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match && match[1]) {
      const content = p.template(match[1].replace(/[.!?].*$/, ''));
      
      // Check for simple conflict
      let conflictsWithId = null;
      let isContradiction = false;
      let conflictReason = null;

      for (const em of existingMemories) {
        if (em.category === p.category && em.tags.some(t => p.tags.includes(t))) {
          isContradiction = true;
          conflictsWithId = em._id;
          conflictReason = `Updated previous ${p.category} memory: "${em.content}"`;
          break;
        }
      }

      extracted.push({
        content,
        category: p.category,
        confidence: 0.92,
        tags: p.tags,
        isTemporal: false,
        ttlHours: null,
        isContradiction,
        conflictsWithId,
        conflictReason,
      });
    }
  }

  return extracted;
};

/**
 * Generate personalized assistant response with retrieved memory context
 */
export const generatePersonalizedResponse = async (
  userMessage,
  retrievedMemories = [],
  conversationHistory = [],
  systemPersona = ''
) => {
  const { client, isConfigured } = await getGeminiClient();

  const memoryContext = retrievedMemories.length > 0
    ? `\nRELEVANT USER MEMORIES (Use these to personalize your response naturally):\n` +
      retrievedMemories.map((m, i) => `[Memory #${i + 1}] (${m.category}): ${m.content}`).join('\n') +
      `\n\nGUIDELINE: Subtly weave relevant memories into your response when helpful. Be genuine, helpful, and natural.`
    : `\nNo prior memories retrieved for this specific query.`;

  const personaPrompt = systemPersona ||
    `You are Memora AI, an intelligent agent with persistent memory. You naturally recall relevant past details, preferences, and facts about the user.`;

  if (!isConfigured || !client) {
    // Fallback response with memory awareness indicator
    const memoryMentions = retrievedMemories.map(m => m.content).join('; ');
    return {
      text: `Hello! I received your message: "${userMessage}". ` +
            (retrievedMemories.length > 0
              ? `I also recalled some facts about you: [${memoryMentions}]. (Note: Gemini API key not configured yet; operating in offline memory-aware simulation mode).`
              : `I'm ready to learn more about you! You can configure your Gemini API Key in the Settings page anytime.`),
      usedOfflineSimulation: true,
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `${personaPrompt}\n${memoryContext}`,
    });

    // Format chat history
    const history = conversationHistory.slice(-8).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return {
      text: response.text().trim(),
      usedOfflineSimulation: false,
    };
  } catch (err) {
    console.error('[Gemini Generation Error]:', err.message);
    return {
      text: `I had trouble connecting to the Gemini model (${err.message}). However, I successfully recorded and indexed your message and memories in MongoDB!`,
      error: err.message,
    };
  }
};

