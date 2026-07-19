import React from 'react';
import { MANIFOLD_PRIMITIVES } from './OmegaDefinitions';

export default function ManifoldHeader() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/40">
          EXISTING STRUCTURE
        </span>
        <span className="text-xs text-slate-500">six primitives compose the Ω-manifold</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {MANIFOLD_PRIMITIVES.map((p) => (
          <div
            key={p.symbol}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center hover:border-violet-500/40 transition-colors"
          >
            <div className="text-3xl font-bold font-mono bg-gradient-to-br from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              {p.symbol}
            </div>
            <div className="text-xs font-medium text-slate-200 mt-1">{p.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}