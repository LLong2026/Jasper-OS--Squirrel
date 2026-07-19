import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Orbit, Play, Loader2, ShieldCheck, ShieldAlert, Activity, Gauge, Layers,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ALL_OPERATORS, OPERATOR_META, sha256Hex, bitHamming, jaccardDistance,
  unpairedOperators, classifyDrift,
} from '@/lib/holonomy';

const THRESHOLD = 0.5;

// Derive the active topological operator set + substrate counts from live system state.
async function deriveTopology() {
  const [
    collabs, policies, toolbelts, memories, thoughts,
    knowledge, codeVersions, improvements, signals, audits,
  ] = await Promise.all([
    base44.entities.AgentCollaboration.list().catch(() => []),
    base44.entities.SystemPolicy.list().catch(() => []),
    base44.entities.AgentToolbelt.list().catch(() => []),
    base44.entities.GlobalMemory.list().catch(() => []),
    base44.entities.CollectiveThought.list().catch(() => []),
    base44.entities.KnowledgeNode.list().catch(() => []),
    base44.entities.CodeVersion.list().catch(() => []),
    base44.entities.ImprovementProposal.list().catch(() => []),
    base44.entities.LearningSignal.list().catch(() => []),
    base44.entities.AuditLog.list().catch(() => []),
  ]);

  const counts = {
    collabs: collabs.length, policies: policies.length, toolbelts: toolbelts.length,
    memories: memories.length, thoughts: thoughts.length, knowledge: knowledge.length,
    codeVersions: codeVersions.length, improvements: improvements.length,
    signals: signals.length, audits: audits.length,
  };

  const active = ['functor']; // reconstruction is foundational
  if (counts.collabs) active.push('boundary');
  if (counts.policies) active.push('cohomology');
  if (counts.toolbelts) active.push('sheaf');
  if (counts.memories) active.push('gauge');
  if (counts.thoughts) active.push('wavepacket');
  if (counts.knowledge) active.push('topology');
  if (counts.codeVersions) active.push('teleport');
  if (counts.improvements) active.push('hamiltonian');
  if (counts.signals) active.push('drift');
  if (counts.audits) active.push('holonomy');

  return { active, counts };
}

const STATUS_STYLE = {
  continuous: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  drifted: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  broken: 'bg-red-500/15 text-red-300 border-red-500/40',
};

function SummaryCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

