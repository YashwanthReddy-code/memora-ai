import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: 'default_user',
      unique: true,
    },
    geminiApiKey: {
      type: String,
      default: '',
    },
    geminiModel: {
      type: String,
      default: 'gemini-2.5-flash',
    },
    embeddingModel: {
      type: String,
      default: 'text-embedding-004',
    },
    similarityThreshold: {
      type: Number,
      default: 0.65,
      min: 0,
      max: 1,
    },
    topK: {
      type: Number,
      default: 5,
      min: 1,
      max: 20,
    },
    defaultTtlHours: {
      type: Number,
      default: 0, // 0 = permanent
    },
    autoExtract: {
      type: Boolean,
      default: true,
    },
    systemPersona: {
      type: String,
      default: 'You are Memora AI, an intelligent companion with dynamic, persistent agentic memory. You recall facts, preferences, constraints, and past context naturally.',
    },
  },
  {
    timestamps: true,
  }
);

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;

