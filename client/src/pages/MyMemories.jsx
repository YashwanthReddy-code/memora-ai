import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { MemoryCard } from '../components/memories/MemoryCard';
import { EditMemoryModal } from '../components/memories/EditMemoryModal';
import { InspectMemoryModal } from '../components/memories/InspectMemoryModal';
import { AddMemoryModal } from '../components/memories/AddMemoryModal';
import {
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Sparkles,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { CategoryBadge, StatusBadge, TtlBadge } from '../components/common/Badge';

export const MyMemories = () => {
  const { refreshTrigger, triggerRefresh, addNotification } = useApp();
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('active');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modals
  const [inspectId, setInspectId] = useState(null);
  const [editingMemory, setEditingMemory] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Semantic Search Query Modal/Drawer
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState(null);
  const [searchingSemantic, setSearchingSemantic] = useState(false);

  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getMemories({
        search,
        category: category !== 'all' ? category : undefined,
        status: status !== 'all' ? status : undefined,
        limit: 100,
      });
      setMemories(res.memories || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching memories:', err);
      addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, category, status, addNotification]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMemories();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchMemories, refreshTrigger]);

  const handleDelete = async (id) => {
    try {
      await api.deleteMemory(id, true);
      addNotification('Memory deleted from MongoDB', 'warning');
      triggerRefresh();
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  const handleSemanticSearch = async (e) => {
    e.preventDefault();
    if (!semanticQuery.trim()) return;

    try {
      setSearchingSemantic(true);
      const res = await api.searchMemoriesSemantic({
        query: semanticQuery.trim(),
        topK: 8,
        similarityThreshold: 0.45,
      });
      setSemanticResults(res.results || []);
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSearchingSemantic(false);
    }
  };

  const categoriesList = ['all', 'personal', 'preference', 'work', 'constraint', 'goal', 'temporal', 'correction'];
  const statusList = ['all', 'active', 'superseded', 'expired', 'archived'];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories by keyword, fact, tag, or category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Add Memory Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Memory</span>
          </button>
        </div>
      </div>

      {/* Semantic Vector Search Playground Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Atlas Vector Search & Semantic Similarity Simulator
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">text-embedding-004</span>
        </div>

        <form onSubmit={handleSemanticSearch} className="flex gap-2">
          <input
            type="text"
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
            placeholder="Type a concept (e.g. 'coding preferences', 'allergies', 'location') to test vector similarity..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={searchingSemantic || !semanticQuery.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shrink-0"
          >
            {searchingSemantic ? 'Matching Vectors...' : 'Run Vector Search'}
          </button>
        </form>

        {/* Semantic Results Preview */}
        {semanticResults && (
          <div className="p-3 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-300 font-semibold">
                Vector Matches ({semanticResults.length} found):
              </span>
              <button
                onClick={() => setSemanticResults(null)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            {semanticResults.length === 0 ? (
              <p className="text-xs text-slate-400">No memories met the similarity threshold.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {semanticResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => setInspectId(r._id)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/40 cursor-pointer flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <span className="font-semibold text-indigo-400 font-mono mr-1.5">
                        [{(r.similarityScore * 100).toFixed(0)}%]
                      </span>
                      <span className="text-slate-200">"{r.content}"</span>
                    </div>
                    <CategoryBadge category={r.category} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Pills */}
      <div className="space-y-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Category:
          </span>
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all border ${
                category === cat
                  ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Status:
          </span>
          {statusList.map((stat) => (
            <button
              key={stat}
              onClick={() => setStatus(stat)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all border ${
                status === stat
                  ? 'bg-slate-200 text-slate-950 border-slate-200 font-semibold shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              {stat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Grid or Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading memories from MongoDB...</div>
      ) : memories.length === 0 ? (
        <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3">
          <Sparkles className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No memories found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search filters or click "New Memory" / "Seed Data" to create entries.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((m) => (
            <MemoryCard
              key={m._id}
              memory={m}
              onInspect={(id) => setInspectId(id)}
              onEdit={(mem) => setEditingMemory(mem)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="p-4">Content</th>
                <th className="p-4">Category</th>
                <th className="p-4">Status</th>
                <th className="p-4">Expiration</th>
                <th className="p-4">Retrieved</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {memories.map((m) => (
                <tr
                  key={m._id}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => setInspectId(m._id)}
                >
                  <td className="p-4 font-medium text-slate-200 max-w-md">
                    <p className={`line-clamp-2 ${m.status === 'superseded' ? 'line-through text-slate-400' : ''}`}>
                      "{m.content}"
                    </p>
                  </td>
                  <td className="p-4">
                    <CategoryBadge category={m.category} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="p-4">
                    <TtlBadge expiresAt={m.expiresAt} />
                  </td>
                  <td className="p-4 font-mono text-indigo-400 font-bold">
                    {m.accessCount || 0}x
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectId(m._id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => setEditingMemory(m)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m._id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-500 hover:text-white text-rose-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <InspectMemoryModal
        isOpen={Boolean(inspectId)}
        onClose={() => setInspectId(null)}
        memoryId={inspectId}
      />

      <EditMemoryModal
        isOpen={Boolean(editingMemory)}
        onClose={() => setEditingMemory(null)}
        memory={editingMemory}
        onUpdated={() => triggerRefresh()}
      />

      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={() => triggerRefresh()}
      />
    </div>
  );
};

