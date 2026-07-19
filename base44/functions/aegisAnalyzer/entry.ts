import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Aegis Analyzer (The Oracle) — uses a real LLM to diagnose anomalies and
// select the best remediation playbook with confidence scoring.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'analyze';
    const svc = base44.asServiceRole.entities;

    if (action === 'analyze') {
      const anomaly = body.anomaly;
      try { await svc.AegisAnomaly.update(anomaly.id, { status: 'analyzing' }); } catch {}

      const prompt = `You are the Aegis Analyzer (The Oracle), an autonomous infrastructure diagnostic engine.
An anomaly was detected by the Aegis Monitor. Diagnose it and select the best remediation playbook.

ANOMALY:
- type: ${anomaly.anomaly_type}
- severity: ${anomaly.severity}
- component: ${anomaly.component}
- description: ${anomaly.description}
- metrics: ${JSON.stringify(anomaly.metrics || {})}
- vulnerable_algorithm: ${anomaly.vulnerable_algorithm || 'n/a'}
- suggested_pqc: ${anomaly.suggested_pqc_algorithm || 'n/a'}

Available playbooks:
PB-001 Service Restart, PB-002 Scale Up, PB-003 Traffic Reroute, PB-004 Deploy Revert,
PB-005 Cache Warming, PB-006 CDN Flush, PB-007 Disk Cleanup, PB-008 Snapshot Restore,
PB-009 Security Incident (manual), PB-010 Escalation,
PB-011 Database Reindex, PB-012 Config Drift Correction, PB-013 Service Dependency Restart,
PB-014 Canary Rollback, PB-015 Rate Limiter Adjustment,
PB-016 Entity Recovery (entity_error, schema/validation failure),
PB-017 Integration Failover (integration_degraded, LLM provider slow/failing),
PQM-001 Post-Quantum Crypto Upgrade, PQR-001 Post-Quantum Key Rotation.

Respond as JSON with: root_cause (string), confidence (0-1 number), impact (string), urgency (low|medium|high|critical), playbook_id (the best PB/PQM/PQR id), reasoning (string), proactive_recommendation (string).`;

      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            root_cause: { type: 'string' },
            confidence: { type: 'number' },
            impact: { type: 'string' },
            urgency: { type: 'string' },
            playbook_id: { type: 'string' },
            reasoning: { type: 'string' },
            proactive_recommendation: { type: 'string' },
          },
          required: ['root_cause', 'confidence', 'playbook_id'],
        },
      });

      const analysis = llm;
      try {
        await svc.AegisAnomaly.update(anomaly.id, {
          status: 'healing',
          root_cause: analysis.root_cause,
          playbook_id: analysis.playbook_id,
          confidence: analysis.confidence,
        });
      } catch {}

      return Response.json({
        success: true, anomaly_id: anomaly.id, analysis,
        playbook_id: analysis.playbook_id,
        proof: { source: 'Aegis Analyzer', model: 'LLM Diagnostic Engine', details: analysis.reasoning },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});