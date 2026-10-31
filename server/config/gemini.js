import { GoogleGenerativeAI } from '@google/generative-ai';
import Setting from '../models/Setting.js';

let cachedGenAI = null;
let cachedKey = null;

export const resetGeminiCache = () => {
  cachedGenAI = null;
  cachedKey = null;
};

export const getGeminiClient = async () => {
  let apiKey = process.env.GEMINI_API_KEY?.trim();
  let modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

  try {
    const dbSetting = await Setting.findOne({ userId: 'default_user' });
    if (dbSetting?.geminiApiKey?.trim()) {
      apiKey = dbSetting.geminiApiKey.trim();
    }
    if (dbSetting?.geminiModel?.trim()) {
      modelName = dbSetting.geminiModel.trim();
    }
  } catch (err) {
    // If DB is not yet ready, use env
  }

  if (!apiKey) {
    return { client: null, apiKey: null, modelName, isConfigured: false };
  }

  if (cachedGenAI && cachedKey === apiKey) {
    return { client: cachedGenAI, apiKey, modelName, isConfigured: true };
  }

  cachedKey = apiKey;
  cachedGenAI = new GoogleGenerativeAI(apiKey);
  return { client: cachedGenAI, apiKey, modelName, isConfigured: true };
};

export const testGeminiConnection = async (testKey) => {
  const key = testKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return { success: false, message: 'No Gemini API Key provided.' };
  }
  try {
    const genAI = new GoogleGenerativeAI(key.trim());
    // Try gemini-1.5-flash as the standard probe
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('ping');
    const response = await result.response;
    return {
      success: true,
      message: 'Gemini API connection verified successfully.',
      preview: response.text().trim(),
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Failed to authenticate with Gemini API',
    };
  }
};