export default function AuditHolonomyDashboard() {
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await base44.entities.AuditHolonomy.list('-created_date', 50);
      setCycles(recs);
    } catch (e) {
      console.error('load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAudit = async () => {
    setRunning(true);
    try {
      const { active, counts } = await deriveTopology();
      const parent = cycles[0];
      const cycleId = `cycle-${Date.now()}`;
      const topologyHash = await sha256Hex([...active].sort().join('|'));
      const substrateNonce = `${JSON.stringify(counts)}-${Date.now()}`;
      const invariantHash = await sha256Hex(`${topologyHash}|${substrateNonce}`);
      const drift = parent ? jaccardDistance(active, parent.active_operators || []) : 0;
      const substrateDrift = parent ? bitHamming(invariantHash, parent.invariant_hash) : 0;
      const violations = unpairedOperators(active);
      const pass = violations.length === 0;
      const status = classifyDrift(drift, THRESHOLD);

      await base44.entities.AuditHolonomy.create({
        cycle_id: cycleId,
        invariant_hash: invariantHash,
        topology_hash: topologyHash,
        parent_hash: parent?.invariant_hash || '',
        drift_score: drift,
        substrate_drift: substrateDrift,
        continuity_status: status,
        holonomy_pass: pass,
        holonomy_group: pass ? 'identity' : 'violation',
        active_operators: active,
        violations,
        threshold: THRESHOLD,
      });
      await load();
    } catch (e) {
      console.error('audit error', e);
    } finally {
      setRunning(false);
    }
  };

  const chrono = [...cycles].reverse();
  const latest = cycles[0];
  const breaks = cycles.filter((c) => c.continuity_status !== 'continuous').length;
  const integrity = cycles.length
    ? Math.round((cycles.filter((c) => c.holonomy_pass).length / cycles.length) * 100)
    : 0;
  const chartData = chrono.map((c, i) => ({
    cycle: i + 1,
    substrate: Number((c.substrate_drift || 0).toFixed(3)),
    topology: Number((c.drift_score || 0).toFixed(3)),
  }));
  const activeSet = new Set(latest?.active_operators || []);
  const violationSet = new Set(latest?.violations || []);

  return (
    <div className="min-h-screen text-white" style={{ background: '#0B0E14' }}>
      <header className="border-b border-white/10 px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Orbit className="h-4 w-4 text-violet-400" />
              <span className="text-[11px] font-mono tracking-widest text-violet-400/80">OPERATOR §10 · Hol(γ) ∈ G</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Holonomy</h1>
            <p className="text-white/50 text-sm mt-0.5">
              Track system drift and ensure topological continuity across execution cycles.
            </p>
          </div>
          <Button
            onClick={runAudit}
            disabled={running}
            size="lg"
            className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-semibold px-6 h-10"
          >
            {running ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            {running ? 'Auditing…' : 'Run Holonomy Audit'}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Activity} label="Cycles Audited" value={cycles.length} accent="text-blue-400" />
          <SummaryCard icon={Gauge} label="Latest Drift" value={latest ? `${(latest.drift_score || 0).toFixed(3)}` : '—'} accent="text-amber-400" />
          <SummaryCard icon={ShieldAlert} label="Continuity Breaks" value={breaks} accent="text-red-400" />
          <SummaryCard icon={ShieldCheck} label="Holonomy Integrity" value={`${integrity}%`} accent="text-emerald-400" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        ) : cycles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-16 text-center">
            <Layers className="h-10 w-10 text-white/30 mx-auto mb-3" />
            <p className="text-white/60">No audit cycles recorded yet.</p>
            <p className="text-white/40 text-sm mt-1">Run a holonomy audit to capture the first invariant snapshot.</p>
          </div>
        ) : (
          <>
            {/* Drift trend */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-white/80">Drift Trend Across Cycles</span>
                <span className="ml-auto text-xs text-white/40 font-mono">Δ(Ψ, Φ, K)</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="cycle" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <YAxis domain={[0, 1]} stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="substrate" name="Substrate Drift" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="topology" name="Topological Drift" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Active operators (latest cycle) */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Orbit className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-medium text-white/80">Active Operator Loop — Cycle {cycles.length}</span>
                <span className={`ml-auto text-xs px-2 py-1 rounded-full border ${latest.holonomy_pass ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-red-500/15 text-red-300 border-red-500/40'}`}>
                  Hol(γ) = {latest.holonomy_group}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {ALL_OPERATORS.map((op) => {
                  const meta = OPERATOR_META[op];
                  const isActive = activeSet.has(op);
                  const isViolation = violationSet.has(op);
                  return (
                    <div
                      key={op}
                      className={`rounded-xl border p-3 text-center transition-colors ${
                        isViolation ? 'border-red-500/50 bg-red-500/10' :
                        isActive ? 'border-violet-500/40 bg-violet-500/10' :
                        'border-white/10 bg-white/[0.02] opacity-40'
                      }`}
                    >
                      <div className="text-lg font-mono">{meta.glyph}</div>
                      <div className="text-[10px] text-white/60 mt-0.5">{meta.label}</div>
                      {isViolation && <div className="text-[9px] text-red-400 mt-1">unpaired</div>}
                    </div>
                  );
                })}
              </div>
              {!latest.holonomy_pass && latest.violations?.length > 0 && (
                <p className="text-xs text-red-300 mt-4">
                  Open loop — unpaired operators: {latest.violations.map((v) => OPERATOR_META[v]?.glyph).join(', ')}.
                  Topology is not continuous; the loop does not return to identity.
                </p>
              )}
            </div>

            {/* Cycle history */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 text-sm font-medium text-white/80">Cycle History</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-white/40 text-xs">
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-2 font-medium">#</th>
                      <th className="text-left px-5 py-2 font-medium">Cycle</th>
                      <th className="text-left px-5 py-2 font-medium">Invariant Hash</th>
                      <th className="text-right px-5 py-2 font-medium">Drift</th>
                      <th className="text-right px-5 py-2 font-medium">Substrate</th>
                      <th className="text-center px-5 py-2 font-medium">Continuity</th>
                      <th className="text-center px-5 py-2 font-medium">Holonomy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map((c, idx) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-white/40 font-mono">{cycles.length - idx}</td>
                        <td className="px-5 py-3 text-white/70 font-mono text-xs">{c.cycle_id?.slice(-8)}</td>
                        <td className="px-5 py-3 text-white/50 font-mono text-xs">{c.invariant_hash?.slice(0, 16)}…</td>
                        <td className="px-5 py-3 text-right text-amber-300 font-mono">{(c.drift_score || 0).toFixed(3)}</td>
                        <td className="px-5 py-3 text-right text-blue-300 font-mono">{(c.substrate_drift || 0).toFixed(3)}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLE[c.continuity_status] || STATUS_STYLE.continuous}`}>
                            {c.continuity_status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {c.holonomy_pass
                            ? <ShieldCheck className="h-4 w-4 text-emerald-400 mx-auto" />
                            : <ShieldAlert className="h-4 w-4 text-red-400 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}