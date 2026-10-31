import express from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { processChatTurn } from '../services/memoryEngine.js';

const router = express.Router();

/**
 * POST /api/chat
 * Primary agentic chat endpoint:
 * Retrieves relevant memories, generates personalized response, extracts new memories, resolves conflicts.
 */
router.post('/', async (req, res) => {
  try {
    const { message, conversationId, userId = 'default_user' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const result = await processChatTurn({
      userId,
      conversationId,
      messageText: message.trim(),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: err.message || 'Internal server error processing chat turn' });
  }
});

/**
 * GET /api/chat/conversations
 * Retrieve all conversations for user
 */
router.get('/conversations', async (req, res) => {
  try {
    const { userId = 'default_user' } = req.query;
    const conversations = await Conversation.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Retrieve messages for a specific conversation
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation and its messages
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    await Message.deleteMany({ conversationId: req.params.id });
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

