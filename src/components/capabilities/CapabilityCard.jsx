import React from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

const STATE_STYLES = {
  warning: {
    card: 'border-amber-400/50 shadow-[0_0_24px_-8px_rgba(204,142,29,0.7)]',
    bg: 'linear-gradient(135deg, #CC8E1D 0%, #A06A12 100%)',
    badgeBg: 'bg-black/25',
    Badge: () => <AlertTriangle className="h-4 w-4 text-amber-100" />,
  },
  success: {
    card: 'border-emerald-400/50 shadow-[0_0_24px_-8px_rgba(34,153,84,0.7)]',
    bg: 'linear-gradient(135deg, #229954 0%, #197A42 100%)',
    badgeBg: 'bg-emerald-200/25',
    Badge: () => <Check className="h-4 w-4 text-white" />,
  },
  running: {
    card: 'border-amber-300/70 shadow-[0_0_30px_-6px_rgba(204,142,29,0.9)] animate-pulse',
    bg: 'linear-gradient(135deg, #E0A030 0%, #B07814 100%)',
    badgeBg: 'bg-black/30',
    Badge: () => <Loader2 className="h-4 w-4 animate-spin text-white" />,
  },
  complete: {
    card: 'border-emerald-300/70 shadow-[0_0_30px_-6px_rgba(34,153,84,0.9)]',
    bg: 'linear-gradient(135deg, #2BB566 0%, #1C8A4B 100%)',
    badgeBg: 'bg-emerald-100/30',
    Badge: () => <Check className="h-4 w-4 text-white" />,
  },
  error: {
    card: 'border-red-400/70 shadow-[0_0_24px_-6px_rgba(239,68,68,0.7)]',
    bg: 'linear-gradient(135deg, #B91C1C 0%, #7F1D1D 100%)',
    badgeBg: 'bg-black/30',
    Badge: () => <AlertTriangle className="h-4 w-4 text-white" />,
  },
};

export default function CapabilityCard({ cap, runState, detail }) {
  // runState is 'waiting' | 'running' | 'complete' | 'error' (demo), or 'idle' (not started)
  const effective = runState && runState !== 'idle' && runState !== 'waiting' ? runState : cap.health;
  const s = STATE_STYLES[effective] || STATE_STYLES[cap.health];
  const StatusBadge = s.Badge;
  const Icon = cap.icon;

  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all duration-300 ${s.card}`}
      style={{ background: s.bg, backdropFilter: 'blur(6px)' }}
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
          <Icon className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
        <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${s.badgeBg} ring-1 ring-white/20`}>
          <StatusBadge />
        </div>
      </div>
      <h3 className="mt-4 font-bold text-white text-base leading-tight tracking-tight">{cap.label}</h3>
      <p className="text-white/75 text-sm mt-0.5 leading-snug">{cap.desc}</p>
      {detail && effective !== cap.health && (
        <p className="mt-3 text-xs text-white/95 font-mono truncate border-t border-white/15 pt-2">
          {detail}
        </p>
      )}
    </div>
  );
}