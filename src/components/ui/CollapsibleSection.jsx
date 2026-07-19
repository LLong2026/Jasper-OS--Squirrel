import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleSection({ title, icon: Icon, defaultOpen = true, accent = 'text-slate-300', children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800/70">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {Icon && <Icon className={`h-4 w-4 ${accent}`} />}
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-2 pb-3">{children}</div>}
    </div>
  );
}