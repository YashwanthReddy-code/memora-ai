import express from 'express';
import Setting from '../models/Setting.js';
import { testGeminiConnection } from '../config/gemini.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/settings
 */
router.get('/', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.query;
    let setting = await Setting.findOne({ userId });

    if (!setting) {
      setting = await Setting.create({
        userId,
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
        similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.65,
        topK: parseInt(process.env.TOP_K_MEMORIES) || 5,
      });
    }

    res.json({
      userId: setting.userId,
      geminiApiKeyMasked: setting.geminiApiKey ? `${setting.geminiApiKey.slice(0, 6)}...${setting.geminiApiKey.slice(-4)}` : '',
      hasGeminiApiKey: Boolean(setting.geminiApiKey || process.env.GEMINI_API_KEY),
      geminiModel: setting.geminiModel,
      embeddingModel: setting.embeddingModel,
      similarityThreshold: setting.similarityThreshold,
      topK: setting.topK,
      defaultTtlHours: setting.defaultTtlHours,
      autoExtract: setting.autoExtract,
      systemPersona: setting.systemPersona,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/settings
 */
router.put('/', async (req, res) => {
  try {
    const { userId = 'default_user', ...updates } = req.body;

    let setting = await Setting.findOne({ userId });
    if (!setting) {
      setting = new Setting({ userId });
    }

    if (updates.geminiApiKey !== undefined) {
      setting.geminiApiKey = updates.geminiApiKey.trim();
    }
    if (updates.geminiModel) setting.geminiModel = updates.geminiModel;
    if (updates.embeddingModel) setting.embeddingModel = updates.embeddingModel;
    if (updates.similarityThreshold !== undefined) setting.similarityThreshold = parseFloat(updates.similarityThreshold);
    if (updates.topK !== undefined) setting.topK = parseInt(updates.topK);
    if (updates.defaultTtlHours !== undefined) setting.defaultTtlHours = parseInt(updates.defaultTtlHours);
    if (updates.autoExtract !== undefined) setting.autoExtract = Boolean(updates.autoExtract);
    if (updates.systemPersona !== undefined) setting.systemPersona = updates.systemPersona;

    await setting.save();

    res.json({
      success: true,
      message: 'Settings saved successfully',
      setting: {
        userId: setting.userId,
        hasGeminiApiKey: Boolean(setting.geminiApiKey || process.env.GEMINI_API_KEY),
        geminiModel: setting.geminiModel,
        embeddingModel: setting.embeddingModel,
        similarityThreshold: setting.similarityThreshold,
        topK: setting.topK,
        defaultTtlHours: setting.defaultTtlHours,
        autoExtract: setting.autoExtract,
        systemPersona: setting.systemPersona,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/test-gemini
 */
router.post('/test-gemini', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const result = await testGeminiConnection(apiKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

