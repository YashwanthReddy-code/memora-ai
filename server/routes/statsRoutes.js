import express from 'express';
import Memory from '../models/Memory.js';
import MemoryLog from '../models/MemoryLog.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { getDatabaseStatus } from '../config/db.js';
import { getGeminiClient } from '../config/gemini.js';

const router = express.Router();

/**
 * GET /api/stats
 * Comprehensive metrics and health for Dashboard
 */
router.get('/', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.query;

    const [
      totalMemories,
      activeMemories,
      supersededMemories,
      expiredMemories,
      totalConversations,
      totalMessages,
      categoryStats,
      conflictResolutions,
      mostAccessed,
      recentActivity,
    ] = await Promise.all([
      Memory.countDocuments({ userId }),
      Memory.countDocuments({ userId, status: 'active' }),
      Memory.countDocuments({ userId, status: 'superseded' }),
      Memory.countDocuments({ userId, status: 'expired' }),
      Conversation.countDocuments({ userId }),
      Message.countDocuments({ userId }),
      Memory.aggregate([
        { $match: { userId } },
        { $group: { _id: '$category', count: { $sum: 1 }, activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
      ]),
      MemoryLog.countDocuments({ userId, action: 'SUPERSEDED' }),
      Memory.find({ userId, status: 'active' })
        .sort({ accessCount: -1 })
        .limit(5)
        .select('content category accessCount lastAccessedAt createdAt')
        .lean(),
      MemoryLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(8)
        .lean(),
    ]);

    const dbStatus = getDatabaseStatus();
    const { isConfigured, apiKey, modelName } = await getGeminiClient();

    res.json({
      overview: {
        totalMemories,
        activeMemories,
        supersededMemories,
        expiredMemories,
        totalConversations,
        totalMessages,
        conflictResolutions,
      },
      categories: categoryStats.map(c => ({
        category: c._id,
        total: c.count,
        active: c.activeCount,
      })),
      mostAccessed,
      recentActivity,
      systemHealth: {
        database: dbStatus,
        gemini: {
          configured: isConfigured,
          maskedKey: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : null,
          model: modelName || process.env.GEMINI_MODEL || 'gemini-flash-latest',
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

