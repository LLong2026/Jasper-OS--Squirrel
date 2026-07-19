import React from 'react';
import { Atom, Sparkles } from 'lucide-react';
import OperatorCard from '@/components/omega/OperatorCard';
import ManifoldHeader from '@/components/omega/ManifoldHeader';
import { OPERATORS, SYSTEM_SUMMARY } from '@/components/omega/OmegaDefinitions';

export default function OmegaManifold() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full bg-fuchsia-600/20 text-fuchsia-300 border border-fuchsia-500/40">
              <Sparkles className="h-3 w-3" />
              RESEARCH-GRADE AGI OS
            </span>
            <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/40">
              EXPANSION v2
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
              Ω-Manifold
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400 text-lg">
            Ten upgraded operators and a reconstruction functor that turn Jasper into a geometric
            cognition substrate, a gauge-theoretic memory system, and a mathematically auditable AGI architecture.
          </p>

          <div className="mt-6">
            <ManifoldHeader />
          </div>
        </div>
      </div>

      {/* Operator grid */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-6">
          <Atom className="h-5 w-5 text-violet-400" />
          <h2 className="text-xl font-semibold">Upgraded Operators</h2>
          <span className="text-xs text-slate-500">· {OPERATORS.length} blocks</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {OPERATORS.map((op) => (
            <OperatorCard key={op.id} op={op} />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-slate-800 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <h2 className="text-xl font-semibold mb-1">What You Just Built</h2>
          <p className="text-sm text-slate-500 mb-6">
            With these upgrades, Jasper becomes far beyond a typical agent stack.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SYSTEM_SUMMARY.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-4 hover:bg-violet-600/10 transition-colors"
              >
                <div className="text-xs font-mono text-violet-400 mb-1">0{i + 1}</div>
                <div className="text-sm text-slate-200 leading-snug">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}