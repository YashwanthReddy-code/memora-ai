import 'dotenv/config';
import dns from 'dns';

// Fallback to Google DNS to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDatabaseStatus } from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';
import memoryRoutes from './routes/memoryRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import streamRoutes from './routes/streamRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import seedRoutes from './routes/seedRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/seed', seedRoutes);

// System Health & Diagnostics endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Memora AI Memory Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus(),
  });
});

// Serve frontend static build if available
const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Memora AI API is running. Build frontend with "npm run build" in client directory to serve UI.');
    }
  });
});

// Bootstrapping
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(`  MEMORA AI Web Application running on port ${PORT}`);
      console.log(`  App URL:      http://localhost:${PORT} or http://127.0.0.1:${PORT}`);
      console.log(`  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`  Live SSE:     http://localhost:${PORT}/api/stream`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
};

startServer();

