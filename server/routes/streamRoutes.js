import express from 'express';
import { addSSEClient, getConnectedClientsCount } from '../services/sseService.js';

const router = express.Router();

/**
 * GET /api/stream
 * Connect to real-time Server-Sent Events (SSE) stream for MongoDB Change Streams
 */
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/proxies
  res.flushHeaders();

  addSSEClient(res);
});

/**
 * GET /api/stream/status
 */
router.get('/status', (req, res) => {
  res.json({
    activeClients: getConnectedClientsCount(),
    timestamp: new Date().toISOString(),
  });
});

export default router;

