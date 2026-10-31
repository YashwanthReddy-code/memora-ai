import express from 'express';
import MemoryLog from '../models/MemoryLog.js';

const router = express.Router();

/**
 * GET /api/history
 * Fetch audit logs of memory lifecycle events
 */
router.get('/', async (req, res) => {
  try {
    const {
      userId = 'default_user',
      action,
      memoryId,
      limit = 50,
      page = 1,
    } = req.query;

    const query = { userId };

    if (action && action !== 'all' && action !== 'undefined' && action !== 'null') {
      query.action = action;
    }

    if (memoryId && memoryId !== 'undefined' && memoryId !== 'null') {
      query.memoryId = memoryId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      MemoryLog.find(query)
        .populate('memoryId', 'content category status')
        .populate('supersededById', 'content category status')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MemoryLog.countDocuments(query),
    ]);

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/history/clear
 * Clear audit logs for user
 */
router.delete('/clear', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.query;
    await MemoryLog.deleteMany({ userId });
    res.json({ success: true, message: 'Memory audit history cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

