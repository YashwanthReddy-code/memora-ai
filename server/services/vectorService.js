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
 * Supports MongoDB Atlas $vectorSearch with seamless cosine similarity fallback
 */
export const searchMemories = async ({
  userId = 'default_user',
  queryEmbedding,
  queryText = '',
  topK = 5,
  similarityThreshold = 0.65,
  category = null,
}) => {
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
        console.log(`[Vector Search] Atlas $vectorSearch returned ${results.length} memories`);
        return results
          .filter(r => (r.score ?? 1) >= similarityThreshold)
          .slice(0, topK)
          .map(r => ({ ...r, similarityScore: Number((r.score ?? 1).toFixed(4)), searchMethod: 'atlas_vector_search' }));
      }
    } catch (atlasErr) {
      // Atlas $vectorSearch will throw if index 'vector_index' is not built yet or if on standalone/replica set.
      // This is expected and handled gracefully by Strategy 2!
      console.log(`[Vector Search] Falling back to cosine similarity pipeline (${atlasErr.message.slice(0, 80)}...)`);
    }
  }

  // Strategy 2: Resilient In-Database Cosine Similarity Fallback
  const query = {
    userId,
    status: 'active',
  };
  if (category) query.category = category;

  // Check TTL: filter out already expired memories if MongoDB TTL runner has not cleaned yet
  query.$or = [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } },
  ];

  const activeMemories = await Memory.find(query).lean();

  if (!activeMemories || activeMemories.length === 0) {
    return [];
  }

  if (queryEmbedding && queryEmbedding.length > 0) {
    const scoredMemories = activeMemories
      .map(mem => {
        const similarity = mem.embedding?.length > 0
          ? computeCosineSimilarity(queryEmbedding, mem.embedding)
          : 0;
        return {
          ...mem,
          similarityScore: Number(similarity.toFixed(4)),
          searchMethod: 'cosine_fallback',
        };
      })
      .filter(mem => mem.similarityScore >= similarityThreshold)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);

    return scoredMemories;
  }

  // Strategy 3: Text / Keyword Fallback if no embedding is available
  if (queryText) {
    const lower = queryText.toLowerCase();
    const scored = activeMemories
      .map(mem => {
        let score = 0;
        const cLower = mem.content.toLowerCase();
        if (cLower.includes(lower)) score += 0.8;
        if (mem.tags?.some(t => lower.includes(t.toLowerCase()))) score += 0.5;
        return {
          ...mem,
          similarityScore: Number(Math.min(score, 1).toFixed(4)),
          searchMethod: 'keyword_fallback',
        };
      })
      .filter(m => m.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);

    return scored;
  }

  return activeMemories.slice(0, topK).map(m => ({ ...m, similarityScore: 0.8, searchMethod: 'recent_fallback' }));
};

