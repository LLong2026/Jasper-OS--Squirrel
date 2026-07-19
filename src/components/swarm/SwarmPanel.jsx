import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Loader2, Play, CheckCircle2, Zap, ListChecks, GitMerge } from 'lucide-react';

const STEPS = [
  { label: 'Decompose', icon: ListChecks, action: 'decompose_goal' },
  { label: 'Dispatch', icon: Play, action: 'dispatch_tasks' },
  { label: 'Collect', icon: Zap, action: 'collect_results' },
  { label: 'Consensus', icon: GitMerge, action: 'reach_consensus' }
];

export default function SwarmPanel({ identities, onSwarmCreated, onSwarmChange, embedded = false }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [swarm, setSwarm] = useState(null);
  const [tasks, setTasks] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (onSwarmChange) onSwarmChange(swarm, tasks);
  }, [swarm, tasks, onSwarmChange]);

  const toggle = (did) => {
    setSelected((s) => (s.includes(did) ? s.filter((d) => d !== did) : [...s, did]));
  };

  const create = async () => {
    if (!name.trim() || !goal.trim() || selected.length < 1) {
      toast({ title: 'Name, goal, and at least 1 member required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('swarmOrchestrator', {
        action: 'create_swarm',
        name: name.trim(),
        goal: goal.trim(),
        member_dids: selected,
        topology: 'mesh',
        coordinator_did: selected[0]
      });
      setSwarm(res.data.swarm);
      setTasks([]);
      onSwarmCreated();
      toast({ title: 'Swarm formed', description: res.data.swarm.swarm_id });
    } catch (e) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const runStep = async (action) => {
    if (!swarm) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('swarmOrchestrator', { action, swarm_id: swarm.swarm_id });
      if (action === 'reach_consensus') {
        setSwarm(res.data.swarm);
        toast({ title: res.data.reached ? 'Consensus reached' : 'No consensus', description: res.data.swarm.result_summary });
      }
      const tRes = await base44.functions.invoke('swarmOrchestrator', { action: 'list_tasks', swarm_id: swarm.swarm_id });
      setTasks(tRes.data.tasks);
      if (action === 'decompose_goal') {
        const sRes = await base44.functions.invoke('swarmOrchestrator', { action: 'reach_consensus', swarm_id: swarm.swarm_id });
        setSwarm(sRes.data.swarm);
      }
    } catch (e) {
      toast({ title: 'Step failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const wrapperClass = embedded ? '' : 'bg-slate-900/60 border border-slate-800 rounded-xl p-4';

  return (
    <div className={wrapperClass}>
      {!swarm ? (
        <div className="space-y-2.5">
          <div>
            <Label className="text-slate-400 text-xs">Swarm Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="V2 Foundation Swarm" className="bg-slate-950/60 border-slate-700 text-slate-100 h-8" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Goal</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Design the foundational architecture for Jasper V2..." className="bg-slate-950/60 border-slate-700 text-slate-100 min-h-[60px] text-sm" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Members ({selected.length})</Label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {identities.length === 0 && <p className="text-slate-500 text-xs">Mint identities first.</p>}
              {identities.map((id) => (
                <button
                  key={id.id}
                  onClick={() => toggle(id.did)}
                  className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors ${selected.includes(id.did) ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600'}`}
                >
                  <p className="font-medium truncate">{id.display_name || id.agent_name}</p>
                  <p className="text-[10px] font-mono text-slate-500 truncate">{id.did}</p>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={busy} className="w-full bg-violet-600 hover:bg-violet-500 h-8">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Form Swarm
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-slate-100 text-sm font-medium truncate">{swarm.name}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${swarm.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : swarm.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-violet-500/15 text-violet-400'}`}>{swarm.status}</span>
            </div>
            {swarm.result_summary && (
              <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> {swarm.result_summary}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {STEPS.map((s) => (
              <Button key={s.action} variant="outline" onClick={() => runStep(s.action)} disabled={busy} className="border-slate-700 text-slate-300 h-7 text-xs">
                <s.icon className="h-3 w-3" /> {s.label}
              </Button>
            ))}
          </div>

          <Button variant="ghost" onClick={() => { setSwarm(null); setTasks([]); }} className="text-slate-400 w-full h-7 text-xs">
            New swarm
          </Button>
        </div>
      )}
    </div>
  );
}