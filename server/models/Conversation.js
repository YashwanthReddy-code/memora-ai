import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: 'default_user',
      index: true,
    },
    title: {
      type: String,
      default: 'New Conversation',
    },
    summary: {
      type: String,
      default: '',
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;

