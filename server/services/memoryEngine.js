import Memory from '../models/Memory.js';
import MemoryLog from '../models/MemoryLog.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Setting from '../models/Setting.js';
import { generateEmbedding, extractMemoriesFromTurn, generatePersonalizedResponse } from './geminiService.js';
import { searchMemories } from './vectorService.js';
import { broadcastChange } from './sseService.js';

/**
 * Ingest a single memory, check for conflicts or corrections, and persist to MongoDB
 */
export const ingestMemory = async ({
  userId = 'default_user',
  content,
  category = 'personal',
  confidence = 0.9,
  tags = [],
  isTemporal = false,
  ttlHours = null,
  sourceMessageId = null,
  sourceSnippet = null,
  conflictsWithId = null,
  conflictReason = null,
}) => {
  if (!content || typeof content !== 'string') {
    throw new Error('Memory content is required');
  }

  // 1. Generate 768-dimensional embedding
  const embedding = await generateEmbedding(content);

  // 2. Conflict & Correction Detection
  let resolvedConflict = null;
  let targetConflictMemory = null;

  if (conflictsWithId) {
    targetConflictMemory = await Memory.findOne({ _id: conflictsWithId, userId, status: 'active' });
  }

  // If not explicitly provided, check semantic contradiction against existing active memories
  if (!targetConflictMemory) {
    const candidates = await searchMemories({
      userId,
      queryEmbedding: embedding,
      topK: 3,
      similarityThreshold: 0.82,
      category,
    });

    if (candidates.length > 0) {
      // Check if there is an exact or near duplicate, or high-similarity replacement
      const topMatch = candidates[0];
      if (topMatch.similarityScore > 0.88 && topMatch.content.toLowerCase() !== content.toLowerCase()) {
        targetConflictMemory = await Memory.findById(topMatch._id);
        conflictReason = conflictReason || `Replaced existing ${category} context: "${topMatch.content}"`;
      }
    }
  }

  // Calculate TTL expiration
  let expiresAt = null;
  if (isTemporal || (ttlHours && ttlHours > 0)) {
    const hours = ttlHours || 24;
    expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  }

  // 3. Create the new memory document
  const newMemory = new Memory({
    userId,
    content: content.trim(),
    category,
    confidence: Math.min(Math.max(confidence, 0.5), 1.0),
    embedding,
    tags: Array.isArray(tags) ? tags : [],
    status: 'active',
    sourceMessageId,
    sourceSnippet,
    expiresAt,
    isTemporal: Boolean(isTemporal || expiresAt),
  });

  await newMemory.save();

  // 4. If conflicting memory exists, supersede it
  if (targetConflictMemory) {
    targetConflictMemory.status = 'superseded';
    targetConflictMemory.supersededBy = newMemory._id;
    targetConflictMemory.conflictNotes = conflictReason || `Superseded by memory #${newMemory._id}`;
    await targetConflictMemory.save();

    // Log the conflict resolution
    await MemoryLog.create({
      memoryId: targetConflictMemory._id,
      userId,
      action: 'SUPERSEDED',
      contentSnapshot: targetConflictMemory.content,
      previousContent: targetConflictMemory.content,
      category: targetConflictMemory.category,
      reason: conflictReason || 'Superseded by newer information',
      supersededById: newMemory._id,
      metadata: { newMemoryId: newMemory._id, newContent: newMemory.content },
    });

    resolvedConflict = {
      oldMemoryId: targetConflictMemory._id,
      oldContent: targetConflictMemory.content,
      newMemoryId: newMemory._id,
      newContent: newMemory.content,
      reason: conflictReason || 'Information updated/corrected',
    };

    console.log(`[Memory Engine] Conflict resolved: #${targetConflictMemory._id} superseded by #${newMemory._id}`);
  }

  // 5. Create audit log for creation
  await MemoryLog.create({
    memoryId: newMemory._id,
    userId,
    action: 'CREATED',
    contentSnapshot: newMemory.content,
    category: newMemory.category,
    reason: targetConflictMemory ? 'Created to replace superseded memory' : 'Extracted from conversation turn',
    metadata: {
      confidence: newMemory.confidence,
      tags: newMemory.tags,
      expiresAt: newMemory.expiresAt,
      isTemporal: newMemory.isTemporal,
    },
  });

  return {
    memory: newMemory,
    resolvedConflict,
  };
};

/**
 * Full turn pipeline: Search memories -> Generate response -> Extract new facts -> Handle conflicts -> Persist
 */
