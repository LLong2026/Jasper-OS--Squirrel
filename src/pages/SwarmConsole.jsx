import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import IdentityPanel from '@/components/swarm/IdentityPanel';
import SwarmPanel from '@/components/swarm/SwarmPanel';
import SwarmPipelineView from '@/components/swarm/SwarmPipelineView';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { Network, Fingerprint, Workflow } from 'lucide-react';

export default function SwarmConsole() {
  const [identities, setIdentities] = useState([]);
  const [swarm, setSwarm] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadIdentities = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('agenticIdentityLayer', { action: 'list' });
      setIdentities(res.data.identities || []);
    } catch (e) {
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIdentities(); }, [loadIdentities]);

  const handleSwarmChange = useCallback((s, t) => {
    setSwarm(s);
    setTasks(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-80 lg:w-96 shrink-0 border-r border-slate-800 bg-slate-900/40 overflow-y-auto h-screen sticky top-0">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-cyan-400" />
            <div>
              <h1 className="text-lg font-bold">Swarm Console</h1>
              <p className="text-[11px] text-slate-500">DID-based orchestration</p>
            </div>
          </div>
        </div>
        <CollapsibleSection title="Identity Layer" icon={Fingerprint} accent="text-cyan-400" defaultOpen>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          ) : (
            <IdentityPanel identities={identities} onRefresh={loadIdentities} embedded />
          )}
        </CollapsibleSection>
        <CollapsibleSection title="Swarm Orchestration" icon={Workflow} accent="text-violet-400" defaultOpen>
          <SwarmPanel
            identities={identities}
            onSwarmCreated={loadIdentities}
            onSwarmChange={handleSwarmChange}
            embedded
          />
        </CollapsibleSection>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <SwarmPipelineView swarm={swarm} tasks={tasks} />
      </main>
    </div>
  );
}