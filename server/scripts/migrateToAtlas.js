import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Memory from '../models/Memory.js';
import MemoryLog from '../models/MemoryLog.js';
import Setting from '../models/Setting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  console.log('=== MEMORA AI NON-DESTRUCTIVE ATLAS MIGRATION ===');

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    console.error('Error: Valid MONGODB_URI not found in server/.env.');
    process.exit(1);
  }

  const backupFilePath = path.resolve(__dirname, '../data/local_backup.json');
  if (!fs.existsSync(backupFilePath)) {
    console.error(`Backup file not found at ${backupFilePath}. Run backup first.`);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  const localMemories = backupData.memories || [];
  const localLogs = backupData.logs || [];

  console.log(`Found ${localMemories.length} memories and ${localLogs.length} audit logs in local backup.`);
  console.log('Connecting to MongoDB Atlas at database "memora_ai"...');

  await mongoose.connect(uri, {
    dbName: 'memora_ai',
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`Connected to: ${mongoose.connection.host} (Database: ${mongoose.connection.name})`);

  const memoryCol = mongoose.connection.db.collection('memories');
  const logCol = mongoose.connection.db.collection('memorylogs');
  const settingCol = mongoose.connection.db.collection('settings');

  // 1. Non-destructive migration of Memories (upsert by _id)
  let memoriesMigrated = 0;
  for (const mem of localMemories) {
    const { _id, ...rest } = mem;
    const res = await memoryCol.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $setOnInsert: { _id: new mongoose.Types.ObjectId(_id), ...rest } },
      { upsert: true }
    );
    if (res.upsertedCount > 0) memoriesMigrated++;
  }
  console.log(`Memories migration: ${memoriesMigrated} inserted, ${localMemories.length - memoriesMigrated} already present.`);

  // 2. Non-destructive migration of MemoryLogs (upsert by _id)
  let logsMigrated = 0;
  for (const log of localLogs) {
    const { _id, ...rest } = log;
    const res = await logCol.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $setOnInsert: { _id: new mongoose.Types.ObjectId(_id), ...rest } },
      { upsert: true }
    );
    if (res.upsertedCount > 0) logsMigrated++;
  }
  console.log(`MemoryLogs migration: ${logsMigrated} inserted, ${localLogs.length - logsMigrated} already present.`);

  // 3. Ensure User Setting exists on Atlas
  await settingCol.updateOne(
    { userId: 'default_user' },
    {
      $setOnInsert: {
        userId: 'default_user',
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
        embeddingModel: 'text-embedding-004',
        similarityThreshold: 0.65,
        topK: 5,
        defaultTtlHours: 0,
        autoExtract: true,
      },
    },
    { upsert: true }
  );

  const totalAtlasMemories = await Memory.countDocuments();
  const totalAtlasLogs = await MemoryLog.countDocuments();
  const collections = await mongoose.connection.db.listCollections().toArray();

  console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
  console.log('Atlas Database:', mongoose.connection.name);
  console.log('Atlas Collections:', collections.map(c => c.name));
  console.log('Total Memories in Atlas:', totalAtlasMemories);
  console.log('Total Logs in Atlas:', totalAtlasLogs);
  console.log('Local data in server/data/db was NOT deleted and remains fully preserved.');

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
