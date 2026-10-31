import { API_URL } from '../config.js';

const toQueryString = (params = {}) => {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'null') {
      clean[k] = v;
    }
  }
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
};

const handleResponse = async (res) => {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errorData = await res.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch (e) {
      // Fallback
    }
    throw new Error(errorMsg);
  }
  return res.json();
};

export const api = {
  // Stats
  getStats: () => fetch(`${API_URL}/api/stats`).then(handleResponse),

  // Memories
  getMemories: (params = {}) => fetch(`${API_URL}/api/memories${toQueryString(params)}`).then(handleResponse),
  getMemoryById: (id) => fetch(`${API_URL}/api/memories/${id}`).then(handleResponse),
  createMemory: (data) =>
    fetch(`${API_URL}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateMemory: (id, data) =>
    fetch(`${API_URL}/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteMemory: (id, permanent = false) =>
    fetch(`${API_URL}/api/memories/${id}?permanent=${permanent}`, {
      method: 'DELETE',
    }).then(handleResponse),
  searchMemoriesSemantic: (data) =>
    fetch(`${API_URL}/api/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Chat
  sendChatMessage: (data) =>
    fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  getConversations: () => fetch(`${API_URL}/api/chat/conversations`).then(handleResponse),
  getMessages: (conversationId) =>
    fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`).then(handleResponse),
  deleteConversation: (id) =>
    fetch(`${API_URL}/api/chat/conversations/${id}`, {
      method: 'DELETE',
    }).then(handleResponse),

  // History & Audit
  getHistory: (params = {}) => fetch(`${API_URL}/api/history${toQueryString(params)}`).then(handleResponse),
  clearHistory: () =>
    fetch(`${API_URL}/api/history/clear`, {
      method: 'DELETE',
    }).then(handleResponse),

  // Settings
  getSettings: () => fetch(`${API_URL}/api/settings`).then(handleResponse),
  updateSettings: (data) =>
    fetch(`${API_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  testGemini: (apiKey, model) =>
    fetch(`${API_URL}/api/settings/test-gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    }).then(handleResponse),
  testMongoDB: (uri) =>
    fetch(`${API_URL}/api/settings/test-mongodb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri }),
    }).then(handleResponse),

  // Demo & Seeding
  seedData: () =>
    fetch(`${API_URL}/api/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(handleResponse),
  resetData: () =>
    fetch(`${API_URL}/api/seed/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(handleResponse),
};
