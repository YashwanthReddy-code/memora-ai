import React from 'react';

export const CategoryBadge = ({ category, className = '' }) => {
  const cat = (category || 'personal').toLowerCase();

  const styles = {
    personal: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    preference: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    work: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    constraint: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    goal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    temporal: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    correction: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const style = styles[cat] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${style} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {cat}
    </span>
  );
};

export const StatusBadge = ({ status, className = '' }) => {
  const stat = (status || 'active').toLowerCase();

  const styles = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    superseded: 'bg-amber-500/10 text-amber-400 border-amber-500/20 line-through',
    expired: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    archived: 'bg-slate-500/10 text-slate-400 border-slate-700',
  };

  const style = styles[stat] || 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${style} ${className}`}
    >
      {stat}
    </span>
  );
};

export const TtlBadge = ({ expiresAt }) => {
  if (!expiresAt) return null;

  const expDate = new Date(expiresAt);
  const now = new Date();
  const diffHours = Math.round((expDate - now) / (1000 * 60 * 60));
  const isExpired = diffHours <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${
        isExpired
          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      }`}
      title={`Expires at: ${expDate.toLocaleString()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {isExpired ? 'TTL Expired' : `TTL: ~${diffHours}h left`}
    </span>
  );
};

