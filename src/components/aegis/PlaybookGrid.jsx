import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLAYBOOKS, PLAYBOOK_STATS } from '@/lib/aegisPlaybooks';
import { RotateCw, TrendingUp, Shuffle, Undo2, Flame, CloudOff, Trash2, DatabaseBackup, ShieldAlert, BellRing, Database, SlidersHorizontal, Network, Bird, Gauge, Atom, KeyRound, Shield } from 'lucide-react';

const ICONS = { RotateCw, TrendingUp, Shuffle, Undo2, Flame, CloudOff, Trash2, DatabaseBackup, ShieldAlert, BellRing, Database, SlidersHorizontal, Network, Bird, Gauge, Atom, KeyRound };

const catColor = {
  core: 'border-blue-500/30 bg-blue-500/5',
  advanced: 'border-violet-500/30 bg-violet-500/5',
  quantum: 'border-emerald-500/30 bg-emerald-500/5',
};
const catBadge = {
  core: 'border-blue-500/40 text-blue-300',
  advanced: 'border-violet-500/40 text-violet-300',
  quantum: 'border-emerald-500/40 text-emerald-300',
};

export default function PlaybookGrid({ healingEvents }) {
  const stats = {
    ...PLAYBOOK_STATS,
    avgSuccess: healingEvents.length > 0 ? Math.round((healingEvents.filter((e) => e.status === 'success').length / healingEvents.length) * 100) : 94,
    avgRecovery: healingEvents.length > 0 ? Math.round(healingEvents.filter((e) => e.execution_time_ms).reduce((s, e) => s + e.execution_time_ms, 0) / healingEvents.length / 1000) : 58,
  };

  return (
    <Card className="p-4 bg-slate-800/40 border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Shield className="h-3.5 w-3.5" /> Active Playbooks
        </div>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <span>{stats.total} playbooks</span>
          <span className="text-emerald-400">{stats.avgSuccess}% success</span>
          <span>{stats.avgRecovery}s avg</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PLAYBOOKS.map((pb) => {
          const Icon = ICONS[pb.icon] || RotateCw;
          return (
            <div key={pb.id} className={`rounded-lg border p-2.5 ${catColor[pb.category]}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-slate-300 shrink-0" />
                <span className="text-xs font-mono font-semibold text-slate-200">{pb.id}</span>
                <Badge variant="outline" className={`ml-auto text-[9px] h-4 capitalize ${catBadge[pb.category]}`}>{pb.category}</Badge>
              </div>
              <div className="text-xs font-medium text-slate-100 mb-1">{pb.name}</div>
              <div className="text-[10px] text-slate-500 leading-tight">{pb.trigger}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}