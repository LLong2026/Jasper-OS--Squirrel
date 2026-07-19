import React from 'react';
import { Activity, TrendingUp, Zap, Brain, Clock, Target, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function MonitorWidget({ metrics }) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-slate-900/80 border-slate-800 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Learning Signals', value: metrics.total_signals || 0, icon: Brain, color: 'text-blue-400', sub: `${metrics.total_metrics || 0} metrics tracked` },
    { label: 'Pending Proposals', value: metrics.pending_proposals || 0, icon: Activity, color: 'text-amber-400', sub: 'Awaiting review' },
    { label: 'Optimizations Run', value: metrics.completed_optimizations || 0, icon: Zap, color: 'text-emerald-400', sub: `Avg impact: ${(metrics.avg_impact_score || 0).toFixed(1)}%` },
    { label: 'Current Accuracy', value: `${(metrics.current_accuracy || 0).toFixed(1)}%`, icon: Target, color: 'text-violet-400', sub: `${(metrics.current_latency_ms || 0).toFixed(0)}ms latency` },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 font-medium">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span>{metrics.active_patterns || 0} active patterns</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
          <span>{metrics.total_insights || 0} insights generated</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5 text-violet-400" />
          <span>{(metrics.current_latency_ms || 0).toFixed(0)}ms avg loop</span>
        </div>
      </div>
    </div>
  );
}