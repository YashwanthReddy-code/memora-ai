import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { AddMemoryModal } from '../memories/AddMemoryModal';

export const Header = () => {
  const { activePage, stats, triggerRefresh, addNotification, sseConnected } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const pageTitles = {
    dashboard: {
      title: 'Dashboard Overview',
      subtitle: 'Real-time telemetry, memory analytics, and MongoDB Change Streams',
    },
    chat: {
      title: 'Agentic AI Chat',
      subtitle: 'Conversational memory assistant with vector search retrieval & extraction',
    },
    memories: {
      title: 'Memory Vault',
      subtitle: 'Inspect, search, edit, resolve conflicts, and track expiration',
    },
    history: {
      title: 'Memory Audit History',
      subtitle: 'Complete lifecycle audit log, lineage tracking, and conflict diffs',
    },
    settings: {
      title: 'System Settings & Diagnostics',
      subtitle: 'Configure MongoDB Atlas, Gemini API keys, vector models, and TTL rules',
    },
  };

  const current = pageTitles[activePage] || { title: 'Memora AI', subtitle: '' };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const res = await api.seedData();
      addNotification(res.message || 'Sample memories seeded successfully!', 'success');
      triggerRefresh();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <header className="h-16 px-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between backdrop-blur-md">
        <div>
          <h1 className="text-base font-semibold text-slate-100">{current.title}</h1>
          <p className="text-xs text-slate-400 hidden sm:block">{current.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* MongoDB Atlas Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 font-mono text-[11px]">
              {stats?.systemHealth?.database?.source || 'MongoDB'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>

          {/* Gemini AI Status */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300 font-mono text-[11px]">
              {stats?.systemHealth?.gemini?.configured ? 'Gemini 1.5' : 'Gemini Offline Mode'}
            </span>
          </div>

          {/* Seed Data Button */}
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors shadow-sm disabled:opacity-50"
            title="Seed curated memories for hackathon demo"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${seeding ? 'animate-spin' : ''}`} />
            <span>{seeding ? 'Seeding...' : 'Seed Data'}</span>
          </button>

          {/* Add Memory Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Memory</span>
          </button>
        </div>
      </header>

      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={() => {
          triggerRefresh();
        }}
      />
    </>
  );
};

