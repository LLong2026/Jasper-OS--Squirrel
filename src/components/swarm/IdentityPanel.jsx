import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, ShieldCheck, RefreshCw, Loader2, KeyRound, Award } from 'lucide-react';

export default function IdentityPanel({ identities, onRefresh, embedded = false }) {
  const [agentName, setAgentName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const mint = async () => {
    if (!agentName.trim()) {
      toast({ title: 'Agent name required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('agenticIdentityLayer', {
        action: 'mint_did',
        agent_name: agentName.trim(),
        display_name: displayName.trim() || agentName.trim(),
        governance_profile: { authority_level: 'standard', voting_weight: 1, scope: ['general'] }
      });
      toast({ title: 'Identity minted', description: res.data.identity.did });
      setAgentName('');
      setDisplayName('');
      onRefresh();
    } catch (e) {
      toast({ title: 'Mint failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const issueCredential = async (did) => {
    setBusy(true);
    try {
      await base44.functions.invoke('agenticIdentityLayer', {
        action: 'issue_credential',
        did,
        credential: { type: 'swarm operator', scope: 'orchestration' }
      });
      toast({ title: 'Credential issued', description: did });
      onRefresh();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const wrapperClass = embedded
    ? ''
    : 'bg-slate-900/60 border border-slate-800 rounded-xl p-4';

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Identities</h2>
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 mb-3">
        <div>
          <Label className="text-slate-400 text-xs">Agent Name</Label>
          <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="SwarmAlpha" className="bg-slate-950/60 border-slate-700 text-slate-100 h-8" />
        </div>
        <div>
          <Label className="text-slate-400 text-xs">Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alpha Coordinator" className="bg-slate-950/60 border-slate-700 text-slate-100 h-8" />
        </div>
        <Button onClick={mint} disabled={busy} className="bg-cyan-600 hover:bg-cyan-500 h-8">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Mint DID
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {identities.length === 0 && (
          <p className="text-slate-500 text-xs text-center py-4">No identities yet.</p>
        )}
        {identities.map((id) => (
          <div key={id.id} className="bg-slate-950/50 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-100 text-sm font-medium truncate">{id.display_name || id.agent_name}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${id.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{id.status}</span>
                <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                  <ShieldCheck className="h-3 w-3" />{id.trust_score ?? 50}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate mt-1">{id.did}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-600 font-mono truncate flex items-center gap-1">
                <KeyRound className="h-2.5 w-2.5" />{id.public_key}
              </span>
              <Button variant="outline" size="sm" onClick={() => issueCredential(id.did)} disabled={busy} className="border-slate-700 text-slate-300 h-6 px-2 text-[10px]">
                <Award className="h-2.5 w-2.5" />Cred
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}