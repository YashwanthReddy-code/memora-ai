import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { CategoryBadge, StatusBadge, TtlBadge } from '../common/Badge';
import { api } from '../../services/api';
import { Clock, Eye, GitFork, Hash, Tag, Layers } from 'lucide-react';

export const InspectMemoryModal = ({ isOpen, onClose, memoryId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (memoryId && isOpen) {
      setLoading(true);
      api
        .getMemoryById(memoryId)
        .then(res => setData(res))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [memoryId, isOpen]);

  if (!isOpen) return null;

  const memory = data?.memory;
  const logs = data?.logs || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inspect Memory Document" maxWidth="max-w-3xl">
      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading document from MongoDB...</div>
      ) : !memory ? (
        <div className="py-8 text-center text-slate-400">Memory not found.</div>
      ) : (
        <div className="space-y-6">
          {/* Header Status & Categories */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2">
              <CategoryBadge category={memory.category} />
              <StatusBadge status={memory.status} />
              <TtlBadge expiresAt={memory.expiresAt} />
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <span>Access Count: <strong className="text-indigo-400">{memory.accessCount || 0}</strong></span>
              <span>•</span>
              <span>Confidence: <strong className="text-emerald-400">{((memory.confidence || 0) * 100).toFixed(0)}%</strong></span>
            </div>
          </div>

          {/* Statement */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Atomic Fact / Memory Content
            </h4>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-medium">
              "{memory.content}"
            </div>
          </div>

          {/* Conflict Lineage Banner if Superseded */}
          {memory.status === 'superseded' && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                <GitFork className="w-4 h-4 text-amber-400" />
                Conflict / Superseded Lineage
              </div>
              <p className="text-xs text-amber-200/90">
                {memory.conflictNotes || 'This memory was replaced by newer information.'}
              </p>
              {memory.supersededBy && (
                <div className="pt-2 text-xs">
                  <span className="text-slate-400">Superseded by: </span>
                  <span className="font-mono text-indigo-300">
                    "{memory.supersededBy.content}"
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block mb-1">Document ID</span>
              <span className="font-mono text-slate-300 truncate block">{memory._id}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block mb-1">Created At</span>
              <span className="text-slate-300">{new Date(memory.createdAt).toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block mb-1">Last Accessed</span>
              <span className="text-slate-300">
                {memory.lastAccessedAt ? new Date(memory.lastAccessedAt).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>

          {/* Tags */}
          {memory.tags?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {memory.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Vector Search Embedding Preview */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              768-Dimensional Vector Embedding (MongoDB Vector Search)
            </h4>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400 overflow-x-auto max-h-24">
              {memory.embedding?.length > 0 ? (
                <>
                  <div className="text-indigo-400 mb-1">
                    Dimensions: {memory.embedding.length} | Model: text-embedding-004
                  </div>
                  [{memory.embedding.slice(0, 16).map(n => n.toFixed(5)).join(', ')}, ... +{memory.embedding.length - 16} more]
                </>
              ) : (
                <span className="text-slate-500">No embedding vector stored.</span>
              )}
            </div>
          </div>

          {/* Audit Logs for this memory */}
          {logs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Lifecycle Audit Trail ({logs.length} events)
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10">
                        {log.action}
                      </span>
                      <span className="text-slate-300">{log.reason || 'Event executed'}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

