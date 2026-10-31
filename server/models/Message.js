import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      default: 'default_user',
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    retrievedMemories: [
      {
        memoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory' },
        content: String,
        category: String,
        similarityScore: Number,
      },
    ],
    extractedMemories: [
      {
        memoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory' },
        content: String,
        category: String,
        confidence: Number,
        action: String, // 'created' | 'superseded'
      },
    ],
    conflictsResolved: [
      {
        oldMemoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory' },
        oldContent: String,
        newContent: String,
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;

