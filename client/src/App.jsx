import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { AIChat } from './pages/AIChat';
import { MyMemories } from './pages/MyMemories';
import { MemoryHistory } from './pages/MemoryHistory';
import { Settings } from './pages/Settings';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const PageContent = () => {
  const { activePage } = useApp();

  switch (activePage) {
    case 'dashboard':
      return <Dashboard />;
    case 'chat':
      return <AIChat />;
    case 'memories':
      return <MyMemories />;
    case 'history':
      return <MemoryHistory />;
    case 'settings':
      return <Settings />;
    default:
      return <Dashboard />;
  }
};

const ToastContainer = () => {
  const { notifications } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`p-3.5 rounded-2xl border text-xs shadow-2xl backdrop-blur-xl flex items-start gap-2.5 pointer-events-auto transition-all animate-in slide-in-from-bottom-3 duration-300 ${
            n.type === 'success'
              ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300'
              : n.type === 'warning'
              ? 'bg-slate-900/95 border-amber-500/40 text-amber-300'
              : n.type === 'error'
              ? 'bg-slate-900/95 border-rose-500/40 text-rose-300'
              : 'bg-slate-900/95 border-indigo-500/40 text-indigo-300'
          }`}
        >
          {n.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : n.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium leading-relaxed">{n.message}</span>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <PageContent />
          </main>
        </div>

        {/* Global Live Toasts */}
        <ToastContainer />
      </div>
    </AppProvider>
  );
}

