import React from 'react';
import { CheckCircle2, Circle, Loader2, ArrowRight } from 'lucide-react';

const STAGES = [
  { key: 'canonical', label: 'Canonical', sub: 'h_D', desc: 'Document tokenization' },
  { key: 'semantic', label: 'Semantic', sub: 'h_G', desc: 'Obligation graph' },
  { key: 'threadzero', label: 'ThreadZero', sub: 'T*', desc: 'Truth chain' },
  { key: 'stack', label: 'Stack', sub: 'C_stack', desc: 'Commitment' },
  { key: 'taproot', label: 'Taproot', sub: 'P′', desc: 'BTC anchor' },
  { key: 'rails', label: 'Rails', sub: 'Φ', desc: 'Cross-rail map' },
  { key: 'settlement', label: 'Settlement', sub: 'ISO 20022', desc: 'pacs.008 emit' },
];

export default function BridgePipelineFlow({ activeStage, result }) {
  const stageIdx = STAGES.findIndex((s) => s.key === activeStage);
  const done = result ? STAGES.length : stageIdx;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STAGES.map((stage, i) => {
        const isDone = i < done || (result && i <= STAGES.length - 1);
        const isActive = !result && i === stageIdx;
        const state = isActive ? 'active' : isDone ? 'done' : 'idle';

        return (
          <React.Fragment key={stage.key}>
            <div
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[110px] border transition-all ${
                state === 'done'
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : state === 'active'
                  ? 'border-amber-400/50 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {state === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : state === 'active' ? (
                  <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-white/20" />
                )}
                <span
                  className={`text-sm font-medium ${
                    state === 'done' ? 'text-emerald-300' : state === 'active' ? 'text-amber-300' : 'text-white/40'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              <span className="text-[10px] font-mono text-white/30">{stage.sub}</span>
              {result && state === 'done' && (
                <span className="text-[9px] text-white/30 text-center leading-tight">{stage.desc}</span>
              )}
            </div>
            {i < STAGES.length - 1 && (
              <ArrowRight
                className={`h-4 w-4 shrink-0 ${
                  i < done ? 'text-emerald-500/50' : 'text-white/10'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}