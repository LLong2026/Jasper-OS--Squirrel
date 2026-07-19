import React from 'react';
import { CheckCircle2, GitMerge, Users, Target } from 'lucide-react';

const statusColor = (s) => ({
  completed: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-rose-500/15 text-rose-400',
  in_progress: 'bg-blue-500/15 text-blue-400',
  proposed: 'bg-slate-700 text-slate-300',
  assigned: 'bg-violet-500/15 text-violet-300',
  review: 'bg-amber-500/15 text-amber-300',
  negotiating: 'bg-cyan-500/15 text-cyan-300'
}[s] || 'bg-slate-700 text-slate-300');

export default function SwarmPipelineView({ swarm, tasks }) {
  if (!swarm) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-32">
        <Target className="h-12 w-12 text-slate-700 mb-4" />
        <h2 className="text-xl font-semibold text-slate-400">No active swarm</h2>
        <p className="text-sm text-slate-600 mt-1">Form a swarm from the side panel to begin orchestration.</p>
      </div>
    );
  }

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const consensus = tasks.length ? completed / tasks.length : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{swarm.name}</h2>
            <p className="text-xs font-mono text-slate-500">{swarm.swarm_id}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full ${swarm.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : swarm.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-violet-500/15 text-violet-400'}`}>
            {swarm.status}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-3">{swarm.goal}</p>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Users className="h-4 w-4 text-slate-500" />
          {swarm.member_dids?.map((d) => (
            <span key={d} className="text-xs font-mono text-slate-400 bg-slate-800/60 px-2 py-1 rounded">{d}</span>
          ))}
        </div>
        {swarm.result_summary && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> {swarm.result_summary}
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><GitMerge className="h-4 w-4 text-violet-400" /> Task Pipeline</h3>
            <span className="text-xs text-slate-500">{completed}/{tasks.length} · {Math.round(consensus * 100)}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4">
            <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${consensus * 100}%` }} />
          </div>
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                <span className="text-slate-600 font-mono text-xs w-6">#{t.order + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-slate-500 truncate">{t.description}</p>
                  {t.result?.output && <p className="text-xs text-cyan-400 mt-1">{t.result.output}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}