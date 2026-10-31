import express from 'express';
import Memory from '../models/Memory.js';
import MemoryLog from '../models/MemoryLog.js';
import { ingestMemory } from '../services/memoryEngine.js';
import { generateEmbedding } from '../services/geminiService.js';
import { searchMemories } from '../services/vectorService.js';

const router = express.Router();

/**
 * GET /api/memories
 * List memories with filtering, search, and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      userId = 'default_user',
      category,
      status = 'active',
      search,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { userId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { content: searchRegex },
        { tags: searchRegex },
        { category: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [memories, total] = await Promise.all([
      Memory.find(query)
        .populate('supersededBy', 'content category createdAt')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Memory.countDocuments(query),
    ]);

    res.json({
      memories,
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
 * POST /api/memories
 * Manually create a new memory
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId = 'default_user',
      content,
      category = 'personal',
      confidence = 1.0,
      tags = [],
      ttlHours = null,
      isTemporal = false,
    } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const { memory, resolvedConflict } = await ingestMemory({
      userId,
      content: content.trim(),
      category,
      confidence: parseFloat(confidence) || 1.0,
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [],
      ttlHours: ttlHours ? parseInt(ttlHours) : null,
      isTemporal: Boolean(isTemporal || ttlHours),
      sourceSnippet: 'Manual Creation by User',
    });

    res.status(201).json({
      success: true,
      memory,
      resolvedConflict,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/memories/:id
 * Retrieve memory details including lineage
 */
router.get('/:id', async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('supersededBy', 'content category createdAt status')
      .populate('sourceMessageId', 'content role createdAt');

    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    // Retrieve full audit logs for this memory
    const logs = await MemoryLog.find({ memoryId: memory._id }).sort({ timestamp: -1 }).lean();

    res.json({
      memory,
      logs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/memories/:id
 * Update/edit a memory
 */
router.put('/:id', async (req, res) => {
  try {
    const { content, category, status, confidence, tags, ttlHours, resetExpiration } = req.body;

    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    const previousContent = memory.content;
    const isContentChanged = content && content.trim() !== memory.content;

    if (content) memory.content = content.trim();
    if (category) memory.category = category;
    if (status) memory.status = status;
    if (confidence !== undefined) memory.confidence = parseFloat(confidence);
    if (tags !== undefined) memory.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());

    // Update TTL if requested
    if (ttlHours !== undefined) {
      if (parseInt(ttlHours) > 0) {
        memory.expiresAt = new Date(Date.now() + parseInt(ttlHours) * 3600 * 1000);
        memory.isTemporal = true;
      } else {
        memory.expiresAt = null;
        memory.isTemporal = false;
      }
    } else if (resetExpiration) {
      memory.expiresAt = null;
      memory.isTemporal = false;
    }

    // Re-generate embedding if content changed
    if (isContentChanged) {
      memory.embedding = await generateEmbedding(memory.content);
    }

    await memory.save();

    // Log the update event
    await MemoryLog.create({
      memoryId: memory._id,
      userId: memory.userId,
      action: 'UPDATED',
      contentSnapshot: memory.content,
      previousContent,
      category: memory.category,
      reason: 'User manual edit in dashboard',
      metadata: { isContentChanged, updatedFields: Object.keys(req.body) },
    });

    res.json({ success: true, memory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a memory (with audit log entry)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { permanent = false } = req.query;
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    // Record audit log before deletion
    await MemoryLog.create({
      memoryId: memory._id,
      userId: memory.userId,
      action: 'DELETED',
      contentSnapshot: memory.content,
      category: memory.category,
      reason: permanent === 'true' ? 'Permanent hard delete by user' : 'Soft delete / archived by user',
      metadata: { permanent },
    });

    if (permanent === 'true') {
      await Memory.findByIdAndDelete(req.params.id);
    } else {
      memory.status = 'archived';
      await memory.save();
    }

    res.json({ success: true, message: 'Memory deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/memories/search
 * Semantic Vector Search playground / test query
 */
router.post('/search', async (req, res) => {
  try {
    const { query, topK = 5, similarityThreshold = 0.5, category, userId = 'default_user' } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const queryEmbedding = await generateEmbedding(query.trim());

    const results = await searchMemories({
      userId,
      queryEmbedding,
      queryText: query.trim(),
      topK: parseInt(topK) || 5,
      similarityThreshold: parseFloat(similarityThreshold) || 0.5,
      category: category && category !== 'all' ? category : null,
    });

    res.json({
      query,
      resultsCount: results.length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

