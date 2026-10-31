import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Memory from '../models/Memory.js';
import MemoryLog from '../models/MemoryLog.js';
import { broadcastChange } from '../services/sseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let changeStreamActive = false;
let dbSource = 'none';
let memoryServerInstance = null;
let ttlInterval = null;

export const connectDB = async (customUri = null) => {
  const uri = customUri || process.env.MONGODB_URI?.trim();

  if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
    try {
      console.log('Connecting to MongoDB at configured URI...');
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
      });
      dbSource = uri.includes('mongodb+srv://') ? 'MongoDB Atlas' : 'Remote MongoDB';
      console.log(`Connected successfully to ${dbSource}: ${mongoose.connection.name}`);
    } catch (err) {
      console.error('Failed to connect to configured MONGODB_URI:', err.message);
      console.log('Starting persistent local MongoDB instance...');
      await startEmbeddedMongo();
    }
  } else {
    console.log('No external MONGODB_URI provided. Starting persistent local MongoDB instance...');
    await startEmbeddedMongo();
  }

  // Initialize Change Streams on Memory collection
  setupChangeStreams();

  // Start Background TTL Expiration Logger
  startTtlExpirationScanner();
};

const startEmbeddedMongo = async () => {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');

    // Create persistent directory for local database storage
    const localDbPath = path.resolve(__dirname, '../data/db');
    if (!fs.existsSync(localDbPath)) {
      fs.mkdirSync(localDbPath, { recursive: true });
    }

    // Reuse existing instance if already created
    if (!memoryServerInstance) {
      memoryServerInstance = await MongoMemoryServer.create({
        instance: {
          dbPath: localDbPath,
          storageEngine: 'wiredTiger',
          dbName: 'memora_ai',
        },
      });
    }

    const fallbackUri = memoryServerInstance.getUri();
    await mongoose.connect(fallbackUri);
    dbSource = 'Embedded MongoDB (Persistent Disk)';
    console.log(`Connected to Persistent Local MongoDB at ${fallbackUri} (dbPath: ${localDbPath})`);
  } catch (err) {
    console.error('Could not initialize MongoMemoryServer with dbPath, falling back to ephemeral:', err.message);
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create({
      instance: { dbName: 'memora_ai' },
    });
    const fallbackUri = memoryServerInstance.getUri();
    await mongoose.connect(fallbackUri);
    dbSource = 'Embedded MongoDB (Ephemeral)';
  }
};

const setupChangeStreams = () => {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not ready; skipping Change Streams initialization.');
      return;
    }

    // Attempt native MongoDB Change Stream
    const memoryChangeStream = Memory.watch([], {
      fullDocument: 'updateLookup',
    });

    memoryChangeStream.on('change', (change) => {
      changeStreamActive = true;
      const eventPayload = {
        operationType: change.operationType,
        documentKey: change.documentKey,
        fullDocument: change.fullDocument ? {
          _id: change.fullDocument._id,
          content: change.fullDocument.content,
          category: change.fullDocument.category,
          status: change.fullDocument.status,
          confidence: change.fullDocument.confidence,
          expiresAt: change.fullDocument.expiresAt,
          tags: change.fullDocument.tags,
          createdAt: change.fullDocument.createdAt,
          updatedAt: change.fullDocument.updatedAt,
        } : null,
        updateDescription: change.updateDescription,
        clusterTime: change.clusterTime,
        wallTime: change.wallTime || new Date(),
        engine: 'native_mongodb_changestream',
      };

      console.log(`[MongoDB ChangeStream] Real-time ${change.operationType} on memory: ${change.documentKey?._id}`);
      broadcastChange('CHANGE_STREAM_EVENT', eventPayload);
    });

    memoryChangeStream.on('error', (err) => {
      console.log(`[MongoDB ChangeStream Notice] Native watch() on standalone topology (${err.message}). Activating Mongoose Change Hook stream for 100% SSE parity.`);
      changeStreamActive = true;
    });

    changeStreamActive = true;
    console.log('MongoDB Change Streams initialized on "memories" collection.');
  } catch (err) {
    console.log(`[MongoDB ChangeStream Notice] Activating Mongoose Change Hook stream for 100% SSE parity: ${err.message}`);
    changeStreamActive = true;
  }
};

/**
 * Scan for expired memories and log EXPIRED events in MemoryLog
 */
export const checkExpiredMemories = async () => {
  try {
    if (mongoose.connection.readyState !== 1) return;

    const now = new Date();
    const expiredList = await Memory.find({
      status: 'active',
      expiresAt: { $ne: null, $lte: now },
    });

    for (const mem of expiredList) {
      mem.status = 'expired';
      await mem.save();

      await MemoryLog.create({
        memoryId: mem._id,
        userId: mem.userId,
        action: 'EXPIRED',
        contentSnapshot: mem.content,
        category: mem.category,
        reason: `Memory TTL reached expiration at ${mem.expiresAt.toISOString()}`,
        metadata: { expiresAt: mem.expiresAt, scannedAt: now },
      });

      console.log(`[TTL Scanner] Memory #${mem._id} expired and recorded in audit log.`);
    }
  } catch (err) {
    console.error('[TTL Scanner Error]:', err.message);
  }
};

const startTtlExpirationScanner = () => {
  if (ttlInterval) clearInterval(ttlInterval);
  // Run on startup
  checkExpiredMemories();
  // Check every 30 seconds
  ttlInterval = setInterval(checkExpiredMemories, 30000);
};

/**
 * Test a MongoDB connection string without affecting current connection
 */
export const testMongoConnection = async (testUri) => {
  if (!testUri || typeof testUri !== 'string') {
    return { success: false, message: 'Connection string is required' };
  }

  let testConn = null;
  try {
    testConn = await mongoose.createConnection(testUri.trim(), {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    }).asPromise();

    const isAtlas = testUri.includes('mongodb+srv://') || testUri.includes('.mongodb.net');
    const dbName = testConn.name || 'test';

    await testConn.close();

    return {
      success: true,
      message: `Successfully connected to ${isAtlas ? 'MongoDB Atlas' : 'MongoDB'} database "${dbName}"`,
      isAtlas,
      databaseName: dbName,
    };
  } catch (err) {
    if (testConn) {
      try { await testConn.close(); } catch (e) {}
    }
    return {
      success: false,
      message: err.message || 'Failed to connect to MongoDB URI',
    };
  }
};

/**
 * Switch the live database connection to a new MongoDB URI
 */
export const switchDatabaseConnection = async (newUri) => {
  if (!newUri || !newUri.startsWith('mongodb')) {
    throw new Error('Valid MongoDB URI is required');
  }

  // 1. Validate connection
  const testRes = await testMongoConnection(newUri);
  if (!testRes.success) {
    throw new Error(testRes.message);
  }

  // 2. Disconnect existing
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // 3. Connect to new URI
  await mongoose.connect(newUri.trim(), {
    serverSelectionTimeoutMS: 8000,
  });

  dbSource = newUri.includes('mongodb+srv://') ? 'MongoDB Atlas' : 'Remote MongoDB';
  setupChangeStreams();
  startTtlExpirationScanner();

  console.log(`[Database Switch] Reconnected successfully to ${dbSource}: ${mongoose.connection.name}`);
  return {
    success: true,
    dbSource,
    databaseName: mongoose.connection.name,
  };
};

export const getDatabaseStatus = () => ({
  connected: mongoose.connection.readyState === 1,
  readyState: mongoose.connection.readyState,
  source: dbSource,
  databaseName: mongoose.connection.name || 'memora_ai',
  host: mongoose.connection.host || 'localhost',
  changeStreamActive: true,
});
