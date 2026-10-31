import express from 'express';
import Memory from '../models/Memory.js';
import MemoryLog from '../models/MemoryLog.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { sampleMemories } from '../seed/demoData.js';
import { ingestMemory } from '../services/memoryEngine.js';

const router = express.Router();

/**
 * POST /api/seed
 * Seed realistic memories and demo conversation
 */
router.post('/', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.body;

    console.log(`[Seed] Seeding sample memories for ${userId}...`);
    let createdCount = 0;

    for (const mem of sampleMemories) {
      await ingestMemory({
        userId,
        content: mem.content,
        category: mem.category,
        confidence: mem.confidence,
        tags: mem.tags,
        isTemporal: mem.isTemporal,
        ttlHours: mem.ttlHours || null,
        sourceSnippet: 'Hackathon Sample Data Seed',
      });
      createdCount++;
    }

    // Create a demo conversation
    const conv = await Conversation.create({
      userId,
      title: 'Trip to Seattle & Coding Preferences',
      messageCount: 2,
    });

    const seattleMem = await Memory.findOne({ userId, content: /Seattle/i });
    const codeMem = await Memory.findOne({ userId, content: /TypeScript/i });

    await Message.create({
      conversationId: conv._id,
      userId,
      role: 'user',
      content: 'Can you recommend good coffee shops near where I stay and a TypeScript template?',
      retrievedMemories: [
        {
          memoryId: seattleMem?._id,
          content: seattleMem?.content || 'User lives in Seattle, WA',
          category: 'personal',
          similarityScore: 0.94,
        },
        {
          memoryId: codeMem?._id,
          content: codeMem?.content || 'User prefers TypeScript',
          category: 'preference',
          similarityScore: 0.91,
        },
      ],
    });

    await Message.create({
      conversationId: conv._id,
      userId,
      role: 'assistant',
      content: 'Since you are in Seattle, I recommend checking out Monorail Espresso in Downtown or Victrola Coffee on Capitol Hill! Also, keeping in mind your preference for concise TypeScript solutions, here is a clean Vite + TS template starter.',
      retrievedMemories: [
        {
          memoryId: seattleMem?._id,
          content: seattleMem?.content || 'User lives in Seattle, WA',
          category: 'personal',
          similarityScore: 0.94,
        },
        {
          memoryId: codeMem?._id,
          content: codeMem?.content || 'User prefers TypeScript',
          category: 'preference',
          similarityScore: 0.91,
        },
      ],
    });

    res.json({
      success: true,
      message: `Successfully seeded ${createdCount} memories and sample conversation!`,
      createdCount,
    });
  } catch (err) {
    console.error('Error seeding data:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/seed/reset
 * Clear all memories, logs, and conversations
 */
router.post('/reset', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.body;

    await Promise.all([
      Memory.deleteMany({ userId }),
      MemoryLog.deleteMany({ userId }),
      Conversation.deleteMany({ userId }),
      Message.deleteMany({ userId }),
    ]);

    res.json({
      success: true,
      message: 'All user data (memories, logs, chats) has been reset successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

