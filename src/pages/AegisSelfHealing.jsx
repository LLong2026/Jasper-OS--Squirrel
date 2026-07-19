import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import AegisHero from '@/components/aegis/AegisHero';
import LiveFeeds from '@/components/aegis/LiveFeeds';
import PlaybookGrid from '@/components/aegis/PlaybookGrid';
import QuantumPanel from '@/components/aegis/QuantumPanel';
import AegisHeartbeat from '@/components/AegisHeartbeat';
import { Card } from '@/components/ui/card';
import { Activity, Info } from 'lucide-react';

export default function AegisSelfHealing() {
  const [health, setHealth] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [healingEvents, setHealingEvents] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [anom, heals] = await Promise.all([
        base44.entities.AegisAnomaly.list('-created_date', 20),
        base44.entities.AegisHealingEvent.list('-created_date', 20),
      ]);
      setAnomalies(anom || []);
      setHealingEvents(heals || []);
      const sh = await base44.entities.SystemHealth.list('-created_date', 1);
      if (sh && sh[0]) {
        setHealth({
          system_status: sh[0].status,
          health_score: sh[0].health_score,
          anomalies: anom || [],
          metrics: {
            active_anomalies: sh[0].active_anomalies,
            successful_heals: sh[0].successful_heals,
            pqc_readiness_score: sh[0].pqc_readiness_score,
            vulnerable_crypto_count: sh[0].vulnerable_crypto_count,
            pq_keys: 0,
            total_keys: 0,
            chronos_vitality: sh[0].chronos_vitality,
            shards_healthy: Math.round((sh[0].chronos_vitality || 1) * 15),
          },
        });
      }
    } catch (e) {
      console.error('Aegis fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('aegisMonitor', { action: 'scan' });
      const r = res.data || res;
      setHealth(r);
      setLastScan({ timestamp: r.timestamp, anomalies: r.anomalies?.length || 0, status: r.overall_health });
      await fetchData();
    } catch (e) {
      setLastScan({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const forceHeal = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('aegisHeartbeat', { session_id: `manual_${Date.now()}` });
      const r = res.data || res;
      setLastScan({ timestamp: r.timestamp, anomalies: r.anomalies_detected, healed: r.healed, status: r.system_status });
      await fetchData();
    } catch (e) {
      setLastScan({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const quantumAudit = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('quantumComplianceBot', { action: 'scan', target: 'system' });
      const r = res.data || res;
      setCompliance(r.result);
      setLastScan({ timestamp: r.scanned_at, compliance: r.result?.compliance_score, violations: r.result?.violations?.length });
    } catch (e) {
      setLastScan({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const complianceRepair = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('quantumComplianceBot', { action: 'repair' });
      const r = res.data || res;
      setLastScan({ timestamp: r.repaired_at, fixes: r.fixes_applied, repaired: r.success });
      await quantumAudit();
    } catch (e) {
      setLastScan({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 lg:p-6 space-y-4">
      <AegisHero
        health={health}
        scanning={scanning}
        busy={scanning}
        onScan={runScan}
        onForceHeal={forceHeal}
        onQuantumAudit={quantumAudit}
        onComplianceRepair={complianceRepair}
      />

      {lastScan && (
        <Card className="p-3 bg-slate-800/40 border-slate-700 flex items-center gap-3 text-xs">
          <Activity className="h-4 w-4 text-blue-400" />
          <span className="text-slate-300">Last action:</span>
          {lastScan.error ? (
            <span className="text-rose-400">{lastScan.error}</span>
          ) : (
            <span className="text-slate-400">
              {lastScan.status && <span className="capitalize text-slate-200">{lastScan.status}</span>}
              {lastScan.anomalies != null && <> · {lastScan.anomalies} anomalies</>}
              {lastScan.healed != null && <> · {lastScan.healed} healed</>}
              {lastScan.compliance != null && <> · compliance {lastScan.compliance}</>}
              {lastScan.violations != null && <> · {lastScan.violations} violations</>}
              {lastScan.fixes != null && <> · {lastScan.fixes} fixes applied</>}
              {lastScan.timestamp && <span className="ml-2 text-slate-500">{new Date(lastScan.timestamp).toLocaleTimeString()}</span>}
            </span>
          )}
        </Card>
      )}

      {health?.metrics && (
        <Card className="p-3 bg-slate-800/40 border-slate-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
            <div><div className="text-lg font-bold text-blue-300">{health.metrics.active_anomalies ?? 0}</div><div className="text-[10px] text-slate-500 uppercase">Active</div></div>
            <div><div className="text-lg font-bold text-emerald-300">{health.metrics.successful_heals ?? 0}</div><div className="text-[10px] text-slate-500 uppercase">Healed</div></div>
            <div><div className="text-lg font-bold text-slate-200">{Math.round((health.metrics.success_rate || 0) * 100)}%</div><div className="text-[10px] text-slate-500 uppercase">Success Rate</div></div>
            <div><div className="text-lg font-bold text-slate-200">{((health.metrics.avg_recovery_ms || 0) / 1000).toFixed(1)}s</div><div className="text-[10px] text-slate-500 uppercase">Avg Recovery</div></div>
            <div><div className="text-lg font-bold text-slate-200">{health.metrics.total_keys ?? 0}</div><div className="text-[10px] text-slate-500 uppercase">Keys</div></div>
            <div><div className="text-lg font-bold text-rose-300">{health.metrics.vulnerable_crypto_count ?? 0}</div><div className="text-[10px] text-slate-500 uppercase">Vulnerable</div></div>
            <div><div className="text-lg font-bold text-emerald-300">{health.metrics.pqc_readiness_score ?? 50}%</div><div className="text-[10px] text-slate-500 uppercase">PQC Ready</div></div>
          </div>
        </Card>
      )}

      <LiveFeeds anomalies={anomalies} healingEvents={healingEvents} loading={false} />

      <PlaybookGrid healingEvents={healingEvents} />

      <QuantumPanel metrics={health?.metrics} compliance={compliance} scanning={scanning} onRepair={complianceRepair} />

      <Card className="p-3 bg-slate-800/40 border-slate-700 flex items-start gap-2 text-xs text-slate-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
        <div>
          The <span className="text-slate-200 font-medium">Chronos Daemon</span> heartbeat pulses every 10 seconds (multi-tab coordinated). Each pulse runs a full Monitor → Analyzer (LLM) → Actuator cycle, persisting real anomalies and healing events. Quantum vulnerabilities trigger real ML-DSA-65 key issuance via the PQ-native crypto layer. The system stays autonomous as long as this dashboard is open.
        </div>
      </Card>

      <AegisHeartbeat />
    </div>
  );
}