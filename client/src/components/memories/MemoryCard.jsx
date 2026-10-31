import React, { useState } from 'react';
import { CategoryBadge, StatusBadge, TtlBadge } from '../common/Badge';
import { Eye, Edit3, Trash2, GitFork, Tag, ArrowRight } from 'lucide-react';

export const MemoryCard = ({ memory, onInspect, onEdit, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(memory._id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={`group relative p-5 rounded-2xl bg-slate-900/80 border transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${
        memory.status === 'superseded'
          ? 'border-amber-500/30 bg-slate-900/40 opacity-80'
          : memory.status === 'expired'
          ? 'border-rose-500/30 bg-slate-900/40 opacity-75'
          : 'border-slate-800 hover:border-indigo-500/50'
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={memory.category} />
          <StatusBadge status={memory.status} />
          <TtlBadge expiresAt={memory.expiresAt} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onInspect?.(memory._id)}
            title="Inspect full document & vector embedding"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit?.(memory)}
            title="Edit memory"
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            title={confirmDelete ? 'Click again to permanently delete' : 'Delete memory'}
            className={`p-1.5 rounded-lg transition-colors ${
              confirmDelete
                ? 'bg-rose-500 text-white animate-pulse'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Memory Content */}
      <p
        className={`text-sm font-medium leading-relaxed mb-4 ${
          memory.status === 'superseded'
            ? 'text-slate-400 line-through'
            : 'text-slate-100'
        }`}
      >
        "{memory.content}"
      </p>

      {/* Conflict Notes Banner if Superseded */}
      {memory.status === 'superseded' && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <GitFork className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">
              {memory.conflictNotes || 'Superseded by newer memory'}
            </span>
          </div>
          {memory.supersededBy && (
            <button
              onClick={() => onInspect?.(memory.supersededBy._id || memory.supersededBy)}
              className="text-[11px] font-semibold text-indigo-400 hover:underline flex items-center shrink-0"
            >
              View New <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Footer Meta: Tags & Access Info */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-1 max-w-[70%]">
          {memory.tags?.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800"
            >
              #{tag}
            </span>
          ))}
          {memory.tags?.length > 3 && (
            <span className="text-[10px] text-slate-500 font-mono">
              +{memory.tags.length - 3}
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-500 shrink-0">
          Retrieved {memory.accessCount || 0}x
        </div>
      </div>
    </div>
  );
};

