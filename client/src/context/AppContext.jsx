import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [changeStreamEvents, setChangeStreamEvents] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  }, []);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  // Connect to MongoDB Change Stream SSE
  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        setSseConnected(true);
        console.log('[SSE] Connected to MongoDB Change Stream');
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'CHANGE_STREAM_EVENT') {
            const data = payload.data;
            const newEvent = {
              id: Date.now() + Math.random().toString(),
              operationType: data.operationType,
              documentKey: data.documentKey,
              fullDocument: data.fullDocument,
              wallTime: data.wallTime || payload.timestamp,
              engine: data.engine,
            };

            setChangeStreamEvents(prev => [newEvent, ...prev.slice(0, 49)]);

            // Trigger visual notification
            if (data.operationType === 'insert') {
              addNotification(`[Change Stream] New memory inserted: "${data.fullDocument?.content?.slice(0, 40)}..."`, 'success');
            } else if (data.operationType === 'update') {
              addNotification(`[Change Stream] Memory updated: "${data.fullDocument?.content?.slice(0, 40) || 'Modified'}"`, 'info');
            } else if (data.operationType === 'delete') {
              addNotification(`[Change Stream] Memory removed from MongoDB`, 'warning');
            }

            // Refresh stats & views
            triggerRefresh();
          }
        } catch (err) {
          console.error('[SSE Error parsing message]:', err);
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (err) {
      console.warn('[SSE Connection Failed]:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [addNotification, triggerRefresh]);

  return (
    <AppContext.Provider
      value={{
        activePage,
        setActivePage,
        stats,
        loadingStats,
        fetchStats,
        changeStreamEvents,
        sseConnected,
        notifications,
        addNotification,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

