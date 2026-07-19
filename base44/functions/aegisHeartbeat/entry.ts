import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Aegis Heartbeat (The Chronos Daemon) — the 10-second autonomous pulse.
// Runs a full Monitor → Analyzer → Actuator cycle on every tick, persisting
// real health state and triggering real healing. Called from the browser.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ts = Date.now();

    // 1. Monitor sweep
    const monitorRaw = await base44.functions.invoke('aegisMonitor', { action: 'scan' });
    const monitor = monitorRaw.data || monitorRaw;

    // 2. Analyze + heal each detected anomaly (real LLM diagnosis + playbook execution)
    const healed = [];
    const anomalies = monitor.anomalies || [];
    if (anomalies.length > 0) {
      for (const anomaly of anomalies) {
        try {
          const analysisRaw = await base44.functions.invoke('aegisAnalyzer', { action: 'analyze', anomaly });
          const analysis = analysisRaw.data || analysisRaw;
          if (analysis.playbook_id) {
            const healRaw = await base44.functions.invoke('aegisActuator', {
              action: 'execute', anomaly, playbook_id: analysis.playbook_id, trigger: 'automatic',
            });
            const heal = healRaw.data || healRaw;
            healed.push({ anomaly_id: anomaly.id, playbook: analysis.playbook_id, success: heal.success });
          }
        } catch (e) {
          healed.push({ anomaly_id: anomaly.id, error: e.message });
        }
      }
    }

    // Feed Aegis health metrics into the Arete recursive learning loop so
    // infrastructure health becomes a learnable signal alongside accuracy/latency.
    let areteIngestion = null;
    try {
      const areteRaw = await base44.functions.invoke('areteRecursiveEngine', {
        action: 'ingest_aegis_health',
        health: {
          overall_health: monitor.overall_health,
          health_score: monitor.health_score,
          heartbeat_count: monitor.heartbeat_count,
          active_anomalies: monitor.metrics?.active_anomalies ?? 0,
          success_rate: monitor.metrics?.success_rate ?? 0,
          avg_recovery_ms: monitor.metrics?.avg_recovery_ms ?? 0,
          pqc_readiness_score: monitor.metrics?.pqc_readiness_score ?? 50,
          chronos_vitality: monitor.metrics?.chronos_vitality ?? 1,
        },
      });
      areteIngestion = areteRaw?.data || areteRaw;
    } catch (e) {
      areteIngestion = { error: e.message };
    }

    return Response.json({
      success: true, session_id: body.session_id, timestamp: ts, pulse: 'active',
      system_status: monitor.overall_health, health_score: monitor.health_score,
      heartbeat_count: monitor.heartbeat_count,
      anomalies_detected: anomalies.length,
      healed: healed.length, healing_results: healed,
      metrics: monitor.metrics, checks: monitor.checks,
      arete_learning: areteIngestion,
      proof: { source: 'Aegis Heartbeat (Chronos Daemon)', details: `Pulse at ${new Date(ts).toISOString()} — health fed to Arete` },
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message, pulse: 'degraded' }, { status: 500 });
  }
});