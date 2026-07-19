import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Hash } from 'lucide-react';

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function AuditTrailView({ trail, loading }) {
  return (
    <Card className="p-4 bg-slate-800/40 border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <History className="h-3.5 w-3.5" /> Audit Trail
        </div>
        <Badge variant="outline" className="border-slate-600 text-slate-400">{trail.length} actions</Badge>
      </div>

      {loading ? (
        <div className="text-slate-500 text-xs py-4 text-center">Loading…</div>
      ) : trail.length === 0 ? (
        <div className="text-slate-500 text-xs py-4 text-center">No actions logged yet</div>
      ) : (
        <ScrollArea className="h-[200px] pr-2">
          <div className="space-y-2">
            {trail.map((entry, i) => (
              <div key={i} className="rounded-md border border-slate-700/60 bg-slate-900/40 p-2.5 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={entry.action_type === 'mint' ? 'default' : 'destructive'} className={entry.action_type === 'mint' ? 'bg-blue-600' : ''}>
                    {entry.action_type}
                  </Badge>
                  <span className="text-slate-400">{entry.params?.token_name} · {entry.params?.amount?.toLocaleString()}</span>
                  <span className="ml-auto text-slate-500">{fmtTime(entry.timestamp)}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 font-mono">
                  <Hash className="h-3 w-3" /> {entry.log_hash?.slice(0, 24)}…
                  <span className="ml-2 text-slate-400">by {entry.approved_by}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}