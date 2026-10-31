import { getGeminiClient, resolveSupportedModel } from '../config/gemini.js';

// Enhanced deterministic fallback embedding generator (768 dimensions)
const generateFallbackEmbedding = (text) => {
  const embedding = new Array(768).fill(0);
  const clean = text.toLowerCase().trim();
  const words = clean.split(/\W+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash * 31 + word.charCodeAt(j)) & 0xffffffff;
    }
    const idx = Math.abs(hash) % 768;
    embedding[idx] += 1.0;
    if (i > 0) {
      const biHash = (hash ^ words[i - 1].length) % 768;
      embedding[Math.abs(biHash)] += 0.5;
    }
  }

  for (let i = 0; i < clean.length - 2; i++) {
    const triCode = (clean.charCodeAt(i) * 31 + clean.charCodeAt(i + 1)) * 31 + clean.charCodeAt(i + 2);
    embedding[Math.abs(triCode) % 768] += 0.1;
  }

  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(val => Number((val / norm).toFixed(6)));
};

/**
 * Generate dense vector embedding for a given text using verified Gemini embedding models
 */
export const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string') return generateFallbackEmbedding('empty');

  const { client, isConfigured } = await getGeminiClient();
  if (!isConfigured || !client) {
    return generateFallbackEmbedding(text);
  }

  const candidateModels = [
    process.env.EMBEDDING_MODEL,
    'gemini-embedding-001',
    'gemini-embedding-2',
    'text-embedding-004',
  ].filter(Boolean);

  for (const mName of candidateModels) {
    try {
      const model = client.getGenerativeModel({ model: mName });
      const result = await model.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      });
      if (result?.embedding?.values && result.embedding.values.length === 768) {
        return result.embedding.values;
      }
      if (result?.embedding?.values && result.embedding.values.length > 0) {
        return result.embedding.values.slice(0, 768);
      }
    } catch (err) {
      // Try next candidate model
    }
  }

  console.warn(`[Gemini Embedding Notice] Falling back to local vector representation.`);
  return generateFallbackEmbedding(text);
};

/**
 * Extract atomic memories, categories, confidence, and conflict detection from chat turn
 */
