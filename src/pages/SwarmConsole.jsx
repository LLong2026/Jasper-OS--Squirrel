import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import IdentityPanel from '@/components/swarm/IdentityPanel';
import SwarmPanel from '@/components/swarm/SwarmPanel';
import { Users, Network } from 'lucide-react';

export default function SwarmConsole() {
  const [identities, setIdentities] = useState([]);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-slate-800">
            <Network className="h-7 w-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Swarm Console</h1>
            <p className="text-sm text-slate-400">Multi-agent swarm orchestration with DID-based identities</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IdentityPanel identities={identities} onRefresh={loadIdentities} />
            <SwarmPanel identities={identities} onSwarmCreated={loadIdentities} />
          </div>
        )}
      </div>
    </div>
  );
}