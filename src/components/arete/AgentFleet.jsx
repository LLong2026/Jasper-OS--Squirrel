import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cpu, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

const DOMAIN_COLORS = {
  learning: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  knowledge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  reasoning: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  engineering: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  safety: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  orchestration: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  quality: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

export default function AgentFleet({ fleet, agentResults }) {
  const resultMap = {};
  if (agentResults) agentResults.forEach(r => { resultMap[r.agent] = r; });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
        <Cpu className="h-4 w-4 text-violet-400" />
        Real Agent Fleet
        <span className="text-xs text-slate-500 font-normal">({fleet?.length || 0} live functions)</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
        {fleet?.map((agent) => {
          const result = resultMap[agent.name];
          const isInvoked = !!result;
          return (
            <Card key={agent.name} className={`bg-slate-900/80 border-slate-800 transition-all ${isInvoked ? 'ring-1 ring-violet-500/40' : 'opacity-60'}`}>
              <CardContent className="p-2.5">
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <span className="text-xs font-medium text-slate-200 truncate">{agent.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isInvoked && (result.success ?
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> :
                      <XCircle className="h-3.5 w-3.5 text-red-400" />)}
                    <Badge variant="outline" className={`text-[9px] px-1 ${DOMAIN_COLORS[agent.domain] || ''}`}>
                      {agent.domain}
                    </Badge>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-1 leading-tight">{agent.description}</p>
                <div className="flex items-center justify-between text-[9px] text-slate-600">
                  <span className="font-mono truncate">fn: {agent.function_name}</span>
                  {result && (
                    <span className="flex items-center gap-0.5 text-slate-400 shrink-0">
                      <Clock className="h-2.5 w-2.5" /> {result.execution_ms}ms
                    </span>
                  )}
                </div>
                {result && result.success && result.result != null && (
                  <div className="mt-1 text-[9px] text-slate-400 bg-slate-950 rounded p-1 max-h-12 overflow-y-auto leading-tight">
                    {typeof result.result === 'string' ? result.result.substring(0, 120) : JSON.stringify(result.result).substring(0, 120)}
                  </div>
                )}
                {result && !result.success && (
                  <div className="mt-1 text-[9px] text-red-400 truncate">{result.error?.substring(0, 80)}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {agentResults && agentResults.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-400" /> {agentResults.filter(r => r.success).length} executed</span>
          {agentResults.filter(r => !r.success).length > 0 && (
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-400" /> {agentResults.filter(r => !r.success).length} failed</span>
          )}
        </div>
      )}
    </div>
  );
}