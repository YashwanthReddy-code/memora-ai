import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BrainCircuit,
  Database,
  Sparkles,
  GitFork,
  Activity,
  ArrowUpRight,
  Clock,
  Layers,
  MessageSquare,
  Plus,
  Terminal,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { CategoryBadge, StatusBadge, TtlBadge } from '../components/common/Badge';
import { InspectMemoryModal } from '../components/memories/InspectMemoryModal';
import { AddMemoryModal } from '../components/memories/AddMemoryModal';

export const Dashboard = () => {
  const { stats, loadingStats, changeStreamEvents, sseConnected, setActivePage } = useApp();
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const overview = stats?.overview || {
    totalMemories: 0,
    activeMemories: 0,
    supersededMemories: 0,
    expiredMemories: 0,
    conflictResolutions: 0,
  };

  const categories = stats?.categories || [];
  const mostAccessed = stats?.mostAccessed || [];
  const health = stats?.systemHealth || {};

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 md:p-8 backdrop-blur-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Agentic Memory System Active
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Memora AI Assistant
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Your personal AI with long-term memory. It observes conversations, autonomously extracts atomic facts, resolves conflicting information, indexes 768-dim embeddings in MongoDB Atlas, and streams changes in real-time.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActivePage('chat')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/30"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Start Agentic Chat</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Memory</span>
            </button>
            <button
              onClick={() => setActivePage('memories')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Explore Vault</span>
            </button>
          </div>
        </div>

        {/* Ambient glow decoration */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Memories */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Stored</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <BrainCircuit className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {overview.totalMemories}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({overview.activeMemories} active)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Persistent atomic facts in MongoDB</p>
        </div>

        {/* Conflict Resolutions */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Conflicts Resolved</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <GitFork className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {overview.conflictResolutions}
            </span>
            <span className="text-xs text-amber-400 font-mono">superseded</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Contradictions resolved automatically</p>
        </div>

        {/* MongoDB Change Stream Status */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Change Streams</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {changeStreamEvents.length}
            </span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live SSE
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Real-time DB mutations captured</p>
        </div>

        {/* Vector Retrieval Status */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Vector Search</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">768</span>
            <span className="text-xs text-blue-400 font-mono">dim</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">text-embedding-004 + cosine pipeline</p>
        </div>
      </div>

      {/* Main Row: Live Change Streams Feed + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Change Streams Terminal (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">MongoDB Change Streams Ticker</h3>
                <p className="text-xs text-slate-400">
                  Live real-time feed emitted when documents mutate in MongoDB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                WATCHING "memories"
              </span>
            </div>
          </div>

          {/* Events Stream List */}
          <div className="p-4 flex-1 space-y-2.5 max-h-96 overflow-y-auto font-mono text-xs">
            {changeStreamEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Activity className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                <p>Waiting for live MongoDB changes...</p>
                <p className="text-[11px] text-slate-600">
                  Try sending a message in AI Chat or clicking "Seed Data" to watch events stream here in real-time.
                </p>
              </div>
            ) : (
              changeStreamEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5 hover:border-slate-700 transition-colors animate-in fade-in"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase ${
                          evt.operationType === 'insert'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : evt.operationType === 'update'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {evt.operationType}
                      </span>
                      <span className="text-slate-400 truncate max-w-xs">
                        Doc: {evt.documentKey?._id}
                      </span>
                    </div>
                    <span className="text-slate-500">
                      {new Date(evt.wallTime).toLocaleTimeString()}
                    </span>
                  </div>

                  {evt.fullDocument && (
                    <div className="text-slate-300 text-xs truncate">
                      <span className="text-slate-500">content: </span>
                      "{evt.fullDocument.content}"
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>Category: {evt.fullDocument?.category || 'general'}</span>
                    <span>Status: {evt.fullDocument?.status || 'active'}</span>
                    <span>Engine: {evt.engine || 'MongoDB ChangeStream'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Distribution (1 col) */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Categories</h3>
            <span className="text-xs text-slate-400 font-mono">{categories.length} types</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {categories.map((c) => {
              const pct = overview.totalMemories > 0 ? Math.round((c.total / overview.totalMemories) * 100) : 0;
              return (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <CategoryBadge category={c.category} />
                    <span className="font-mono text-slate-300">
                      {c.active} active <span className="text-slate-500">/ {c.total}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setActivePage('memories')}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <span>View All Memories</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Most Retrieved Memories + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Retrieved Memories */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Most Influential Memories</h3>
              <p className="text-xs text-slate-400">Frequently recalled and cited by the assistant</p>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
              Top Recall
            </span>
          </div>

          <div className="space-y-2.5">
            {mostAccessed.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No memories recalled yet. Start chatting to trigger semantic memory citations!
              </div>
            ) : (
              mostAccessed.map((m) => (
                <div
                  key={m._id}
                  onClick={() => setSelectedMemoryId(m._id)}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <CategoryBadge category={m.category} />
                    <span className="text-xs text-slate-200 font-medium truncate">
                      "{m.content}"
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-400">
                    <span className="text-indigo-400 font-bold">{m.accessCount}x cited</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Health Card */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            System Diagnostics
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">Database Cluster</span>
                <span className="text-slate-200 font-semibold">{health.database?.source || 'MongoDB'}</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">AI Model</span>
                <span className="text-slate-200 font-semibold">
                  {health.gemini?.configured ? health.gemini.model : 'Heuristic Simulation Mode'}
                </span>
              </div>
              <span className={`w-2 h-2 rounded-full ${health.gemini?.configured ? 'bg-indigo-400' : 'bg-amber-400'}`} />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">Change Stream SSE</span>
                <span className="text-slate-200 font-semibold">
                  {sseConnected ? 'Connected (Active)' : 'Reconnecting...'}
                </span>
              </div>
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            </div>
          </div>

          <button
            onClick={() => setActivePage('settings')}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            Manage API & Atlas Credentials
          </button>
        </div>
      </div>

      <InspectMemoryModal
        isOpen={Boolean(selectedMemoryId)}
        onClose={() => setSelectedMemoryId(null)}
        memoryId={selectedMemoryId}
      />

      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

