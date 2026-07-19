import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Check, ChevronDown, ChevronRight, Zap } from 'lucide-react';

export const MODELS = [
  // ── Platform models (no API keys — runs on integration credits) ──
  { id: 'auto', name: 'Auto mode', model: 'automatic', provider: 'platform', group: 'Platform', sub: 'Best model per request', icon: 'sparkle' },
  { id: 'base1', name: 'Base 1', model: 'gpt_5_mini', provider: 'platform', group: 'Platform', icon: 'orange' },
  { id: 'gemflash', name: 'Gemini 3 Flash', model: 'gemini_3_flash', provider: 'platform', group: 'Platform', icon: 'gem' },
  { id: 'gempro', name: 'Gemini 3.1 Pro', model: 'gemini_3_1_pro', provider: 'platform', group: 'Platform', icon: 'gem' },
  { id: 'sonnet46', name: 'Sonnet 4.6', model: 'claude_sonnet_4_6', provider: 'platform', group: 'Platform', icon: 'spark' },
  { id: 'opus46', name: 'Opus 4.6', model: 'claude_opus_4_6', provider: 'platform', group: 'Platform', icon: 'spark' },
  { id: 'opus47', name: 'Opus 4.7', model: 'claude_opus_4_7', provider: 'platform', group: 'Platform', icon: 'spark' },
  { id: 'opus48', name: 'Opus 4.8', model: 'claude_opus_4_8', provider: 'platform', group: 'Platform', icon: 'spark' },
  { id: 'sonnet5', name: 'Sonnet 5', model: 'claude-sonnet-5', provider: 'platform', group: 'Platform', icon: 'spark' },
  { id: 'fable5', name: 'Fable 5', model: 'gpt_5_5', provider: 'platform', group: 'Platform', icon: 'spark' },
  { id: 'gpt56terra', name: 'GPT-5.6 Terra', model: 'gpt_5_4', provider: 'platform', group: 'Platform', icon: 'openai', badge: 'New' },
  // ── Free-tier providers (free API key required) ──
  { id: 'groq', name: 'Groq · Llama 3.3 70B', model: 'groq', provider: 'free', free_provider: 'groq_free', group: 'Free tier', icon: 'groq', badge: 'Free' },
  { id: 'together', name: 'Together AI · Llama 3.3 70B', model: 'together', provider: 'free', free_provider: 'together_ai_free', group: 'Free tier', icon: 'together', badge: 'Free' },
  { id: 'hf', name: 'HuggingFace · Llama 3 8B', model: 'huggingface', provider: 'free', free_provider: 'huggingface_inference', group: 'Free tier', icon: 'hf', badge: 'Free' },
];

function ModelGlyph({ m }) {
  if (m.icon === 'orange') return <span className="h-4 w-4 rounded-full bg-orange-500" />;
  if (m.icon === 'openai') return <span className="h-4 w-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600" />;
  if (m.icon === 'gem') return <span className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />;
  if (m.icon === 'groq') return <span className="h-4 w-4 rounded-full bg-gradient-to-br from-orange-400 to-red-500" />;
  if (m.icon === 'together') return <span className="h-4 w-4 rounded-full bg-gradient-to-br from-slate-400 to-slate-600" />;
  if (m.icon === 'hf') return <span className="h-4 w-4 rounded-full bg-yellow-400" />;
  if (m.icon === 'spark') return <Sparkles className="h-4 w-4 text-violet-500" />;
  return <Sparkles className="h-4 w-4 text-slate-500" />;
}

export default function ModelSelector({ value, onChange, onOpenPreferences }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = MODELS.find((m) => m.id === value) || MODELS[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Group models for display
  const groups = [...new Set(MODELS.map((m) => m.group))];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-10 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-white"
      >
        <ModelGlyph m={current} />
        <span>{current.name}</span>
        <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100">
            Select model
          </div>
          <div className="py-1 max-h-96 overflow-y-auto">
            {groups.map((group) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50/80 flex items-center gap-1">
                  {group === 'Free tier' && <Zap className="h-3 w-3 text-amber-500" />}
                  {group}
                </div>
                {MODELS.filter((m) => m.group === group).map((m) => {
                  const active = m.id === current.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onChange(m.id); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="flex-shrink-0 w-5 flex justify-center"><ModelGlyph m={m} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{m.name}</span>
                          {m.badge && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${m.badge === 'Free' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {m.badge}
                            </span>
                          )}
                        </div>
                        {m.sub && <div className="text-xs text-slate-400 mt-0.5 leading-snug">{m.sub}</div>}
                      </div>
                      {active && <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100">
            <div className="px-3 py-2 text-xs font-medium text-slate-400">Preferences</div>
            <button
              onClick={() => { onOpenPreferences?.(); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-sm font-medium text-slate-900">AI Controls</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}