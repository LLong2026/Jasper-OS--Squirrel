import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, GitBranch, Hash, Anchor, FileCode } from 'lucide-react';

function TokenCard({ name, token }) {
  return (
    <Card className="p-3 bg-slate-800/40 border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-blue-400" />
          <span className="font-mono font-semibold text-slate-100">{name}</span>
        </div>
        <Badge variant="outline" className="border-slate-600 text-slate-300">{token.type}</Badge>
      </div>
      <div className="space-y-1 text-xs text-slate-400">
        {token.supply && (
          <div>supply: <span className="text-slate-200">{token.supply.type}{token.supply.cap ? ` · cap ${token.supply.cap.toLocaleString()}` : ''}</span></div>
        )}
        {token.mint_rules && (
          <div>mint: <span className="text-slate-200">{token.mint_rules.requires_approval ? 'approval required' : 'open'}{token.mint_rules.threshold ? ` · threshold ${token.mint_rules.threshold.toLocaleString()}` : ''}</span></div>
        )}
        {token.burn_rules && (
          <div>burn: <span className="text-slate-200">{token.burn_rules.raw}</span></div>
        )}
        {token.governance && (
          <div>gov: <span className="text-slate-200">{token.governance.raw}</span></div>
        )}
      </div>
    </Card>
  );
}

export default function ValidatorsView({ validators, manifest }) {
  if (!validators) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm py-12">
        Compile a spec to see runtime validators
      </div>
    );
  }

  const tokenNames = Object.keys(validators.tokens || {});
  const flows = validators.flows || [];

  return (
    <div className="flex flex-col gap-4">
      {manifest && (
        <Card className="p-3 bg-slate-800/40 border-slate-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {manifest.dsl_source_hash?.slice(0, 16)}…</span>
            {manifest.anchor_cid && <span className="flex items-center gap-1"><Anchor className="h-3 w-3" /> {manifest.anchor_cid.slice(0, 20)}…</span>}
            <span>v{manifest.version}</span>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Coins className="h-3.5 w-3.5" /> Tokens ({tokenNames.length})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tokenNames.map((n) => <TokenCard key={n} name={n} token={validators.tokens[n]} />)}
        </div>
      </div>

      {flows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <GitBranch className="h-3.5 w-3.5" /> Flows ({flows.length})
          </div>
          <div className="space-y-1">
            {flows.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-800/30 rounded px-2 py-1.5">
                <FileCode className="h-3 w-3 text-amber-400" />
                <span className="text-amber-300">{f.from}</span>
                <span className="text-slate-500">→</span>
                <span className="text-emerald-300">{f.to}</span>
                <span className="text-slate-500 ml-auto">{f.amount_expr}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}