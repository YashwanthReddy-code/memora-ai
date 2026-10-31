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
 * Actively probes candidates to ensure zero 404 errors at runtime
 */
export const resolveSupportedModel = async (apiKey, requestedModel = null) => {
  const cleanKey = apiKey.trim();

  // If already cached for this key and model, return cached model
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

  const genAI = cachedGenAI && cachedKey === cleanKey ? cachedGenAI : new GoogleGenerativeAI(cleanKey);

  // Priority candidate order for generation
  const candidatePreferences = [
    requestedModel,
    process.env.GEMINI_MODEL,
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-pro-latest',
    'gemini-2.5-pro',
    ...available.map(m => m.name),
  ].filter(Boolean).map(sanitizeModelName);

  const uniqueCandidates = [...new Set(candidatePreferences)];

  let workingModel = null;
  let lastError = null;

  for (const candidate of uniqueCandidates) {
    // Only test if candidate is in the available models returned by Google
    const isAvailable = available.some(m => m.name.toLowerCase() === candidate.toLowerCase());
    if (!isAvailable) continue;

    try {
      const model = genAI.getGenerativeModel({ model: candidate });
      const result = await model.generateContent('ping');
      await result.response;
      workingModel = candidate;
      console.log(`[Gemini Model Resolver] Successfully verified model: "${candidate}"`);
      break;
    } catch (candErr) {
      lastError = candErr;
      const msg = candErr.message || '';
      console.warn(`[Gemini Model Resolver] Candidate "${candidate}" generation test failed: ${msg.slice(0, 100)}`);
      if (candErr.code === 'API_KEY_INVALID' || msg.includes('API key not valid')) {
        throw candErr;
      }
    }
  }

  if (!workingModel) {
    throw lastError || new Error('No available model responded to generateContent.');
  }

  cachedKey = cleanKey;
  cachedGenAI = genAI;
  cachedVerifiedModel = workingModel;
  return workingModel;
};

/**
 * Get active Gemini client, active API key, and verified model
 */
export const getGeminiClient = async () => {
  let apiKey = process.env.GEMINI_API_KEY?.trim();
  let requestedModel = process.env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';

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

    // 2. Resolve working model by active ping verification
    const pref = requestedModel || process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const verifiedModel = await resolveSupportedModel(cleanKey, pref);

    return {
      success: true,
      message: `Gemini API verified successfully using model "${verifiedModel}".`,
      verifiedModel,
      availableModelsCount: availableModels.length,
      availableModels: availableModels.slice(0, 15).map(m => m.name),
    };
  } catch (err) {
    console.error('[Gemini Connection Test Error]:', err);
    let userFriendlyMsg = err.message || 'Failed to authenticate with Gemini API';

    if (err.code === 'API_KEY_INVALID' || userFriendlyMsg.includes('API key not valid')) {
      userFriendlyMsg = 'Invalid Gemini API Key. Please verify your key in Google AI Studio.';
    } else if (err.code === 'QUOTA_EXCEEDED' || userFriendlyMsg.includes('quota') || userFriendlyMsg.includes('429')) {
      userFriendlyMsg = 'Gemini API quota or rate limit exceeded. Check your plan in Google Cloud Console.';
    } else if (userFriendlyMsg.includes('is not found') || userFriendlyMsg.includes('404')) {
      userFriendlyMsg = `Model was not found for this API version. Verified models available on your project: ${cachedAvailableModels?.map(m => m.name).slice(0, 5).join(', ') || 'none'}`;
    }

    return {
      success: false,
      message: userFriendlyMsg,
      code: err.code || 'ERROR',
    };
  }
};
