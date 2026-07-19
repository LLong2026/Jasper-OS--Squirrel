import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ChatPage from '@/pages/Chat';
import IdentityPanel from '@/components/swarm/IdentityPanel';
import SwarmPanel from '@/components/swarm/SwarmPanel';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { Network, Fingerprint, Workflow, X } from 'lucide-react';

export default function SwarmConsole() {
  const [panelOpen, setPanelOpen] = useState(false);
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
    <div className="relative h-screen overflow-hidden bg-slate-900 text-slate-100">
      {/* Main chat interface */}
      <ChatPage />

      {/* Side panel toggle */}
      <button
        onClick={() => setPanelOpen(true)}
        className={`fixed right-4 bottom-24 z-30 p-3 rounded-full bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-900/40 transition-all ${panelOpen ? 'scale-0' : 'scale-100'}`}
        title="Swarm & Identity controls"
      >
        <Network className="h-5 w-5 text-white" />
        {(swarm || identities.length > 0) && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
        )}
      </button>

      {/* Side panel drawer */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="fixed right-0 top-0 h-full w-80 lg:w-96 bg-slate-900 border-l border-slate-800 z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-cyan-400" />
                <div>
                  <h2 className="text-base font-bold">Swarm Console</h2>
                  <p className="text-[11px] text-slate-500">Identity & orchestration</p>
                </div>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
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
            </div>
          </aside>
        </>
      )}
    </div>
  );
}