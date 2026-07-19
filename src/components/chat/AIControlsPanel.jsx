import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { MODELS } from '@/components/capabilities/ModelSelector';
import { Cpu, Zap } from 'lucide-react';

export default function AIControlsPanel({
  open,
  onClose,
  preferredModel,
  onModelChange,
  directLLMMode,
  onDirectLLMModeChange,
}) {
  const current = MODELS.find((m) => m.id === preferredModel) || MODELS[0];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-violet-400" />
            AI Controls
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure how Jasper connects to LLMs and orchestrates responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Active model */}
          <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-100">Active model</div>
              <div className="text-xs text-slate-400">{current.sub || 'Manual model selection'}</div>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-slate-950 text-violet-300 border border-violet-500/30">
              {current.name}
            </span>
          </div>

          {/* Direct LLM mode */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-100">Direct LLM mode</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 leading-snug">
                Route responses straight through the selected model. Bypasses agent tools &amp; memory for
                faster, model-direct answers. Turn off to use full Jasper orchestration.
              </div>
            </div>
            <Switch checked={directLLMMode} onCheckedChange={onDirectLLMModeChange} />
          </div>

          {/* Quick model picker */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
            <div className="text-xs font-medium text-slate-400 mb-2">Quick switch</div>
            <div className="flex flex-wrap gap-1.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onModelChange(m.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    m.id === current.id
                      ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                      : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}