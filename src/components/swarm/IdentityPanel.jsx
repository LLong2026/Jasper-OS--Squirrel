import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Fingerprint, Plus, ShieldCheck, RefreshCw, Loader2, KeyRound, Award } from 'lucide-react';

export default function IdentityPanel({ identities, onRefresh }) {
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
        credential: { type: 'swarm_operator', scope: 'orchestration' }
      });
      toast({ title: 'Credential issued', description: did });
      onRefresh();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-slate-100">Agentic Identity Layer</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        <div className="md:col-span-1">
          <Label className="text-slate-400 text-xs">Agent Name</Label>
          <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. SwarmAlpha" className="bg-slate-950/60 border-slate-700 text-slate-100" />
        </div>
        <div className="md:col-span-1">
          <Label className="text-slate-400 text-xs">Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alpha Coordinator" className="bg-slate-950/60 border-slate-700 text-slate-100" />
        </div>
        <div className="md:col-span-1 flex items-end">
          <Button onClick={mint} disabled={busy} className="w-full bg-cyan-600 hover:bg-cyan-500">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Mint DID
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {identities.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">No identities yet. Mint one above.</p>
        )}
        {identities.map((id) => (
          <div key={id.id} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-slate-100 font-medium truncate">{id.display_name || id.agent_name}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{id.did}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full ${id.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {id.status}
                </span>
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> {id.trust_score ?? 50}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <KeyRound className="h-3 w-3" />
                <span className="font-mono truncate max-w-[12rem]">{id.public_key}</span>
                <span className="text-slate-600">·</span>
                <span className="font-mono">{id.truth_chain_anchor}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => issueCredential(id.did)} disabled={busy} className="border-slate-700 text-slate-300">
                <Award className="h-3 w-3" /> Credential
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}