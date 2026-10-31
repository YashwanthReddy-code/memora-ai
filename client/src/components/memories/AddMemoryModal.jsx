import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const AddMemoryModal = ({ isOpen, onClose, onCreated }) => {
  const { addNotification } = useApp();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('personal');
  const [confidence, setConfidence] = useState('0.95');
  const [tags, setTags] = useState('');
  const [ttlHours, setTtlHours] = useState('0');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setLoading(true);
      const res = await api.createMemory({
        content: content.trim(),
        category,
        confidence: parseFloat(confidence) || 0.95,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        ttlHours: parseInt(ttlHours) || null,
        isTemporal: parseInt(ttlHours) > 0,
      });

      addNotification(
        res.resolvedConflict
          ? `Memory added! (Resolved conflict with previous memory)`
          : 'Memory created and indexed successfully!',
        'success'
      );

      setContent('');
      setTags('');
      setTtlHours('0');
      onCreated?.();
      onClose();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Memory to Vault">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Memory Statement *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={3}
            placeholder="e.g. User prefers concise answers with TypeScript examples"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="personal">Personal (Identity, Location, Bio)</option>
              <option value="preference">Preference (Coding, Tone, UI)</option>
              <option value="work">Work (Job, Tech Stack, Projects)</option>
              <option value="constraint">Constraint (Allergies, Limits)</option>
              <option value="goal">Goal (Objectives, Milestones)</option>
              <option value="temporal">Temporal (Temporary Context, Events)</option>
              <option value="correction">Correction (Manual override)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Expiration (MongoDB TTL)
            </label>
            <select
              value={ttlHours}
              onChange={(e) => setTtlHours(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="0">Never (Permanent Memory)</option>
              <option value="1">1 Hour (Quick Context)</option>
              <option value="24">24 Hours (Daily Task / Hotel)</option>
              <option value="72">3 Days (Weekend / Trip)</option>
              <option value="168">7 Days (1 Week Sprint)</option>
              <option value="720">30 Days (Monthly Goal)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. typescript, coding, style"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Confidence Score (0.0 to 1.0)
            </label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max="1.0"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating & Vectorizing...' : 'Save & Index Memory'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

