import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Workflow, Plus, Loader2, Play, CheckCircle2, Zap, ListChecks, GitMerge } from 'lucide-react';

const STEPS = [
  { key: 'decompose_goal', label: 'Decompose', icon: ListChecks, action: 'decompose_goal' },
  { key: 'dispatch_tasks', label: 'Dispatch', icon: Play, action: 'dispatch_tasks' },
  { key: 'collect_results', label: 'Collect', icon: Zap, action: 'collect_results' },
  { key: 'reach_consensus', label: 'Consensus', icon: GitMerge, action: 'reach_consensus' }
];

export default function SwarmPanel({ identities, onSwarmCreated }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [swarm, setSwarm] = useState(null);
  const [tasks, setTasks] = useState([]);
  const { toast } = useToast();

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
        toast({ title: res.data.reached ? 'Consensus reached' : 'No consensus', description: res.data.result_summary });
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

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Workflow className="h-5 w-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-slate-100">Swarm Orchestration</h2>
      </div>

      {!swarm ? (
        <div className="space-y-3">
          <div>
            <Label className="text-slate-400 text-xs">Swarm Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="V2 Foundation Swarm" className="bg-slate-950/60 border-slate-700 text-slate-100" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Goal</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Design the foundational architecture for Jasper V2..." className="bg-slate-950/60 border-slate-700 text-slate-100 min-h-[70px]" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Select Members ({selected.length})</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {identities.length === 0 && <p className="text-slate-500 text-sm">Mint identities first.</p>}
              {identities.map((id) => (
                <button
                  key={id.id}
                  onClick={() => toggle(id.did)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${selected.includes(id.did) ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600'}`}
                >
                  <p className="font-medium truncate">{id.display_name || id.agent_name}</p>
                  <p className="text-xs font-mono text-slate-500 truncate">{id.did}</p>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={busy} className="w-full bg-violet-600 hover:bg-violet-500">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Form Swarm
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-100 font-medium">{swarm.name}</p>
                <p className="text-xs text-slate-500 font-mono">{swarm.swarm_id}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${swarm.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : swarm.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-violet-500/15 text-violet-400'}`}>
                {swarm.status}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-2">{swarm.goal}</p>
            {swarm.result_summary && (
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {swarm.result_summary}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {STEPS.map((s) => (
              <Button key={s.key} variant="outline" onClick={() => runStep(s.action)} disabled={busy} className="border-slate-700 text-slate-300">
                <s.icon className="h-4 w-4" /> {s.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {tasks.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Run "Decompose" to generate tasks.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-slate-100 font-medium truncate">
                      <span className="text-slate-600 mr-1">#{t.order + 1}</span> {t.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{t.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${t.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : t.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-700 text-slate-300'}`}>
                    {t.status}
                  </span>
                </div>
                {t.result && (
                  <p className="text-xs text-cyan-400 mt-2">{t.result.output}</p>
                )}
              </div>
            ))}
          </div>

          <Button variant="ghost" onClick={() => { setSwarm(null); setTasks([]); }} className="text-slate-400 w-full">
            Start a new swarm
          </Button>
        </div>
      )}
    </div>
  );
}