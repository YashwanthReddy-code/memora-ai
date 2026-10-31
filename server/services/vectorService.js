import Memory from '../models/Memory.js';

// Cosine similarity computation between two vectors
const computeCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Perform semantic search for relevant memories
 * Supports MongoDB Atlas $vectorSearch with hybrid lexical, profile-recall, and cosine similarity fallback
 */
export const searchMemories = async ({
  userId = 'default_user',
  queryEmbedding,
  queryText = '',
  topK = 5,
  similarityThreshold = 0.50,
  category = null,
}) => {
  const cleanQuery = (queryText || '').toLowerCase().trim();

  // Detect self-referential / user identity inquiries (e.g. "what do you know about me?", "who am I?")
  const isProfileRecall = /(who am i|what do you know about me|tell me about me|my name|about me|do you remember me|what do you remember|my preferences|my details|my background|who i am|what have i told you)/i.test(cleanQuery);

  // Strategy 1: Attempt MongoDB Atlas $vectorSearch Aggregation Pipeline
  if (queryEmbedding && queryEmbedding.length > 0) {
    try {
      const vectorSearchStage = {
        index: 'vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(topK * 10, 50),
        limit: topK * 2,
      };

      const filterCriteria = {
        userId,
        status: 'active',
      };
      if (category) filterCriteria.category = category;
      vectorSearchStage.filter = filterCriteria;

      const pipeline = [
        { $vectorSearch: vectorSearchStage },
        {
          $project: {
            _id: 1,
            userId: 1,
            content: 1,
            category: 1,
            confidence: 1,
            tags: 1,
            status: 1,
            expiresAt: 1,
            accessCount: 1,
            lastAccessedAt: 1,
            createdAt: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const results = await Memory.aggregate(pipeline);
      if (results && results.length > 0) {
        const threshold = isProfileRecall ? 0.35 : similarityThreshold;
        const filtered = results.filter(r => (r.score ?? 1) >= threshold);
        if (filtered.length > 0) {
          console.log(`[Vector Search] Atlas $vectorSearch returned ${filtered.length} memories`);
          return filtered
            .slice(0, topK)
            .map(r => ({ ...r, similarityScore: Number((r.score ?? 1).toFixed(4)), searchMethod: 'atlas_vector_search' }));
        }
      }
    } catch (atlasErr) {
      // Atlas $vectorSearch falls back smoothly to Hybrid in-memory search
    }
  }

  // Strategy 2: Resilient In-Database Hybrid Semantic + Lexical Search
  const query = {
    userId,
    status: 'active',
  };
  if (category) query.category = category;

  // Check TTL: filter out already expired memories
  query.$or = [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } },
  ];

  const activeMemories = await Memory.find(query).lean();

  if (!activeMemories || activeMemories.length === 0) {
    return [];
  }

  // Extract query keywords (ignoring short stopwords)
  const stopWords = new Set(['what', 'which', 'who', 'where', 'when', 'why', 'how', 'the', 'and', 'for', 'are', 'you', 'can', 'about', 'did', 'have', 'tell']);
  const queryWords = cleanQuery.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));

  const scoredMemories = activeMemories.map(mem => {
    // 1. Vector similarity score
    let vectorScore = 0;
    if (queryEmbedding && mem.embedding?.length === queryEmbedding.length) {
      vectorScore = computeCosineSimilarity(queryEmbedding, mem.embedding);
    }

    // 2. Lexical / Keyword overlap score
    let keywordScore = 0;
    if (queryWords.length > 0) {
      const cLower = mem.content.toLowerCase();
      const tagsLower = (mem.tags || []).join(' ').toLowerCase();

      for (const word of queryWords) {
        if (cLower.includes(word)) keywordScore += 0.35;
        if (tagsLower.includes(word)) keywordScore += 0.25;
      }
      keywordScore = Math.min(keywordScore, 1.0);
    }

    // 3. Profile relevance bonus for self-referential queries
    let profileBonus = 0;
    if (isProfileRecall) {
      if (['personal', 'work', 'preference', 'goal'].includes(mem.category)) {
        profileBonus = 0.35;
      }
    }

    // 4. Combined final score
    let finalScore = 0;
    let method = 'cosine_fallback';

    if (vectorScore > 0) {
      finalScore = Math.max(vectorScore, (vectorScore * 0.7) + (keywordScore * 0.3)) + profileBonus;
      method = isProfileRecall ? 'hybrid_profile_vector' : 'hybrid_vector';
    } else if (keywordScore > 0) {
      finalScore = keywordScore + profileBonus;
      method = 'keyword_lexical';
    } else if (isProfileRecall) {
      finalScore = 0.60 + profileBonus;
      method = 'profile_recall_fallback';
    }

    return {
      ...mem,
      vectorScore: Number(vectorScore.toFixed(4)),
      similarityScore: Number(Math.min(finalScore, 1.0).toFixed(4)),
      searchMethod: method,
    };
  });

  // Effective cutoff threshold
  const effectiveThreshold = isProfileRecall ? 0.35 : Math.min(similarityThreshold, 0.45);

  let eligible = scoredMemories
    .filter(mem => mem.similarityScore >= effectiveThreshold)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  // If profile recall requested and nothing passed threshold, return top active profile memories
  if (isProfileRecall && eligible.length === 0) {
    eligible = scoredMemories
      .sort((a, b) => b.similarityScore - a.similarityScore);
  }

  return eligible.slice(0, topK);
};

