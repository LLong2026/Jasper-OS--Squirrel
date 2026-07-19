import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Activity, Heart, AlertTriangle, CheckCircle, Zap, Clock, RefreshCw, Atom, Gauge } from 'lucide-react';

export default function AegisHero({ health, scanning, onScan, onForceHeal, onQuantumAudit, onComplianceRepair, busy }) {
  const status = health?.system_status || health?.overall_health || 'healthy';
  const score = health?.health_score ?? 100;
  const critical = (health?.anomalies || []).filter((a) => a.severity === 'critical').length;
  const uptime = Math.min(99.99, 100 - (health?.metrics?.active_anomalies || 0) * 0.1);

  const statusColor = status === 'healthy' ? 'text-emerald-400' : status === 'degraded' ? 'text-amber-400' : 'text-rose-400';
  const ringColor = status === 'healthy' ? 'border-emerald-500/40 bg-emerald-500/5' : status === 'degraded' ? 'border-amber-500/40 bg-amber-500/5' : 'border-rose-500/40 bg-rose-500/5';

  return (
    <Card className={`p-5 border ${ringColor}`}>
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${status === 'healthy' ? 'bg-emerald-500/15' : status === 'degraded' ? 'bg-amber-500/15' : 'bg-rose-500/15'}`}>
            <Shield className={`h-8 w-8 ${statusColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">AEGIS Self-Healing</h2>
              <Badge variant="outline" className={`capitalize ${statusColor} border-current`}>{status}</Badge>
            </div>
            <p className="text-sm text-slate-400">Autonomous infrastructure immune system — Monitor · Analyzer · Actuator · Codex</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className={`text-2xl font-bold ${statusColor}`}>{score}</div>
            <div className="text-[10px] uppercase text-slate-500">Health</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-300">{uptime.toFixed(2)}%</div>
            <div className="text-[10px] uppercase text-slate-500">Uptime</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-300">{critical}</div>
            <div className="text-[10px] uppercase text-slate-500">Critical</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300">{health?.metrics?.successful_heals || 0}</div>
            <div className="text-[10px] uppercase text-slate-500">Healed</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        <Button onClick={onScan} disabled={busy} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
          {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Run Scan
        </Button>
        <Button onClick={onForceHeal} disabled={busy} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
          <Heart className="h-4 w-4" /> Force Heal
        </Button>
        <Button onClick={onQuantumAudit} disabled={busy} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
          <Atom className="h-4 w-4" /> Quantum Audit
        </Button>
        <Button onClick={onComplianceRepair} disabled={busy} className="bg-blue-600 hover:bg-blue-500">
          <Zap className="h-4 w-4" /> Compliance Repair
        </Button>
      </div>
    </Card>
  );
}