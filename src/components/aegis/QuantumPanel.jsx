import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Atom, Shield, Loader2, Database, Layers, CheckCircle, AlertTriangle } from 'lucide-react';

export default function QuantumPanel({ metrics, compliance, scanning, onRepair }) {
  const pqcScore = metrics?.pqc_readiness_score ?? 50;
  const vuln = metrics?.vulnerable_crypto_count ?? 0;
  const pqKeys = metrics?.pq_keys ?? 0;
  const vitality = metrics?.chronos_vitality ?? 1;
  const shards = metrics?.shards_healthy || 15;
  const complianceScore = compliance?.compliance_score;
  const violations = compliance?.violations || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 bg-slate-800/40 border-slate-700">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Atom className="h-3.5 w-3.5" /> Quantum Security Status
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">PQC Readiness</span>
              <span className={`font-bold ${pqcScore >= 80 ? 'text-emerald-400' : pqcScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{pqcScore}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pqcScore >= 80 ? 'bg-emerald-500' : pqcScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pqcScore}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-900/40 p-2">
              <div className="text-lg font-bold text-rose-300">{vuln}</div>
              <div className="text-[10px] text-slate-500 uppercase">Vulnerable</div>
            </div>
            <div className="rounded-md bg-slate-900/40 p-2">
              <div className="text-lg font-bold text-emerald-300">{pqKeys}</div>
              <div className="text-[10px] text-slate-500 uppercase">PQ-Native</div>
            </div>
            <div className="rounded-md bg-slate-900/40 p-2">
              <div className="text-lg font-bold text-blue-300">{metrics?.total_keys ?? 0}</div>
              <div className="text-[10px] text-slate-500 uppercase">Total Keys</div>
            </div>
          </div>
          {vuln > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 rounded-md p-2">
              <AlertTriangle className="h-3.5 w-3.5" /> {vuln} ECDSA key(s) vulnerable to quantum attack — Aegis will auto-heal on next pulse
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4 bg-slate-800/40 border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Shield className="h-3.5 w-3.5" /> Quantum Compliance Bot
          </div>
          <Button onClick={onRepair} disabled={scanning} size="sm" className="bg-blue-600 hover:bg-blue-500 h-7 text-xs">
            {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Atom className="h-3 w-3" />} Auto-Repair
          </Button>
        </div>
        {compliance ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Compliance Score:</span>
              <span className={`text-lg font-bold ${complianceScore >= 80 ? 'text-emerald-400' : complianceScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{complianceScore}</span>
              <Badge variant="outline" className="ml-auto capitalize">{compliance.quantum_readiness}</Badge>
            </div>
            {compliance.quantum_recommendation && <div className="text-[11px] text-slate-400 italic">{compliance.quantum_recommendation}</div>}
            {violations.length > 0 && (
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {violations.slice(0, 5).map((v, i) => (
                  <div key={i} className="text-[11px] flex items-start gap-1.5">
                    <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${v.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`} />
                    <span className="text-slate-300">{v.regulation}:</span>
                    <span className="text-slate-500">{v.issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-xs py-4 text-center">Run "Quantum Audit" to scan compliance across HIPAA, GDPR, NIST-PQC, FIPS-204 & more</div>
        )}
      </Card>

      <Card className="p-4 bg-slate-800/40 border-slate-700 lg:col-span-2">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Database className="h-3.5 w-3.5" /> Chronos Daemon — Data Integrity (Erasure Coding)
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Vitality Score</span>
              <span className={`font-bold ${vitality >= 0.67 ? 'text-emerald-400' : vitality >= 0.4 ? 'text-amber-400' : 'text-rose-400'}`}>{Math.round(vitality * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${vitality >= 0.67 ? 'bg-emerald-500' : vitality >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${vitality * 100}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">10 data + 5 parity shards · need any 10 of 15 to rebuild</div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className={`h-8 w-3 rounded-sm ${i < shards ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`} title={`Shard ${i + 1}`} />
            ))}
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">{shards}/15 healthy</Badge>
        </div>
      </Card>
    </div>
  );
}