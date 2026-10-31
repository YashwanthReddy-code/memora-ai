# 🧠 Memora AI – Intelligent Memory Assistant

> **Agentic Memory Hackathon Project**  
> A full-stack intelligent assistant powered by **React.js + Vite**, **Node.js + Express**, **MongoDB Atlas**, **Google Gemini API**, **MongoDB Vector Search**, and **MongoDB Change Streams**.

---

## 🌟 Core Innovations & Architecture

1. **Conversational Agentic Memory Extraction**:
   - The AI assistant dynamically observes conversational turns.
   - Discreet, atomic facts, preferences, constraints, goals, and temporal contexts are extracted in structured JSON.

2. **Persistent Storage with 768-Dim Vector Embeddings**:
   - Every memory is stored persistently in MongoDB along with 768-dimensional embeddings generated via `text-embedding-004`.

3. **Semantic Retrieval (MongoDB Vector Search)**:
   - Queries use MongoDB Atlas `$vectorSearch` pipeline to find the most relevant memories for each user prompt.
   - An intelligent in-database cosine similarity pipeline serves as an automated fallback to guarantee seamless testing and offline reliability.

4. **Context Personalization & Citation Badges**:
   - The assistant personalizes answers based on retrieved user memories.
   - Interactive citation badges in each assistant message allow inspecting exactly which memories influenced the answer.

5. **Conflict & Correction Resolution**:
   - When new statements contradict past memories (e.g. *"I moved from Austin to Seattle"* or changing job/diet), the system flags the contradiction, marks the obsolete memory as `superseded`, records lineage pointers, and logs the transition to an audit trail.

6. **MongoDB TTL Indexes (Automatic Expiration)**:
   - MongoDB TTL Index on `expiresAt` (`{ expireAfterSeconds: 0 }`) manages temporal context (e.g., temporary hotel stays, trip details, short-term tasks).

7. **Real-Time MongoDB Change Streams**:
   - Watches mutations on the `memories` collection (`insert`, `update`, `delete`, `replace`).
   - Streams live events to the React frontend via Server-Sent Events (SSE).
   - Displayed in real-time in the **Change Streams Terminal** with live toast notifications.

---

## 🖥️ Application Pages

1. **Dashboard (`/`)**:
   - High-level KPIs: Total Memories, Active Count, Conflicts Resolved, Live Change Stream Events.
   - Category distribution breakdown.
   - Live MongoDB Change Streams Ticker terminal.
   - Influential memories (most recalled/cited).
   - System Diagnostics health card.

2. **AI Chat (`/chat`)**:
   - Interactive chat interface with conversation threads and quick prompt starters.
   - Real-time **Memory Inspector Drawer** on the right side showing:
     * Retrieved memories (similarity scores & categories).
     * Newly extracted facts from the turn.
     * Conflict resolutions banner.
   - Interactive citation pills inside assistant replies.

3. **My Memories (`/memories`)**:
   - Searchable, filterable card and table view.
   - Filter by Category (`personal`, `preference`, `work`, `constraint`, `goal`, `temporal`, `correction`).
   - Filter by Status (`active`, `superseded`, `expired`, `archived`).
   - **Vector Search Simulator**: Test semantic queries and see match percentages in real-time.
   - Actions: Inspect, Edit, and Delete memories.
   - Conflict lineage indicator with one-click navigation to replacement memories.

4. **Memory History (`/history`)**:
   - Chronological audit changelog of all memory operations (`CREATED`, `UPDATED`, `SUPERSEDED`, `DELETED`, `RETRIEVED`).
   - Visual conflict diffs comparing superseded vs new active facts.
   - Filter by event type and clear log capability.

5. **Settings (`/settings`)**:
   - Gemini API Key configuration and live test connection tool.
   - LLM model selector (`gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`).
   - Vector similarity threshold slider and Top-$K$ selector.
   - MongoDB Atlas Vector Search Index definition JSON with one-click copy.
   - One-click **Seed Realistic Hackathon Dataset** and **Reset Entire Database** controls.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18+ (tested on Node v24)
- (Optional) MongoDB Atlas Connection String and Google Gemini API Key

### Running the Application

1. **Start the Web Application (Backend + Frontend)**:
   ```bash
   cd server
   node index.js
   ```
   *The server starts on port `5000` and serves both the API and the pre-built React frontend.*

2. **Open your browser**:
   ```
   http://localhost:5000
   ```

3. **Development Mode (Vite Hot-Reload)**:
   In one terminal:
   ```bash
   cd server
   node --watch index.js
   ```
   In a second terminal:
   ```bash
   cd client
   npm run dev
   ```
   *Vite dev server runs at `http://localhost:5173` with automatic API proxying to port 5000.*

---

## ⚙️ Configuration (.env)

Edit `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/memora_ai?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
EMBEDDING_MODEL=text-embedding-004
SIMILARITY_THRESHOLD=0.65
TOP_K_MEMORIES=5
```

> **Note**: If `MONGODB_URI` or `GEMINI_API_KEY` are not set initially, Memora automatically boots with an embedded fast MongoDB instance and offline heuristic simulation mode. You can configure credentials anytime through the Settings page without restarting!

---

## 🔍 MongoDB Atlas Vector Search Index Setup

In your MongoDB Atlas cluster:
1. Navigate to **Atlas Search** -> **Vector Search**.
2. Click **Create Vector Search Index** (JSON Editor).
3. Select database `memora_ai` and collection `memories`.
4. Name the index `vector_index` and paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    },
    {
      "type": "filter",
      "path": "status"
    }
  ]
}
```

---

## 🏆 Hackathon Demonstration Script

1. **Open Dashboard (`http://localhost:5000`)**:
   - Click **"Seed Data"** in the top bar.
   - Observe the **MongoDB Change Streams Ticker** immediately stream 8 new `insert` events via SSE in real-time!
   - Review the category breakdown and KPI cards.

2. **Test Semantic Vector Search & Personalization (`AI Chat`)**:
   - Click **"AI Chat"** in the sidebar.
   - Prompt: *"Can you recommend dinner spots near where I live? Keep in mind my allergies."*
   - Notice the assistant recalls that you live in Seattle and are allergic to peanuts.
   - Click the citation badges underneath the response to inspect the underlying memory documents.

3. **Test Conflict & Correction Resolution**:
   - In AI Chat, prompt: *"Actually, I just relocated! I moved to London, UK."*
   - Watch the **Memory Inspector** on the right side:
     * The old memory (*"User lives in Seattle, WA"*) is marked `SUPERSEDED`.
     * The new memory (*"User relocated and now lives in London, UK"*) is created and marked `active`.
     * A golden **Conflict Resolved** banner is displayed with the diff!

4. **Verify Memory Vault & TTL Expiration (`My Memories`)**:
   - Navigate to **"My Memories"**.
   - Notice the status pills: active vs superseded.
   - Check the **TTL: ~48h left** badge on the temporary hotel memory.
   - Try the **Vector Search Simulator** at the top by typing *"running"* or *"programming"* to view similarity scores.

5. **Inspect the Audit Lineage (`Memory History`)**:
   - Navigate to **"Memory History"**.
   - Review the chronological audit log showing `CREATED`, `SUPERSEDED`, and `RETRIEVED` events with the visual lineage diff.

