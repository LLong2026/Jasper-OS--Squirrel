import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BridgePipelineFlow from '@/components/bridge/BridgePipelineFlow';
import RailMesh from '@/components/bridge/RailMesh';
import SettlementAlerts from '@/components/bridge/SettlementAlerts';
import {
  Radio, Send, RefreshCw, Activity, ShieldCheck, Hash, FileText, Link2, Boxes, Copy,
} from 'lucide-react';

const POLL_MS = 5000;
const STAGE_KEYS = ['canonical', 'semantic', 'threadzero', 'stack', 'taproot', 'rails', 'settlement'];

export default function BridgeVisualizer() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeStage, setActiveStage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Test message form
  const [debtor, setDebtor] = useState('TexasSovereignFund');
  const [creditor, setCreditor] = useState('FederalReserveBank');
  const [amount, setAmount] = useState('1000000');
  const [currency, setCurrency] = useState('USD');

  const fetchSettlements = useCallback(async () => {
    try {
      const logs = await base44.entities.AuditLog.filter(
        { record_type: 'urib_settlement' },
        '-timestamp',
        30
      ).catch(() => base44.entities.AuditLog.list('-timestamp', 30));
      setSettlements(logs || []);
    } catch (e) {
      // silent — keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
    const interval = setInterval(fetchSettlements, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchSettlements]);

  const runBridge = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    setActiveStage(null);

    // Animate pipeline stages
    for (let i = 0; i < STAGE_KEYS.length; i++) {
      setActiveStage(STAGE_KEYS[i]);
      await new Promise((r) => setTimeout(r, 350));
    }

    try {
      const res = await base44.functions.invoke('universalBridge', {
        action: 'orchestrate',
        raw_doc: {
          message_id: `URIB${Date.now()}`,
          debtor,
          creditor,
          amount: parseFloat(amount),
          currency,
        },
        actor: 'bridge_visualizer',
        rails: ['ISO', 'BTC', 'XRP', 'CBDC'],
      });
      setResult(res);
      setActiveStage('settlement');
      await fetchSettlements();
    } catch (e) {
      setError(e.message || 'Bridge orchestration failed');
    } finally {
      setRunning(false);
      setActiveStage(null);
    }
  };

  const copyHash = (val) => {
    navigator.clipboard?.writeText(val);
  };

  const totalValue = settlements.reduce((sum, s) => {
    const data = s.event_data ? JSON.parse(s.event_data) : {};
    return sum;
  }, 0);

  return (
    <div className="min-h-screen text-white" style={{ background: '#0B0E14' }}>
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Radio className="h-4 w-4 text-blue-400" />
              <span className="text-[11px] font-mono tracking-widest text-blue-400/80">URIB · ISO 20022 BRIDGE MONITOR</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Bridge Visualizer</h1>
            <p className="text-white/50 text-sm mt-0.5">Live ISO 20022 message flow across the URIB mesh</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchSettlements} className="border-white/20 bg-white/5 text-white/70 hover:text-white hover:bg-white/10">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        <SettlementAlerts />
        {/* Pipeline flow */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-white/80">7-Stage URIB Pipeline</span>
          </div>
          <BridgePipelineFlow activeStage={activeStage} result={result} />
        </div>

        {/* Test message + Rail mesh */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send test message */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-white/80">Send Test ISO 20022 Message</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-white/40 font-mono">Debtor</label>
                <Input value={debtor} onChange={(e) => setDebtor(e.target.value)} className="bg-white/5 border-white/15 text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-white/40 font-mono">Creditor</label>
                <Input value={creditor} onChange={(e) => setCreditor(e.target.value)} className="bg-white/5 border-white/15 text-white" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-mono">Amount</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white/5 border-white/15 text-white" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-mono">Currency</label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="bg-white/5 border-white/15 text-white" />
              </div>
            </div>
            <Button
              onClick={runBridge}
              disabled={running}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
            >
              <Send className="mr-2 h-4 w-4" />
              {running ? 'Orchestrating…' : 'Run Full Bridge'}
            </Button>
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
            )}
          </div>

          {/* Rail mesh status */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Boxes className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-white/80">Cross-Rail Mesh Status</span>
            </div>
            <RailMesh
              railStates={result?.rail_states}
              crossRailPass={result?.cross_rail_invariants_pass}
            />
          </div>
        </div>

        {/* Result proofs */}
        {result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Bridge Settlement Complete — Cryptographic Proofs</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: FileText, label: 'Document Hash (h_D)', value: result.h_doc },
                { icon: Link2, label: 'Semantic Hash (h_G)', value: result.h_sem },
                { icon: Hash, label: 'ThreadZero Anchor (T*)', value: result.thread_anchor },
                { icon: ShieldCheck, label: 'Stack Commitment (C_stack)', value: result.c_stack },
              ].map((p) => (
                <div key={p.label} className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                  <p.icon className="h-4 w-4 text-emerald-400/70 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/50 font-mono">{p.label}</div>
                    <div className="text-xs font-mono text-white/80 truncate">{p.value}</div>
                  </div>
                  <button onClick={() => copyHash(p.value)} className="text-white/30 hover:text-white/70 shrink-0">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {result.iso20022_messages?.[0] && (
              <details className="rounded-lg bg-black/30 px-3 py-2">
                <summary className="text-xs font-mono text-blue-300 cursor-pointer">ISO 20022 pacs.008 Message</summary>
                <pre className="text-[10px] font-mono text-white/60 mt-2 overflow-x-auto">
                  {JSON.stringify(result.iso20022_messages[0], null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Settlement history */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white/80">Settlement History</span>
            <span className="ml-auto text-xs text-white/40 font-mono">{settlements.length} records · auto-refresh 5s</span>
          </div>
          {loading ? (
            <div className="text-center py-10 text-white/30 text-sm">Loading settlements…</div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">
              No URIB settlements yet. Run the bridge above to send your first ISO 20022 message.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {settlements.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02]">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80">{s.actor || 'unknown'}</span>
                      <span className="text-xs text-white/30 font-mono">
                        {new Date(s.timestamp || s.created_at || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.rails?.map((r) => (
                        <span key={r} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                          {r}
                        </span>
                      ))}
                      <span className="text-[10px] font-mono text-white/30 truncate">{s.c_stack?.slice(0, 20)}…</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-white/40 font-mono">{s.event_count || 0} events</div>
                    <div className="text-[10px] text-emerald-400/60 font-mono">settled</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}