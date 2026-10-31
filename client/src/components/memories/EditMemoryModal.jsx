import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const EditMemoryModal = ({ isOpen, onClose, memory, onUpdated }) => {
  const { addNotification } = useApp();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('personal');
  const [status, setStatus] = useState('active');
  const [confidence, setConfidence] = useState('0.9');
  const [tags, setTags] = useState('');
  const [ttlHours, setTtlHours] = useState('0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (memory) {
      setContent(memory.content || '');
      setCategory(memory.category || 'personal');
      setStatus(memory.status || 'active');
      setConfidence(String(memory.confidence || 0.9));
      setTags(Array.isArray(memory.tags) ? memory.tags.join(', ') : '');
      setTtlHours('0');
    }
  }, [memory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memory) return;

    try {
      setLoading(true);
      await api.updateMemory(memory._id, {
        content: content.trim(),
        category,
        status,
        confidence: parseFloat(confidence) || 0.9,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        ttlHours: parseInt(ttlHours) || undefined,
        resetExpiration: ttlHours === 'remove',
      });

      addNotification('Memory updated and audit log recorded!', 'success');
      onUpdated?.();
      onClose();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!memory) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Memory">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Memory Content *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
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
              <option value="personal">Personal</option>
              <option value="preference">Preference</option>
              <option value="work">Work</option>
              <option value="constraint">Constraint</option>
              <option value="goal">Goal</option>
              <option value="temporal">Temporal</option>
              <option value="correction">Correction</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="active">Active</option>
              <option value="superseded">Superseded (Overridden)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Adjust Expiration (TTL)
            </label>
            <select
              value={ttlHours}
              onChange={(e) => setTtlHours(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="0">Keep Existing Expiration</option>
              <option value="remove">Remove Expiration (Make Permanent)</option>
              <option value="24">Extend 24 Hours</option>
              <option value="72">Extend 3 Days</option>
              <option value="168">Extend 7 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Confidence Score
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
          />
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
            {loading ? 'Saving...' : 'Update Memory'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

