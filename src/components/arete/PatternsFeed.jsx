import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, GitBranch, TrendingUp } from 'lucide-react';

export default function PatternsFeed({ patterns, insights }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
          <GitBranch className="h-4 w-4 text-blue-400" /> Detected Patterns
        </h3>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {!patterns || patterns.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No patterns detected yet. Run learning loops to discover recurring behaviors.</p>
          ) : patterns.map((p) => (
            <Card key={p.id} className="bg-slate-900/80 border-slate-800">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-200">{p.name}</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/30">
                    {p.occurrences}× seen
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mb-1">{p.description}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>Confidence: {((p.confidence || 0) * 100).toFixed(0)}%</span>
                  <span>•</span>
                  <span className="capitalize">{p.status}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-amber-400" /> Generated Insights
        </h3>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {!insights || insights.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No insights yet. Complete optimizations to generate actionable insights.</p>
          ) : insights.map((i) => (
            <Card key={i.id} className="bg-slate-900/80 border-slate-800">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-200">{i.title}</span>
                  {i.impact_score > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                      <TrendingUp className="h-3 w-3" /> +{i.impact_score.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{i.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}