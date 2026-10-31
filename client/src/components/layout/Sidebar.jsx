import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  BrainCircuit,
  History,
  Settings,
  Activity,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar = () => {
  const { activePage, setActivePage, stats, sseConnected } = useApp();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'chat',
      label: 'AI Chat',
      icon: MessageSquare,
      badge: 'Agentic',
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    },
    {
      id: 'memories',
      label: 'My Memories',
      icon: BrainCircuit,
      badge: stats?.overview?.activeMemories ?? 0,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    },
    {
      id: 'history',
      label: 'Memory History',
      icon: History,
      badge: null,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col shrink-0 select-none backdrop-blur-md">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <BrainCircuit className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-white text-base">Memora</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              AI
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Intelligent Memory Assistant</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Main Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                    isActive
                      ? 'bg-white/20 text-white border-white/30'
                      : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Live Change Stream Status Box */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {sseConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  sseConnected ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-200">MongoDB ChangeStream</p>
              <p className="text-[11px] text-slate-400">
                {sseConnected ? 'Real-Time Sync Active' : 'Connecting stream...'}
              </p>
            </div>
          </div>
          <Activity className={`w-4 h-4 ${sseConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
        </div>
      </div>
    </aside>
  );
};

