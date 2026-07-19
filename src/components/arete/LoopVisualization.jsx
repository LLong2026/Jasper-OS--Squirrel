import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, ArrowRight } from 'lucide-react';

const STAGES = ['IngestAPI', 'EventMesh', 'FeatureStore', 'AgentMesh', 'SafetyAgent', 'AuditService', 'Trainer', 'ModelRegistry', 'CapsuleComposer'];

export default function LoopVisualization({ stages, running }) {
  const stageMap = {};
  if (stages) stages.forEach(s => { stageMap[s.stage] = s; });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {STAGES.map((stageName, idx) => {
          const stage = stageMap[stageName];
          const isPassed = stage?.status === 'passed';
          const isBlocked = stage?.status === 'blocked';
          const isRunning = running && !stage && idx === (stages ? stages.length : 0);
          const isPending = !stage;

          return (
            <React.Fragment key={stageName}>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isPassed ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' :
                isBlocked ? 'bg-red-500/15 border-red-500/40 text-red-300' :
                isRunning ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' :
                'bg-slate-800/50 border-slate-700 text-slate-500'
              }`}>
                {isPassed ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                 isBlocked ? <XCircle className="h-3.5 w-3.5" /> :
                 isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                 <Circle className="h-3.5 w-3.5" />}
                <span>{stageName}</span>
              </div>
              {idx < STAGES.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600" />}
            </React.Fragment>
          );
        })}
      </div>
      {stages && stages.length > 0 && (
        <div className="space-y-1 mt-3">
          {stages.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 ${s.status === 'passed' ? 'text-emerald-400' : s.status === 'blocked' ? 'text-red-400' : 'text-slate-400'}`}>●</span>
              <div>
                <span className="text-slate-300 font-medium">{s.stage}:</span>{' '}
                <span className="text-slate-400">{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}