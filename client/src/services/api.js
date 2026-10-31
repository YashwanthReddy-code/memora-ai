const API_BASE = '/api';

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
  getStats: () => fetch(`${API_BASE}/stats`).then(handleResponse),

  // Memories
  getMemories: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/memories?${qs}`).then(handleResponse);
  },
  getMemoryById: (id) => fetch(`${API_BASE}/memories/${id}`).then(handleResponse),
  createMemory: (data) =>
    fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateMemory: (id, data) =>
    fetch(`${API_BASE}/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteMemory: (id, permanent = false) =>
    fetch(`${API_BASE}/memories/${id}?permanent=${permanent}`, {
      method: 'DELETE',
    }).then(handleResponse),
  searchMemoriesSemantic: (data) =>
    fetch(`${API_BASE}/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Chat
  sendChatMessage: (data) =>
    fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  getConversations: () => fetch(`${API_BASE}/chat/conversations`).then(handleResponse),
  getMessages: (conversationId) =>
    fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`).then(handleResponse),
  deleteConversation: (id) =>
    fetch(`${API_BASE}/chat/conversations/${id}`, {
      method: 'DELETE',
    }).then(handleResponse),

  // History & Audit
  getHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/history?${qs}`).then(handleResponse);
  },
  clearHistory: () =>
    fetch(`${API_BASE}/history/clear`, {
      method: 'DELETE',
    }).then(handleResponse),

  // Settings
  getSettings: () => fetch(`${API_BASE}/settings`).then(handleResponse),
  updateSettings: (data) =>
    fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  testGemini: (apiKey) =>
    fetch(`${API_BASE}/settings/test-gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    }).then(handleResponse),
  testMongoDB: (uri) =>
    fetch(`${API_BASE}/settings/test-mongodb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri }),
    }).then(handleResponse),

  // Demo & Seeding
  seedData: () =>
    fetch(`${API_BASE}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(handleResponse),
  resetData: () =>
    fetch(`${API_BASE}/seed/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(handleResponse),
};
