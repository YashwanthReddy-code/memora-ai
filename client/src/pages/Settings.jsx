import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  Settings as SettingsIcon,
  Cpu,
  Database,
  Sliders,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Save,
} from 'lucide-react';

export const Settings = () => {
  const { stats, triggerRefresh, addNotification } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState(null);

  // Form State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.65);
  const [topK, setTopK] = useState(5);
  const [defaultTtlHours, setDefaultTtlHours] = useState(0);
  const [autoExtract, setAutoExtract] = useState(true);
  const [systemPersona, setSystemPersona] = useState('');

  // Seeding/Resetting state
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await api.getSettings();
        setHasExistingKey(data.hasGeminiApiKey);
        setGeminiModel(data.geminiModel || 'gemini-1.5-flash');
        setSimilarityThreshold(data.similarityThreshold ?? 0.65);
        setTopK(data.topK ?? 5);
        setDefaultTtlHours(data.defaultTtlHours ?? 0);
        setAutoExtract(data.autoExtract ?? true);
        setSystemPersona(
          data.systemPersona ||
            'You are Memora AI, an intelligent agent with persistent memory. You naturally recall relevant past details, preferences, and facts about the user.'
        );
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      await api.updateSettings({
        geminiApiKey: geminiApiKey || undefined,
        geminiModel,
        similarityThreshold,
        topK,
        defaultTtlHours,
        autoExtract,
        systemPersona,
      });

      addNotification('Settings saved successfully!', 'success');
      if (geminiApiKey) {
        setHasExistingKey(true);
        setGeminiApiKey('');
      }
      triggerRefresh();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestGemini = async () => {
    try {
      setTestingGemini(true);
      setGeminiTestResult(null);
      const res = await api.testGemini(geminiApiKey || undefined);
      setGeminiTestResult(res);
      if (res.success) {
        addNotification('Gemini API verified successfully!', 'success');
      } else {
        addNotification(`Gemini Test Failed: ${res.message}`, 'error');
      }
    } catch (err) {
      setGeminiTestResult({ success: false, message: err.message });
      addNotification(err.message, 'error');
    } finally {
      setTestingGemini(false);
    }
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const res = await api.seedData();
      addNotification(res.message || 'Sample data seeded successfully!', 'success');
      triggerRefresh();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('CAUTION: This will delete all memories, logs, and chat history. Continue?')) {
      return;
    }
    try {
      setResetting(true);
      await api.resetData();
      addNotification('Database reset successfully. Clean slate!', 'warning');
      triggerRefresh();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const copyAtlasIndexConfig = () => {
    const config = {
      name: "vector_index",
      type: "vectorSearch",
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: 768,
          similarity: "cosine"
        },
        {
          type: "filter",
          path: "userId"
        },
        {
          type: "filter",
          path: "status"
        }
      ]
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    addNotification('Atlas Vector Search Index JSON copied to clipboard!', 'info');
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Configuration</h2>
        <p className="text-xs text-slate-400 mt-1">
          Tune agentic memory extraction, vector thresholds, Gemini LLM connection, and MongoDB Atlas settings.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gemini API Key Configuration Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Google Gemini API</h3>
                <p className="text-xs text-slate-400">Powers agentic extraction, embeddings, and chat completions</p>
              </div>
            </div>
            {hasExistingKey ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                API Key Configured
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Simulation Mode
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {hasExistingKey ? 'Update API Key (Leave blank to keep existing)' : 'Gemini API Key *'}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder={hasExistingKey ? '••••••••••••••••••••••••' : 'AIzaSy...'}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={testingGemini || (!geminiApiKey && !hasExistingKey)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {testingGemini ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {geminiTestResult && (
              <p
                className={`text-xs font-mono mt-1 ${
                  geminiTestResult.success ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {geminiTestResult.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Gemini LLM Model
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast & Low Latency)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Embedding Model
              </label>
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-mono">
                text-embedding-004 (768 dimensions)
              </div>
            </div>
          </div>
        </div>

        {/* Memory Retrieval & Vector Search Tuning */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Memory Retrieval & Agentic Parameters</h3>
              <p className="text-xs text-slate-400">Control how memories are recalled and injected into prompts</p>
            </div>
          </div>

          {/* Similarity Threshold Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase tracking-wider text-slate-400">
                Vector Similarity Threshold: <span className="text-indigo-400 font-mono">{(similarityThreshold * 100).toFixed(0)}%</span>
              </label>
              <span className="text-[11px] text-slate-500">Higher = Stricter semantic matching</span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.90"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Top-K retrieved memories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Top-K Memories to Recall: <span className="text-indigo-400 font-mono">{topK}</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Default TTL Expiration
              </label>
              <select
                value={defaultTtlHours}
                onChange={(e) => setDefaultTtlHours(parseInt(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="0">Permanent (No default expiration)</option>
                <option value="24">24 Hours (Daily)</option>
                <option value="72">3 Days</option>
                <option value="168">7 Days</option>
                <option value="720">30 Days</option>
              </select>
            </div>
          </div>

          {/* Auto Extract Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Autonomous Memory Extraction</span>
              <span className="text-[11px] text-slate-500">
                Automatically extract and update memories from each conversational turn
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoExtract}
                onChange={(e) => setAutoExtract(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {/* Custom Persona Editor */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Assistant Persona & Memory Behavior Prompt
            </label>
            <textarea
              rows={3}
              value={systemPersona}
              onChange={(e) => setSystemPersona(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 leading-relaxed font-mono"
            />
          </div>
        </div>

        {/* MongoDB Atlas & Vector Search Guide Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">MongoDB Atlas Vector Search Index</h3>
                <p className="text-xs text-slate-400">Index configuration for 768-dim vector embeddings</p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyAtlasIndexConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Atlas JSON</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            In your MongoDB Atlas cluster dashboard under <strong>Atlas Search → Vector Search</strong>, create a vector search index named <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded">vector_index</code> on the <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded">memories</code> collection using the JSON definition below:
          </p>

          <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "status" }
  ]
}`}
          </pre>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Hackathon Demo Management Card */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Hackathon Demonstration Controls
        </h3>
        <p className="text-xs text-slate-400">
          Easily reset or populate the database with realistic sample scenarios (including conflicting memories and TTL expiration).
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{seeding ? 'Seeding...' : 'Seed Realistic Hackathon Dataset'}</span>
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{resetting ? 'Resetting...' : 'Reset Entire Database'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

