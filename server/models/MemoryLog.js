import mongoose from 'mongoose';

const memoryLogSchema = new mongoose.Schema(
  {
    memoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Memory',
      required: false,
      index: true,
    },
    userId: {
      type: String,
      default: 'default_user',
      index: true,
    },
    action: {
      type: String,
      enum: ['CREATED', 'UPDATED', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'RETRIEVED', 'CONFLICT_DETECTED'],
      required: true,
      index: true,
    },
    contentSnapshot: {
      type: String,
      default: null,
    },
    previousContent: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    supersededById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Memory',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

memoryLogSchema.index({ timestamp: -1 });

const MemoryLog = mongoose.model('MemoryLog', memoryLogSchema);
export default MemoryLog;

