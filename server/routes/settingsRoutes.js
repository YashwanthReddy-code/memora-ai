import express from 'express';
import Setting from '../models/Setting.js';
import { testGeminiConnection, resetGeminiCache } from '../config/gemini.js';
import { testMongoConnection, switchDatabaseConnection, getDatabaseStatus } from '../config/db.js';
import { updateEnvVariables } from '../utils/envHelper.js';

const router = express.Router();

const maskString = (str) => {
  if (!str || typeof str !== 'string') return '';
  const clean = str.trim();
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
};

const maskMongoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  // Hide password in mongodb+srv://username:password@cluster...
  return uri.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1$2:••••••••@');
};

/**
 * GET /api/settings
 */
router.get('/', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.query;
    let setting = await Setting.findOne({ userId });

    const envApiKey = process.env.GEMINI_API_KEY?.trim() || '';
    const envMongoUri = process.env.MONGODB_URI?.trim() || '';

    if (!setting) {
      setting = await Setting.create({
        userId,
        geminiApiKey: envApiKey,
        geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
        similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.65,
        topK: parseInt(process.env.TOP_K_MEMORIES) || 5,
        defaultTtlHours: parseInt(process.env.DEFAULT_TTL_HOURS) || 0,
      });
    }

    const effectiveApiKey = setting.geminiApiKey || envApiKey;
    const effectiveMongoUri = envMongoUri;

    res.json({
      userId: setting.userId,
      geminiApiKeyMasked: maskString(effectiveApiKey),
      hasGeminiApiKey: Boolean(effectiveApiKey),
      mongodbUriMasked: maskMongoUri(effectiveMongoUri),
      hasMongodbUri: Boolean(effectiveMongoUri),
      databaseStatus: getDatabaseStatus(),
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
 * Saves to DB and persists variables to server/.env so settings survive restarts!
 */
router.put('/', async (req, res) => {
  try {
    const { userId = 'default_user', ...updates } = req.body;

    let setting = await Setting.findOne({ userId });
    if (!setting) {
      setting = new Setting({ userId });
    }

    const envUpdates = {};

    // 1. Gemini API Key
    if (updates.geminiApiKey !== undefined && updates.geminiApiKey.trim() !== '') {
      setting.geminiApiKey = updates.geminiApiKey.trim();
      envUpdates.GEMINI_API_KEY = updates.geminiApiKey.trim();
      resetGeminiCache();
    }

    // 2. MongoDB URI
    let dbSwitchResult = null;
    if (updates.mongodbUri !== undefined && updates.mongodbUri.trim() !== '') {
      const cleanUri = updates.mongodbUri.trim();
      dbSwitchResult = await switchDatabaseConnection(cleanUri);
      envUpdates.MONGODB_URI = cleanUri;
    }

    // 3. Other Settings
    if (updates.geminiModel) {
      setting.geminiModel = updates.geminiModel;
      envUpdates.GEMINI_MODEL = updates.geminiModel;
    }
    if (updates.embeddingModel) setting.embeddingModel = updates.embeddingModel;
    if (updates.similarityThreshold !== undefined) {
      setting.similarityThreshold = parseFloat(updates.similarityThreshold);
      envUpdates.SIMILARITY_THRESHOLD = updates.similarityThreshold;
    }
    if (updates.topK !== undefined) {
      setting.topK = parseInt(updates.topK);
      envUpdates.TOP_K_MEMORIES = updates.topK;
    }
    if (updates.defaultTtlHours !== undefined) {
      setting.defaultTtlHours = parseInt(updates.defaultTtlHours);
      envUpdates.DEFAULT_TTL_HOURS = updates.defaultTtlHours;
    }
    if (updates.autoExtract !== undefined) setting.autoExtract = Boolean(updates.autoExtract);
    if (updates.systemPersona !== undefined) setting.systemPersona = updates.systemPersona;

    await setting.save();

    // Persist to server/.env
    if (Object.keys(envUpdates).length > 0) {
      await updateEnvVariables(envUpdates);
    }

    res.json({
      success: true,
      message: 'Settings saved and persisted successfully!',
      databaseSwitched: Boolean(dbSwitchResult),
      databaseStatus: getDatabaseStatus(),
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
    console.error('[Settings PUT Error]:', err);
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

/**
 * POST /api/settings/test-mongodb
 */
router.post('/test-mongodb', async (req, res) => {
  try {
    const { uri } = req.body;
    const result = await testMongoConnection(uri);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
