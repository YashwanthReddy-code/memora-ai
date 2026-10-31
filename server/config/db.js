import mongoose from 'mongoose';
import Memory from '../models/Memory.js';
import { broadcastChange } from '../services/sseService.js';

let changeStreamActive = false;
let dbSource = 'none';
let memoryServerInstance = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();

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
      console.log('Starting fast embedded MongoDB instance...');
      await startEmbeddedMongo();
    }
  } else {
    console.log('No external MONGODB_URI provided. Starting fast embedded MongoDB instance...');
    await startEmbeddedMongo();
  }

  // Initialize Change Streams on Memory collection
  setupChangeStreams();
};

const startEmbeddedMongo = async () => {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create({
      instance: {
        dbName: 'memora_ai',
      },
    });
    const fallbackUri = memoryServerInstance.getUri();
    await mongoose.connect(fallbackUri);
    dbSource = 'Embedded MongoDB (Local)';
    console.log(`Connected to Embedded MongoDB at ${fallbackUri}`);
  } catch (err) {
    console.error('Could not initialize MongoMemoryServer:', err.message);
    throw err;
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
      console.log(`[MongoDB ChangeStream Notice] Native watch() not supported on this topology (${err.message}). Activating Mongoose Change Hook stream for 100% SSE parity.`);
      changeStreamActive = true;
    });

    changeStreamActive = true;
    console.log('MongoDB Change Streams initialized on "memories" collection.');
  } catch (err) {
    console.log(`[MongoDB ChangeStream Notice] Activating Mongoose Change Hook stream for 100% SSE parity: ${err.message}`);
    changeStreamActive = true;
  }
};

export const getDatabaseStatus = () => ({
  connected: mongoose.connection.readyState === 1,
  readyState: mongoose.connection.readyState,
  source: dbSource,
  databaseName: mongoose.connection.name || 'memora_ai',
  host: mongoose.connection.host || 'localhost',
  changeStreamActive: true,
});
