import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  Send,
  Bot,
  User,
  Sparkles,
  BrainCircuit,
  GitFork,
  Layers,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { CategoryBadge, StatusBadge } from '../components/common/Badge';
import { InspectMemoryModal } from '../components/memories/InspectMemoryModal';

export const AIChat = () => {
  const { triggerRefresh, addNotification } = useApp();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [showInspector, setShowInspector] = useState(true);

  // Inspector state from the latest turn
  const [latestRetrieved, setLatestRetrieved] = useState([]);
  const [latestExtracted, setLatestExtracted] = useState([]);
  const [latestConflicts, setLatestConflicts] = useState([]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversations
  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      try {
        setLoadingHistory(true);
        const data = await api.getMessages(activeConversationId);
        setMessages(data);

        // Populate inspector with the latest assistant message metadata if available
        const lastAssistant = [...data].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) {
          setLatestRetrieved(lastAssistant.retrievedMemories || []);
          setLatestExtracted(lastAssistant.extractedMemories || []);
          setLatestConflicts(lastAssistant.conflictsResolved || []);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadMessages();
  }, [activeConversationId]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    // Optimistic user message
    const tempUserMsg = {
      _id: 'temp-' + Date.now(),
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
      retrievedMemories: [],
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await api.sendChatMessage({
        message: userText,
        conversationId: activeConversationId,
      });

      if (!activeConversationId && res.conversationId) {
        setActiveConversationId(res.conversationId);
        loadConversations();
      }

      setMessages(prev => [...prev.filter(m => m._id !== tempUserMsg._id), res.userMessage, res.assistantMessage]);

      // Update Memory Inspector with fresh turn data
      setLatestRetrieved(res.retrievedMemories || []);
      setLatestExtracted(res.extractedMemories || []);
      setLatestConflicts(res.conflictsResolved || []);

      if (res.extractedMemories?.length > 0) {
        addNotification(`Extracted ${res.extractedMemories.length} new memory facts into MongoDB!`, 'success');
      }
      if (res.conflictsResolved?.length > 0) {
        addNotification(`Resolved ${res.conflictsResolved.length} conflicting/corrected memory!`, 'warning');
      }

      triggerRefresh();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setLatestRetrieved([]);
    setLatestExtracted([]);
    setLatestConflicts([]);
  };

  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(id);
      addNotification('Conversation deleted', 'info');
      if (activeConversationId === id) {
        handleNewChat();
      }
      loadConversations();
    } catch (err) {
      addNotification(err.message, 'error');
    }
  };

  // Quick prompt suggestions
  const suggestions = [
    "I just moved from Austin to Seattle, Washington!",
    "Can you recommend dinner spots considering my dietary constraints?",
    "I'm training for the Vancouver Half Marathon in May.",
    "I prefer concise TypeScript solutions over verbose explanations.",
  ];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4 overflow-hidden">
      {/* Left Chat Pane */}
      <div className="flex-1 flex flex-col rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        {/* Chat Header */}
        <div className="h-14 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            {/* Conversation picker dropdown */}
            {conversations.length > 0 && (
              <select
                value={activeConversationId || ''}
                onChange={(e) => setActiveConversationId(e.target.value || null)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500 max-w-xs truncate"
              >
                <option value="">(New Conversation)</option>
                {conversations.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setShowInspector(!showInspector)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showInspector
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>{showInspector ? 'Hide Inspector' : 'Memory Inspector'}</span>
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Ask Memora Anything</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Memora automatically identifies facts, updates obsolete memories, and customizes future answers using MongoDB Vector Search.
                </p>
              </div>

              {/* Suggestions */}
              <div className="w-full space-y-2 pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block text-left">
                  Try asking or telling:
                </span>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputMessage(s);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg._id || index}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                          : 'bg-slate-950 border border-slate-800 text-slate-100 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Metadata Drawer for Assistant Messages */}
                    {!isUser && (
                      <div className="space-y-2">
                        {/* Retrieved Memories Citations */}
                        {msg.retrievedMemories?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              <Layers className="w-3 h-3 text-indigo-400" />
                              Recalled:
                            </span>
                            {msg.retrievedMemories.map((rm, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedMemoryId(rm.memoryId)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-colors text-[11px]"
                              >
                                <span className="capitalize text-[10px] opacity-75 font-mono">
                                  {rm.category}:
                                </span>
                                <span className="truncate max-w-[140px]">"{rm.content}"</span>
                                {rm.similarityScore && (
                                  <span className="text-[10px] text-indigo-400 font-mono">
                                    {(rm.similarityScore * 100).toFixed(0)}%
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Extracted New Memories */}
                        {msg.extractedMemories?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Learned:
                            </span>
                            {msg.extractedMemories.map((em, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedMemoryId(em.memoryId)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-colors text-[11px]"
                              >
                                <span className="capitalize text-[10px] opacity-75">
                                  {em.category}:
                                </span>
                                <span className="truncate max-w-[140px]">"{em.content}"</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Conflict Resolution Banner */}
                        {msg.conflictsResolved?.length > 0 && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                              <GitFork className="w-3.5 h-3.5 text-amber-400" />
                              Conflict Resolved & Corrected
                            </div>
                            {msg.conflictsResolved.map((cr, idx) => (
                              <p key={idx} className="text-amber-200/90 text-[11px]">
                                {cr.reason || 'Memory superseded by newer turn.'}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex gap-3.5 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span>Searching vector index & personalizing context...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/80">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Tell Memora a fact, request recommendations, or chat..."
              disabled={loading}
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="absolute right-2 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-600/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Right Memory Inspector Drawer */}
      {showInspector && (
        <div className="w-80 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col overflow-hidden shrink-0">
          <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Memory Inspector
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Live Turn Trace</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-5">
            {/* 1. Retrieved Memories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Retrieved Memories
                </span>
                <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {latestRetrieved.length}
                </span>
              </div>

              {latestRetrieved.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-500 text-center">
                  No memories retrieved for current turn.
                </div>
              ) : (
                latestRetrieved.map((m, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedMemoryId(m.memoryId || m._id)}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer space-y-1.5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <CategoryBadge category={m.category} />
                      {m.similarityScore && (
                        <span className="text-[10px] font-mono text-indigo-400">
                          Match: {(m.similarityScore * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2">"{m.content}"</p>
                  </div>
                ))
              )}
            </div>

            {/* 2. Extracted Memories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Newly Extracted
                </span>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {latestExtracted.length}
                </span>
              </div>

              {latestExtracted.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-500 text-center">
                  No new facts detected in latest turn.
                </div>
              ) : (
                latestExtracted.map((em, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedMemoryId(em.memoryId)}
                    className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 hover:border-emerald-500 cursor-pointer space-y-1.5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <CategoryBadge category={em.category} />
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                        {em.action || 'Created'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2">"{em.content}"</p>
                  </div>
                ))
              )}
            </div>

            {/* 3. Conflicts Resolved */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-amber-400" />
                  Conflicts Resolved
                </span>
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  {latestConflicts.length}
                </span>
              </div>

              {latestConflicts.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-500 text-center">
                  No contradictions flagged.
                </div>
              ) : (
                latestConflicts.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-xs"
                  >
                    <div className="text-[11px] font-semibold text-amber-300">
                      {c.reason || 'Information Updated'}
                    </div>
                    <div className="text-[11px] text-slate-400 line-through">
                      Old: "{c.oldContent}"
                    </div>
                    <div className="text-[11px] text-emerald-300 font-medium">
                      New: "{c.newContent}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <InspectMemoryModal
        isOpen={Boolean(selectedMemoryId)}
        onClose={() => setSelectedMemoryId(null)}
        memoryId={selectedMemoryId}
      />
    </div>
  );
};

