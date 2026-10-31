import Memory from '../models/Memory.js';
import { generateEmbedding } from './geminiService.js';

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
 * Primary: Real MongoDB Atlas $vectorSearch on index "vector_index" (768 dimensions)
 * Fallback: Resilient in-memory cosine similarity and hybrid scoring
 */
export const searchMemories = async ({
  userId = 'default_user',
  queryEmbedding = null,
  queryText = '',
  topK = 5,
  similarityThreshold = 0.50,
  category = null,
}) => {
  const cleanQuery = (queryText || '').toLowerCase().trim();

  // Detect self-referential / user identity inquiries (e.g. "what do you know about me?", "who am I?")
  const isProfileRecall = /(who am i|what do you know about me|tell me about me|my name|about me|do you remember me|what do you remember|my preferences|my details|my background|who i am|what have i told you)/i.test(cleanQuery);

  // 1. Ensure queryEmbedding is available and exactly 768 dimensions
  if ((!queryEmbedding || queryEmbedding.length !== 768) && cleanQuery) {
    try {
      queryEmbedding = await generateEmbedding(queryText);
    } catch (e) {
      console.warn('[Vector Search] Could not generate query embedding via Gemini:', e.message);
    }
  }

  // Guarantee exactly 768 dimensions for Atlas vector index compatibility
  if (queryEmbedding && queryEmbedding.length > 768) {
    queryEmbedding = queryEmbedding.slice(0, 768);
  }

  let atlasError = null;

  // 2. Primary Strategy: Real MongoDB Atlas $vectorSearch using index "vector_index"
  if (queryEmbedding && queryEmbedding.length === 768) {
    try {
      const vectorSearchStage = {
        index: 'vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(topK * 10, 50),
        limit: Math.max(topK * 3, 15),
        filter: {
          $and: [
            { userId: { $eq: userId } },
            { status: { $eq: 'active' } },
          ],
        },
      };

      const pipeline = [
        { $vectorSearch: vectorSearchStage },
      ];

      // If category filter requested, apply in $match stage
      if (category && category !== 'all') {
        pipeline.push({ $match: { category } });
      }

      pipeline.push({
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
      });

      const rawResults = await Memory.aggregate(pipeline);

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        // Exclude expired memories
        const now = new Date();
        const nonExpired = rawResults.filter(r => !r.expiresAt || new Date(r.expiresAt) > now);

        const threshold = isProfileRecall ? 0.35 : Math.min(similarityThreshold, 0.45);
        const filtered = nonExpired.filter(r => (r.score ?? 1) >= threshold);

        if (filtered.length > 0) {
          console.log(`[Vector Search] Real MongoDB Atlas $vectorSearch executed successfully using index "vector_index" (retrieved ${filtered.length} memories, top score: ${filtered[0].score?.toFixed(4)})`);
          return filtered
            .slice(0, topK)
            .map(r => ({
              ...r,
              similarityScore: Number((r.score ?? 1).toFixed(4)),
              vectorScore: Number((r.score ?? 1).toFixed(4)),
              searchMethod: 'atlas_vector_search',
              usedFallback: false,
            }));
        }
      }
    } catch (err) {
      atlasError = err;
      console.warn(`[Vector Search Fallback] Atlas $vectorSearch unavailable on index "vector_index" (${err.message}). Using in-memory cosine fallback.`);
    }
  } else {
    console.warn(`[Vector Search Fallback] Query embedding unavailable or wrong dimension (${queryEmbedding?.length || 0} != 768). Using in-memory fallback.`);
  }

  // 3. Fallback Strategy: In-memory cosine similarity and hybrid scoring
  console.log(`[Vector Search Notice] Executing in-memory fallback (Atlas $vectorSearch ${atlasError ? 'failed: ' + atlasError.message : 'returned 0 matches'}).`);

  const query = {
    userId,
    status: 'active',
  };
  if (category && category !== 'all') query.category = category;

  query.$or = [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } },
  ];

  const activeMemories = await Memory.find(query).lean();
  if (!activeMemories || activeMemories.length === 0) {
    return [];
  }

  const stopWords = new Set(['what', 'which', 'who', 'where', 'when', 'why', 'how', 'the', 'and', 'for', 'are', 'you', 'can', 'about', 'did', 'have', 'tell']);
  const queryWords = cleanQuery.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));

  const scoredMemories = activeMemories.map(mem => {
    let vectorScore = 0;
    if (queryEmbedding && mem.embedding?.length === queryEmbedding.length) {
      vectorScore = computeCosineSimilarity(queryEmbedding, mem.embedding);
    }

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

    let profileBonus = 0;
    if (isProfileRecall) {
      if (['personal', 'work', 'preference', 'goal'].includes(mem.category)) {
        profileBonus = 0.35;
      }
    }

    let finalScore = 0;
    let method = 'cosine_fallback';

    if (vectorScore > 0) {
      finalScore = Math.max(vectorScore, (vectorScore * 0.7) + (keywordScore * 0.3)) + profileBonus;
      method = isProfileRecall ? 'fallback_profile_vector' : 'fallback_cosine_vector';
    } else if (keywordScore > 0) {
      finalScore = keywordScore + profileBonus;
      method = 'fallback_keyword_lexical';
    } else if (isProfileRecall) {
      finalScore = 0.60 + profileBonus;
      method = 'fallback_profile_recall';
    }

    return {
      ...mem,
      vectorScore: Number(vectorScore.toFixed(4)),
      similarityScore: Number(Math.min(finalScore, 1.0).toFixed(4)),
      searchMethod: method,
      usedFallback: true,
    };
  });

  const effectiveThreshold = isProfileRecall ? 0.35 : Math.min(similarityThreshold, 0.45);

  let eligible = scoredMemories
    .filter(mem => mem.similarityScore >= effectiveThreshold)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  if (isProfileRecall && eligible.length === 0) {
    eligible = scoredMemories.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  return eligible.slice(0, topK);
};