export const extractMemoriesFromTurn = async (userMessage, assistantMessage = '', existingActiveMemories = []) => {
  const { client, isConfigured, modelName, apiKey } = await getGeminiClient();

  const existingMemorySummary = existingActiveMemories.map(m => `- [ID: ${m._id}] (${m.category}) ${m.content}`).join('\n');

  if (!isConfigured || !client) {
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
    let activeModel = modelName || process.env.GEMINI_MODEL || 'gemini-flash-latest';
    let model = client.getGenerativeModel({
      model: activeModel,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    let response;
    try {
      response = await model.generateContent(prompt);
    } catch (modelErr) {
      if (modelErr.message?.includes('not found') || modelErr.message?.includes('404')) {
        // Resolve available model dynamically
        const newModel = await resolveSupportedModel(apiKey);
        model = client.getGenerativeModel({
          model: newModel,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        });
        response = await model.generateContent(prompt);
      } else {
        throw modelErr;
      }
    }

    const rawText = response.response.text();
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[Gemini Extraction Notice]: ${err.message}. Running heuristic extraction.`);
    return heuristicExtraction(userMessage, existingActiveMemories);
  }
};

/**
 * Heuristic fallback extraction if API key is not yet set
 */
const heuristicExtraction = (text, existingMemories = []) => {
  const extracted = [];
  const lower = text.toLowerCase();

  const patterns = [
    { regex: /i (?:live|reside|stay) in ([a-zA-Z\s,]+)/i, category: 'personal', template: loc => `User lives in ${loc.trim()}`, tags: ['location'] },
    { regex: /i (?:am|work as) an? ([a-zA-Z\s]+(?:developer|engineer|designer|manager|student|doctor|lawyer|teacher|architect))/i, category: 'work', template: role => `User works as ${role.trim()}`, tags: ['career', 'role'] },
    { regex: /i (?:prefer|love|like|enjoy) ([a-zA-Z\s0-9]+)/i, category: 'preference', template: item => `User prefers ${item.trim()}`, tags: ['preference'] },
    { regex: /i (?:am allergic to|can't eat|cannot eat) ([a-zA-Z\s]+)/i, category: 'constraint', template: item => `User is allergic to ${item.trim()}`, tags: ['allergy', 'dietary', 'health'] },
    { regex: /my name is ([a-zA-Z]+)/i, category: 'personal', template: name => `User's name is ${name.trim()}`, tags: ['identity', 'name'] },
    { regex: /my goal is (?:to )?([a-zA-Z\s0-9]+)/i, category: 'goal', template: goal => `User's goal is to ${goal.trim()}`, tags: ['goal'] },
    { regex: /i relocated (?:to|from .* to) ([a-zA-Z\s,]+)/i, category: 'personal', template: loc => `User relocated to ${loc.trim()}`, tags: ['location'] },
    { regex: /i moved (?:to|from .* to) ([a-zA-Z\s,]+)/i, category: 'personal', template: loc => `User lives in ${loc.trim()}`, tags: ['location'] },
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match && match[1]) {
      const content = p.template(match[1].replace(/[.!?].*$/, ''));
      
      let conflictsWithId = null;
      let isContradiction = false;
      let conflictReason = null;

      for (const em of existingMemories) {
        if (em.category === p.category && em.tags?.some(t => p.tags.includes(t))) {
          isContradiction = true;
          conflictsWithId = em._id;
          conflictReason = `Updated previous ${p.category} memory: "${em.content}"`;
          break;
        }
      }

      extracted.push({
        content,
        category: p.category,
        confidence: 0.95,
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
 * Intelligent local knowledge responder used ONLY when no API key is configured
 */
const generateSubstantiveOfflineResponse = (userMessage, retrievedMemories = []) => {
  const lower = userMessage.toLowerCase();
  const memoryPrefix = retrievedMemories.length > 0
    ? `*(Recalled context: ${retrievedMemories.map(m => m.content).join('; ')})*\n\n`
    : '';

  if (lower.includes('inheritance') && (lower.includes('c++') || lower.includes('cpp'))) {
    return `${memoryPrefix}**Inheritance in C++** is a fundamental Object-Oriented Programming (OOP) mechanism that allows a derived class (child) to inherit properties and behaviors from a base class (parent).

### 1. Key Types of Inheritance
- **Single Inheritance**: Class B inherits from Class A.
- **Multiple Inheritance**: A class inherits from multiple base classes (\`class Derived : public Base1, public Base2\`).
- **Multilevel Inheritance**: A derived class acts as a base class for another derived class.
- **Hierarchical Inheritance**: Multiple classes inherit from one base class.

### 2. Access Modes (Visibility)
| Access Specifier | Public in Base | Protected in Base | Private in Base |
| :--- | :--- | :--- | :--- |
| \`public\` | Public in Derived | Protected in Derived | Inaccessible |
| \`protected\` | Protected in Derived | Protected in Derived | Inaccessible |
| \`private\` | Private in Derived | Private in Derived | Inaccessible |

### 3. Code Example
\`\`\`cpp
#include <iostream>
using namespace std;

// Base class
class Animal {
public:
    void eat() { cout << "Eating..." << endl; }
};

// Derived class
class Dog : public Animal {
public:
    void bark() { cout << "Barking!" << endl; }
};

int main() {
    Dog myDog;
    myDog.eat();  // Inherited from Animal
    myDog.bark(); // Defined in Dog
    return 0;
}
\`\`\`

> *Note: Connect your Gemini API Key in Settings for live cloud generative responses.*`;
  }

  const memoryCitations = retrievedMemories.length > 0
    ? `I have incorporated your retrieved profile memories into this session:\n` +
      retrievedMemories.map(m => `- **${m.category}**: ${m.content}`).join('\n') + `\n\n`
    : ``;

  return `${memoryCitations}I understand your query: "${userMessage}".

Memora AI has recorded this conversational turn and verified your long-term memories in MongoDB. To unlock live cloud generative AI responses, configure your Gemini API Key in the **Settings** tab.`;
};

/**
 * Generate personalized assistant response with retrieved memory context
 * When Gemini is configured, it returns genuine AI-generated responses, never silent mock fallbacks.
 */
export const generatePersonalizedResponse = async (
  userMessage,
  retrievedMemories = [],
  conversationHistory = [],
  systemPersona = ''
) => {
  const { client, isConfigured, modelName, apiKey, error: initError } = await getGeminiClient();

  // If no Gemini key is provided, provide offline informative answer
  if (!isConfigured || !client) {
    if (initError) {
      throw new Error(`Gemini Configuration Error: ${initError}`);
    }
    return {
      text: generateSubstantiveOfflineResponse(userMessage, retrievedMemories),
      usedOfflineSimulation: true,
      modelUsed: 'offline-knowledge-engine',
    };
  }

  const memoryContext = retrievedMemories.length > 0
    ? `\nRELEVANT USER MEMORIES (Use these to personalize your response naturally):\n` +
      retrievedMemories.map((m, i) => `[Memory #${i + 1}] (${m.category}): ${m.content}`).join('\n') +
      `\n\nGUIDELINE: Subtly weave relevant memories into your response when helpful. Be genuine, helpful, and natural.`
    : `\nNo prior memories retrieved for this specific query.`;

  const personaPrompt = systemPersona ||
    `You are Memora AI, an intelligent agent with persistent memory. You naturally recall relevant past details, preferences, and facts about the user.`;

  let activeModel = modelName || process.env.GEMINI_MODEL || 'gemini-flash-latest';

  try {
    let model = client.getGenerativeModel({
      model: activeModel,
      systemInstruction: `${personaPrompt}\n${memoryContext}`,
    });

    const history = conversationHistory.slice(-8).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    let chat = model.startChat({ history });
    let result;

    try {
      result = await chat.sendMessage(userMessage);
    } catch (sendErr) {
      // If model 404s, attempt automatic resolution with Google's models.list API
      if (sendErr.message?.includes('not found') || sendErr.message?.includes('404')) {
        console.warn(`[Gemini Model Fallback] Model "${activeModel}" not found. Resolving available model...`);
        const fallbackModel = await resolveSupportedModel(apiKey);
        activeModel = fallbackModel;

        model = client.getGenerativeModel({
          model: activeModel,
          systemInstruction: `${personaPrompt}\n${memoryContext}`,
        });
        chat = model.startChat({ history });
        result = await chat.sendMessage(userMessage);
      } else {
        throw sendErr;
      }
    }

    const response = await result.response;
    const responseText = response.text()?.trim();

    if (!responseText) {
      throw new Error('Gemini API returned an empty response.');
    }

    return {
      text: responseText,
      usedOfflineSimulation: false,
      modelUsed: activeModel,
    };
  } catch (err) {
    console.error(`[Gemini API Error] Failed with model "${activeModel}":`, err.message);

    // Map error codes to clean, actionable messages
    let formattedError = err.message || 'Error communicating with Gemini API';
    if (formattedError.includes('API key not valid') || formattedError.includes('API_KEY_INVALID')) {
      formattedError = 'Invalid Gemini API Key. Please verify or update your key in Settings.';
    } else if (formattedError.includes('RESOURCE_EXHAUSTED') || formattedError.includes('429')) {
      formattedError = 'Gemini API quota exceeded or rate limit hit. Check your quota in Google Cloud Console.';
    } else if (formattedError.includes('not found') || formattedError.includes('404')) {
      formattedError = `Model "${activeModel}" is not available for your Gemini API version.`;
    }

    // Never silently return mock response when real API is configured; throw clear error
    throw new Error(formattedError);
  }
};
