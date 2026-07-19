import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, Loader2, Zap, Flame } from 'lucide-react';

export default function ActionPanel({ tokenNames, onScore, onExecute, scoring, executing, scoreResult, execResult }) {
  const [token, setToken] = useState(tokenNames[0] || '');
  const [actionType, setActionType] = useState('mint');
  const [amount, setAmount] = useState('1000');

  React.useEffect(() => {
    if (tokenNames.length && !tokenNames.includes(token)) setToken(tokenNames[0]);
  }, [tokenNames]);

  const runScore = () => onScore(token, actionType, parseFloat(amount) || 0);
  const runExecute = () => onExecute(token, actionType, parseFloat(amount) || 0);

  return (
    <Card className="p-4 bg-slate-800/40 border-slate-700 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Zap className="h-3.5 w-3.5" /> Policy Action
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="bg-slate-900/70 border border-slate-700 rounded-md text-xs px-2 py-2 text-slate-100 col-span-1"
        >
          {tokenNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="bg-slate-900/70 border border-slate-700 rounded-md text-xs px-2 py-2 text-slate-100 col-span-1"
        >
          <option value="mint">mint</option>
          <option value="burn">burn</option>
        </select>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-slate-900/70 border-slate-700 text-slate-100 col-span-1 text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={runScore} disabled={scoring || !token} variant="outline" className="flex-1 border-slate-600 text-slate-200 hover:bg-slate-700">
          {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Score
        </Button>
        <Button onClick={runExecute} disabled={executing || !token} className="flex-1 bg-blue-600 hover:bg-blue-500">
          {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : actionType === 'mint' ? <Zap className="h-4 w-4" /> : <Flame className="h-4 w-4" />} Execute
        </Button>
      </div>

      {scoreResult && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            {scoreResult.requires_approval ? (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            )}
            <Badge variant={scoreResult.decision === 'ALLOW' ? 'default' : 'destructive'} className={scoreResult.decision === 'ALLOW' ? 'bg-emerald-600' : ''}>
              {scoreResult.decision}
            </Badge>
            <span className="text-slate-400">confidence {((scoreResult.confidence || 0) * 100).toFixed(0)}%</span>
            {scoreResult.requires_approval && <Badge variant="outline" className="border-amber-500/50 text-amber-300">approval required</Badge>}
          </div>
          {scoreResult.explanation?.length > 0 && (
            <ul className="list-disc list-inside text-slate-400 space-y-0.5">
              {scoreResult.explanation.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {execResult && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Executed
          </div>
          <div className="text-slate-400">tx: <span className="font-mono text-slate-200">{execResult.transaction_id}</span></div>
          {execResult.result?.new_state && (
            <div className="text-slate-400">
              supply: <span className="text-slate-200">{execResult.result.new_state.circulating_supply?.toLocaleString()}</span>
              {' · '}minted <span className="text-slate-200">{execResult.result.new_state.minted?.toLocaleString()}</span>
              {' · '}burned <span className="text-slate-200">{execResult.result.new_state.burned?.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}