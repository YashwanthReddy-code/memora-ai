import { GoogleGenerativeAI } from '@google/generative-ai';
import Setting from '../models/Setting.js';

let cachedGenAI = null;
let cachedKey = null;
let cachedVerifiedModel = null;
let cachedAvailableModels = null;

export const resetGeminiCache = () => {
  cachedGenAI = null;
  cachedKey = null;
  cachedVerifiedModel = null;
  cachedAvailableModels = null;
};

/**
 * Clean and standardize model name (strip any leading "models/")
 */
export const sanitizeModelName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/^models\//, '');
};

/**
 * Query Google's models.list API to get all models available for the provided API key
 * that support generateContent
 */
export const fetchAvailableModels = async (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('API key is required to query available models.');
  }

  const cleanKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (netErr) {
    throw new Error(`Network error connecting to Google Gemini API: ${netErr.message}`);
  }

  const data = await response.json();

  if (!response.ok) {
    const errorStatus = data?.error?.status || `HTTP_${response.status}`;
    const rawMessage = data?.error?.message || 'Failed to list models';

    if (errorStatus === 'INVALID_ARGUMENT' || rawMessage.toLowerCase().includes('api key not valid')) {
      const err = new Error('Invalid Gemini API Key. Please verify your API key in Google AI Studio.');
      err.code = 'API_KEY_INVALID';
      throw err;
    }

    if (errorStatus === 'RESOURCE_EXHAUSTED' || response.status === 429) {
      const err = new Error('Gemini API quota or rate limit exceeded. Please check your account limits in Google Cloud Console.');
      err.code = 'QUOTA_EXCEEDED';
      throw err;
    }

    if (errorStatus === 'PERMISSION_DENIED') {
      const err = new Error(`Permission denied: ${rawMessage}`);
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    const err = new Error(`Gemini API Error (${errorStatus}): ${rawMessage}`);
    err.code = errorStatus;
    throw err;
  }

  const models = data?.models || [];
  const contentModels = models
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => ({
      name: sanitizeModelName(m.name),
      displayName: m.displayName || m.name,
      description: m.description,
      supportedMethods: m.supportedGenerationMethods,
    }));

  return contentModels;
};

/**
 * Resolve a verified, working model identifier that supports generateContent
 */
export const resolveSupportedModel = async (apiKey, requestedModel = null) => {
  const cleanKey = apiKey.trim();

  // If already cached for this key, return cached model
  if (cachedKey === cleanKey && cachedVerifiedModel && (!requestedModel || requestedModel === cachedVerifiedModel)) {
    return cachedVerifiedModel;
  }

  let available = cachedAvailableModels;
  if (!available || cachedKey !== cleanKey) {
    available = await fetchAvailableModels(cleanKey);
    cachedAvailableModels = available;
  }

  if (available.length === 0) {
    throw new Error('No models supporting generateContent are available for this API key/project.');
  }

  const availableNames = available.map(m => m.name.toLowerCase());

  // Priority candidates to test if requested model is unavailable
  const candidatePreferences = [
    requestedModel,
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
  ].filter(Boolean).map(sanitizeModelName);

  for (const candidate of candidatePreferences) {
    const candidateLower = candidate.toLowerCase();
    const match = available.find(m => m.name.toLowerCase() === candidateLower);
    if (match) {
      cachedVerifiedModel = match.name;
      return match.name;
    }
  }

  // Fallback to first available model that supports generateContent
  const fallback = available[0].name;
  cachedVerifiedModel = fallback;
  return fallback;
};

/**
 * Get active Gemini client, active API key, and verified model
 */
export const getGeminiClient = async () => {
  let apiKey = process.env.GEMINI_API_KEY?.trim();
  let requestedModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  try {
    const dbSetting = await Setting.findOne({ userId: 'default_user' });
    if (dbSetting?.geminiApiKey?.trim()) {
      apiKey = dbSetting.geminiApiKey.trim();
    }
    if (dbSetting?.geminiModel?.trim()) {
      requestedModel = dbSetting.geminiModel.trim();
    }
  } catch (err) {
    // If DB is offline, continue with process.env
  }

  if (!apiKey) {
    return { client: null, apiKey: null, modelName: requestedModel, isConfigured: false };
  }

  if (cachedGenAI && cachedKey === apiKey && cachedVerifiedModel) {
    return { client: cachedGenAI, apiKey, modelName: cachedVerifiedModel, isConfigured: true };
  }

  try {
    const verifiedModel = await resolveSupportedModel(apiKey, requestedModel);
    cachedKey = apiKey;
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    cachedVerifiedModel = verifiedModel;

    return { client: cachedGenAI, apiKey, modelName: verifiedModel, isConfigured: true };
  } catch (err) {
    console.error('[Gemini Init Error]:', err.message);
    return { client: null, apiKey, modelName: requestedModel, isConfigured: false, error: err.message };
  }
};

/**
 * Test a Gemini API key connection, query available models, and run a test generation
 */
export const testGeminiConnection = async (testKey, requestedModel = null) => {
  let key = testKey || process.env.GEMINI_API_KEY;

  if (!key) {
    try {
      const dbSetting = await Setting.findOne({ userId: 'default_user' });
      if (dbSetting?.geminiApiKey?.trim()) {
        key = dbSetting.geminiApiKey.trim();
      }
    } catch (e) {}
  }

  if (!key || !key.trim()) {
    return { success: false, message: 'No Gemini API Key provided.' };
  }

  const cleanKey = key.trim();

  try {
    // 1. Fetch live models supporting generateContent from Google's API
    const availableModels = await fetchAvailableModels(cleanKey);

    if (availableModels.length === 0) {
      return {
        success: false,
        message: 'Your API key is valid, but no models supporting generateContent were found for your project.',
      };
    }

    // 2. Resolve the best model
    const pref = requestedModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const verifiedModel = await resolveSupportedModel(cleanKey, pref);

    // 3. Test generation with the verified model
    const genAI = new GoogleGenerativeAI(cleanKey);
    const model = genAI.getGenerativeModel({ model: verifiedModel });
    const result = await model.generateContent('ping');
    const response = await result.response;
    const text = response.text()?.trim() || 'OK';

    // Update in-memory cache
    cachedKey = cleanKey;
    cachedGenAI = genAI;
    cachedVerifiedModel = verifiedModel;
    cachedAvailableModels = availableModels;

    return {
      success: true,
      message: `Gemini API verified successfully using model "${verifiedModel}".`,
      verifiedModel,
      preview: text,
      availableModelsCount: availableModels.length,
      availableModels: availableModels.slice(0, 10).map(m => m.name),
    };
  } catch (err) {
    let userFriendlyMsg = err.message || 'Failed to authenticate with Gemini API';

    if (err.code === 'API_KEY_INVALID' || userFriendlyMsg.includes('API key not valid')) {
      userFriendlyMsg = 'Invalid Gemini API Key. Please verify your key in Google AI Studio.';
    } else if (err.code === 'QUOTA_EXCEEDED' || userFriendlyMsg.includes('quota') || userFriendlyMsg.includes('429')) {
      userFriendlyMsg = 'Gemini API quota or rate limit exceeded. Check your plan in Google Cloud Console.';
    } else if (userFriendlyMsg.includes('is not found') || userFriendlyMsg.includes('404')) {
      userFriendlyMsg = `Model is not available for this API version. Verified models: ${cachedAvailableModels?.map(m => m.name).join(', ') || 'none'}`;
    }

    return {
      success: false,
      message: userFriendlyMsg,
      code: err.code || 'ERROR',
    };
  }
};
