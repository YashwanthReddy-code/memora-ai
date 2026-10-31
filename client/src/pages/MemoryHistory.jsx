import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  History,
  GitCommit,
  GitFork,
  Trash2,
  Filter,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { CategoryBadge } from '../components/common/Badge';
import { InspectMemoryModal } from '../components/memories/InspectMemoryModal';

export const MemoryHistory = () => {
  const { refreshTrigger, triggerRefresh, addNotification } = useApp();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [inspectMemoryId, setInspectMemoryId] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getHistory({
        action: actionFilter !== 'all' ? actionFilter : undefined,
        limit: 100,
      });
      setLogs(res.logs || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, addNotification]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTrigger]);

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all memory audit history?')) return;
    try {
      await api.clearHistory();
      addNotification('Audit history cleared', 'info');
      fetchLogs();
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  const actions = ['all', 'CREATED', 'SUPERSEDED', 'UPDATED', 'DELETED', 'RETRIEVED', 'CONFLICT_DETECTED'];

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'SUPERSEDED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'UPDATED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DELETED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'RETRIEVED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Lifecycle Audit Log & Lineage
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable chronological changelog of all agentic memory ingestions, conflict resolutions, and citations.
          </p>
        </div>

        <button
          onClick={handleClearHistory}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-xs font-medium text-slate-300 transition-colors border border-slate-700"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Logs</span>
        </button>
      </div>

      {/* Action Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
          Event:
        </span>
        {actions.map((act) => (
          <button
            key={act}
            onClick={() => setActionFilter(act)}
            className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider transition-all border ${
              actionFilter === act
                ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            {act}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading audit history...</div>
      ) : logs.length === 0 ? (
        <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3">
          <History className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No audit records found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Memory events such as creations, updates, citations, and conflicts will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {logs.map((log) => {
            const hasConflictDiff = log.action === 'SUPERSEDED' || log.supersededById;
            return (
              <div key={log._id} className="relative group">
                {/* Timeline Node Icon */}
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center -translate-x-1/2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>

                {/* Event Card */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                      {log.category && <CategoryBadge category={log.category} />}
                      <span className="text-slate-300 font-medium">{log.reason}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Main Content Snapshot */}
                  {log.contentSnapshot && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 font-mono">
                      "{log.contentSnapshot}"
                    </div>
                  )}

                  {/* Conflict Diff Visualization */}
                  {hasConflictDiff && log.metadata?.newContent && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-amber-400">
                        <GitFork className="w-3.5 h-3.5" />
                        Lineage Diff (Superseded Transition)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-slate-950/60 border border-amber-500/20 text-slate-400 line-through">
                          <span className="text-rose-400 font-semibold block text-[10px] uppercase">
                            Old (Superseded):
                          </span>
                          "{log.previousContent || log.contentSnapshot}"
                        </div>
                        <div className="p-2 rounded bg-slate-950/60 border border-emerald-500/30 text-emerald-300">
                          <span className="text-emerald-400 font-semibold block text-[10px] uppercase">
                            New (Active Fact):
                          </span>
                          "{log.metadata.newContent}"
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata and inspect button */}
                  {log.memoryId && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-500">
                        Target Memory ID: {log.memoryId._id || log.memoryId}
                      </span>
                      <button
                        onClick={() => setInspectMemoryId(log.memoryId._id || log.memoryId)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Inspect Memory →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InspectMemoryModal
        isOpen={Boolean(inspectMemoryId)}
        onClose={() => setInspectMemoryId(null)}
        memoryId={inspectMemoryId}
      />
    </div>
  );
};