export const processChatTurn = async ({
  userId = 'default_user',
  conversationId = null,
  messageText,
}) => {
  if (!messageText || !messageText.trim()) {
    throw new Error('Message text cannot be empty');
  }

  // 1. Fetch user settings
  const setting = await Setting.findOne({ userId }) || {
    topK: 5,
    similarityThreshold: 0.65,
    systemPersona: 'You are Memora AI, an intelligent agent with persistent memory.',
    autoExtract: true,
  };

  // 2. Ensure conversation exists
  let conversation;
  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, userId });
  }
  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      title: messageText.slice(0, 35) + (messageText.length > 35 ? '...' : ''),
      summary: '',
      messageCount: 0,
    });
  }

  // 3. Generate embedding for user query
  const queryEmbedding = await generateEmbedding(messageText);

  // 4. Retrieve relevant active memories
  const retrievedMemories = await searchMemories({
    userId,
    queryEmbedding,
    queryText: messageText,
    topK: setting.topK || 5,
    similarityThreshold: setting.similarityThreshold || 0.65,
  });

  // Track retrieval in DB and log
  if (retrievedMemories.length > 0) {
    const memoryIds = retrievedMemories.map(m => m._id);
    await Memory.updateMany(
      { _id: { $in: memoryIds } },
      { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } }
    );

    for (const mem of retrievedMemories) {
      await MemoryLog.create({
        memoryId: mem._id,
        userId,
        action: 'RETRIEVED',
        contentSnapshot: mem.content,
        category: mem.category,
        reason: `Retrieved for message: "${messageText.slice(0, 50)}"`,
        metadata: { similarityScore: mem.similarityScore, searchMethod: mem.searchMethod },
      });
    }
  }

  // 5. Fetch recent chat history
  const history = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  history.reverse();

  // 6. Generate personalized assistant response
  const aiResult = await generatePersonalizedResponse(
    messageText,
    retrievedMemories,
    history,
    setting.systemPersona
  );

  // 7. Save User Message
  const userMessageDoc = await Message.create({
    conversationId: conversation._id,
    userId,
    role: 'user',
    content: messageText,
    retrievedMemories: retrievedMemories.map(m => ({
      memoryId: m._id,
      content: m.content,
      category: m.category,
      similarityScore: m.similarityScore,
    })),
  });

  // 8. Extract memories from this turn
  const extractedList = [];
  const conflictsResolved = [];

  if (setting.autoExtract !== false) {
    const activeExisting = await Memory.find({ userId, status: 'active' })
      .select('_id content category tags')
      .lean();

    const rawExtracted = await extractMemoriesFromTurn(messageText, aiResult.text, activeExisting);

    for (const item of rawExtracted) {
      if (!item.content) continue;
      try {
        const { memory, resolvedConflict } = await ingestMemory({
          userId,
          content: item.content,
          category: item.category || 'personal',
          confidence: item.confidence || 0.9,
          tags: item.tags || [],
          isTemporal: item.isTemporal || false,
          ttlHours: item.ttlHours || null,
          sourceMessageId: userMessageDoc._id,
          sourceSnippet: messageText,
          conflictsWithId: item.conflictsWithId || null,
          conflictReason: item.conflictReason || null,
        });

        extractedList.push({
          memoryId: memory._id,
          content: memory.content,
          category: memory.category,
          confidence: memory.confidence,
          action: resolvedConflict ? 'superseded' : 'created',
        });

        if (resolvedConflict) {
          conflictsResolved.push(resolvedConflict);
        }
      } catch (err) {
        console.error('[Memory Ingestion Error]:', err.message);
      }
    }
  }

  // 9. Save Assistant Message with citations & extraction metadata
  const assistantMessageDoc = await Message.create({
    conversationId: conversation._id,
    userId,
    role: 'assistant',
    content: aiResult.text,
    retrievedMemories: retrievedMemories.map(m => ({
      memoryId: m._id,
      content: m.content,
      category: m.category,
      similarityScore: m.similarityScore,
    })),
    extractedMemories: extractedList,
    conflictsResolved,
  });

  // 10. Update conversation stats
  conversation.messageCount += 2;
  conversation.updatedAt = new Date();
  await conversation.save();

  return {
    conversationId: conversation._id,
    userMessage: userMessageDoc,
    assistantMessage: assistantMessageDoc,
    retrievedMemories,
    extractedMemories: extractedList,
    conflictsResolved,
  };
};

