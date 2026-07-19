import React, { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';

export default function OperatorCard({ op }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(op.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all hover:border-violet-500/50 hover:shadow-[0_0_30px_-10px_rgba(139,92,246,0.5)]">
      {/* Glow accent */}
      <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Glyph */}
          <div className="shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 border border-violet-500/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-violet-300 font-mono">{op.glyph}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                §{op.section}
              </span>
              <code className="text-[11px] text-fuchsia-400/80 font-mono truncate">{op.math}</code>
            </div>
            <h3 className="text-base font-semibold text-slate-100 leading-tight">{op.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{op.subtitle}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-400 leading-relaxed">{op.summary}</p>

        {/* Capabilities */}
        <ul className="mt-4 space-y-1.5">
          {op.capabilities.map((cap, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <span>{cap}</span>
            </li>
          ))}
        </ul>

        {/* Code block */}
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 overflow-hidden">
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {op.glyph} · definition.ts
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); copy(); }}
              className="flex items-center gap-1 text-slate-500 hover:text-violet-300 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
          {open && (
            <pre className="px-3 pb-3 pt-1 overflow-x-auto text-[11px] leading-relaxed text-slate-300 font-mono">
              <code>{op.code}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}