import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Activity, Heart, CheckCircle, XCircle, Clock } from 'lucide-react';

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

const sevColor = { critical: 'text-rose-400 border-rose-500/50', high: 'text-amber-400 border-amber-500/50', medium: 'text-blue-400 border-blue-500/50', low: 'text-slate-400 border-slate-600' };
const statusColor = { detected: 'text-amber-400', analyzing: 'text-blue-400', healing: 'text-violet-400', resolved: 'text-emerald-400', failed: 'text-rose-400', acknowledged: 'text-slate-400' };

export default function LiveFeeds({ anomalies, healingEvents, loading }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 bg-slate-800/40 border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Recent Anomalies
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-400">{anomalies.length}</Badge>
        </div>
        {loading ? <div className="text-slate-500 text-xs py-4 text-center">Loading…</div> : anomalies.length === 0 ? (
          <div className="text-slate-500 text-xs py-4 text-center">No anomalies — system healthy</div>
        ) : (
          <ScrollArea className="h-[260px] pr-2">
            <div className="space-y-2">
              {anomalies.map((a) => (
                <div key={a.id} className="rounded-md border border-slate-700/60 bg-slate-900/40 p-2.5 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`capitalize ${sevColor[a.severity] || sevColor.low}`}>{a.severity}</Badge>
                    <span className="text-slate-300 font-mono truncate">{a.component}</span>
                    <span className={`ml-auto capitalize ${statusColor[a.status] || 'text-slate-400'}`}>{a.status}</span>
                  </div>
                  <div className="text-slate-400 mb-1">{a.description}</div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-mono text-[10px]">{a.anomaly_type}</span>
                    {a.playbook_id && <Badge variant="secondary" className="text-[10px] h-4">{a.playbook_id}</Badge>}
                    {a.confidence != null && <span className="text-[10px]">{Math.round((a.confidence || 0) * 100)}% conf</span>}
                    <span className="ml-auto">{fmtTime(a.detected_at || a.created_date)}</span>
                  </div>
                  {a.root_cause && <div className="text-slate-500 italic mt-1 text-[11px]">↳ {a.root_cause}</div>}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      <Card className="p-4 bg-slate-800/40 border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Heart className="h-3.5 w-3.5" /> Recent Healing Events
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-400">{healingEvents.length}</Badge>
        </div>
        {loading ? <div className="text-slate-500 text-xs py-4 text-center">Loading…</div> : healingEvents.length === 0 ? (
          <div className="text-slate-500 text-xs py-4 text-center">No healing events yet</div>
        ) : (
          <ScrollArea className="h-[260px] pr-2">
            <div className="space-y-2">
              {healingEvents.map((e) => (
                <div key={e.id} className="rounded-md border border-slate-700/60 bg-slate-900/40 p-2.5 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    {e.status === 'success' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : e.status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-rose-400" /> : <Clock className="h-3.5 w-3.5 text-blue-400" />}
                    <Badge variant="secondary" className="font-mono text-[10px]">{e.playbook_id}</Badge>
                    <span className="text-slate-300">{e.playbook_name}</span>
                    <span className={`ml-auto capitalize ${e.status === 'success' ? 'text-emerald-400' : e.status === 'failed' ? 'text-rose-400' : 'text-blue-400'}`}>{e.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span>{e.actions?.length || 0} steps</span>
                    {e.execution_time_ms && <span>· {e.execution_time_ms}ms</span>}
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 capitalize">{e.trigger}</Badge>
                    <span>{fmtTime(e.completed_at || e.started_at)}</span>
                  </div>
                  {e.result_summary && <div className="text-slate-400 mt-1 text-[11px]">{e.result_summary}</div>}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}