import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle, Loader2, Play } from 'lucide-react';

export default function DslEditor({ dsl, setDsl, projectId, setProjectId, onCompile, compiling, warnings, errors }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="project_id (token identifier)"
            className="bg-slate-800/60 border-slate-700 text-slate-100"
          />
        </div>
        <Button onClick={onCompile} disabled={compiling || !dsl.trim()} className="bg-blue-600 hover:bg-blue-500">
          {compiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Compile & Anchor
        </Button>
      </div>

      <Textarea
        value={dsl}
        onChange={(e) => setDsl(e.target.value)}
        spellCheck={false}
        className="flex-1 min-h-[360px] font-mono text-xs bg-slate-950/70 border-slate-700 text-emerald-300 resize-none leading-relaxed"
      />

      {errors && errors.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{errors.join('; ')}</div>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {warnings && warnings.length === 0 && errors && errors.length === 0 && !compiling && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle className="h-4 w-4" /> Spec passed safety checks
        </div>
      )}
    </div>
  );
}