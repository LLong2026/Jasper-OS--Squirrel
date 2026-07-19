import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wand2, Check, X, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';

const TYPE_COLORS = {
  hyperparameter_tuning: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  data_augmentation: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  feature_engineering: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  architecture_search: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  prompt_refinement: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const STATUS_COLORS = {
  proposed: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  evaluating: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  executing: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export default function OptimizationProposals({ proposals, onGenerate, onApprove, onReject, generating }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Self-Optimization Proposals</h3>
        <Button size="sm" variant="outline" onClick={onGenerate} disabled={generating}
          className="border-slate-700 text-slate-300 hover:bg-slate-800">
          {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
          Generate Proposals
        </Button>
      </div>

      {!proposals || proposals.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No proposals yet. Click "Generate Proposals" to let agents analyze metrics and suggest training optimizations.
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {proposals.map((p) => (
            <Card key={p.id} className="bg-slate-900/80 border-slate-800">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[p.optimization_type] || ''}`}>
                      {p.optimization_type?.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[p.status] || ''}`}>
                      {p.status}
                    </Badge>
                    {p.risk_level && p.risk_level !== 'medium' && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> {p.risk_level} risk
                      </span>
                    )}
                  </div>
                  {(p.status === 'proposed' || p.status === 'evaluating') && (
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-xs"
                        onClick={() => onApprove(p.id)}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                        onClick={() => onReject(p.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {p.proposed_changes && (
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500 font-medium">Changes: </span>
                    {Object.entries(p.proposed_changes).map(([k, v]) =>
                      `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
                    ).join(', ').substring(0, 200)}
                  </div>
                )}

                {p.status === 'completed' && p.actual_results && (
                  <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-800">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      Impact: {(p.impact_score || 0).toFixed(1)}%
                    </span>
                    <span className="text-slate-400">
                      Acc: {((p.actual_results.actual_accuracy_before || 0) * 100).toFixed(1)}% → {((p.actual_results.actual_accuracy_after || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}