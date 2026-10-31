import 'dotenv/config';
import mongoose from 'mongoose';
import Memory from '../models/Memory.js';
import { generateEmbedding } from '../services/geminiService.js';

async function reembed() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'memora_ai' });

  const active = await Memory.find({ status: 'active' });
  console.log(`Found ${active.length} active memories to verify/re-embed...`);

  let count = 0;
  for (const mem of active) {
    if (!mem.embedding || mem.embedding.length !== 3072) {
      console.log(`Re-embedding [${mem.category}]: "${mem.content.slice(0, 50)}..."`);
      const emb = await generateEmbedding(mem.content);
      if (emb && emb.length === 3072) {
        mem.embedding = emb;
        await mem.save();
        count++;
      }
    }
  }

  console.log(`Done! Re-embedded ${count} memories with 3072-dimensional Gemini embeddings.`);
  await mongoose.disconnect();
}

reembed().catch(console.error);
