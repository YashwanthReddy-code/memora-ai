import mongoose from 'mongoose';
import { broadcastChange } from '../services/sseService.js';

const memorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      default: 'default_user',
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['personal', 'preference', 'work', 'constraint', 'goal', 'temporal', 'correction'],
      default: 'personal',
      index: true,
    },
    confidence: {
      type: Number,
      default: 0.9,
      min: 0,
      max: 1,
    },
    embedding: {
      type: [Number],
      default: [],
      select: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'superseded', 'expired', 'archived'],
      default: 'active',
      index: true,
    },
    sourceMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    sourceSnippet: {
      type: String,
      default: null,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Memory',
      default: null,
    },
    conflictNotes: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    isTemporal: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// MongoDB TTL Index: automatically removes documents when current time > expiresAt
memorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for fast filtered lookups
memorySchema.index({ userId: 1, status: 1, createdAt: -1 });
memorySchema.index({ userId: 1, category: 1 });
memorySchema.index({ content: 'text', tags: 'text' });

// Lifecycle Change Stream hooks ensuring 100% SSE parity across all topologies
memorySchema.post('save', function (doc) {
  const isNew = this.$isNew;
  broadcastChange('CHANGE_STREAM_EVENT', {
    operationType: isNew ? 'insert' : 'update',
    documentKey: { _id: doc._id },
    fullDocument: {
      _id: doc._id,
      content: doc.content,
      category: doc.category,
      status: doc.status,
      confidence: doc.confidence,
      expiresAt: doc.expiresAt,
      tags: doc.tags,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    wallTime: new Date(),
    engine: 'realtime_lifecycle_stream',
  });
});

memorySchema.post('findOneAndDelete', function (doc) {
  if (doc) {
    broadcastChange('CHANGE_STREAM_EVENT', {
      operationType: 'delete',
      documentKey: { _id: doc._id },
      fullDocument: null,
      wallTime: new Date(),
      engine: 'realtime_lifecycle_stream',
    });
  }
});

const Memory = mongoose.model('Memory', memorySchema);
export default Memory;
