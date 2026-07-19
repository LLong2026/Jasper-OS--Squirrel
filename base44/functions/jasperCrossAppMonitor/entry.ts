import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function classifyApp(app) {
  const status = (app.status || '').toLowerCase();
  if (status === 'offline' || app.health_score == null) return 'offline';
  if (app.health_score < 50) return 'critical';
  if (app.health_score < 90) return 'degraded';
  return 'healthy';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sweep_id, app_details = [] } = body;

    if (!Array.isArray(app_details)) {
      return Response.json({ error: 'app_details must be an array' }, { status: 400 });
    }

    const startedAt = new Date().toISOString();
    const classified = app_details.map(app => ({
      ...app,
      classification: classifyApp(app)
    }));

    const counts = { healthy: 0, degraded: 0, critical: 0, offline: 0 };
    let totalAgents = 0;
    let totalActiveAnomalies = 0;
    let totalHealingEvents = 0;
    let totalSuccessfulHeals = 0;
    let healthScoreSum = 0;
    let pqcSum = 0;
    let scoredApps = 0;

    for (const app of classified) {
      counts[app.classification] = (counts[app.classification] || 0) + 1;
      totalAgents += Number(app.agents) || 0;
      totalActiveAnomalies += Number(app.active_anomalies) || 0;
      totalHealingEvents += Number(app.healing_events) || 0;
      totalSuccessfulHeals += Number(app.successful_heals) || 0;
      if (typeof app.health_score === 'number') {
        healthScoreSum += app.health_score;
        scoredApps++;
      }
      if (typeof app.pqc_readiness === 'number') {
        pqcSum += app.pqc_readiness;
      }
    }

    const avgHealth = scoredApps > 0 ? healthScoreSum / scoredApps : 0;
    const avgPqc = app_details.length > 0 ? pqcSum / app_details.length : 0;
    const successRate = totalHealingEvents > 0 ? (totalSuccessfulHeals / totalHealingEvents) * 100 : 0;
    const uptimePercentage = scoredApps > 0 ? (counts.healthy / scoredApps) * 100 : 0;

    let overallStatus = 'healthy';
    if (counts.critical > 0 || counts.offline > 0) overallStatus = 'critical';
    else if (counts.degraded > 0) overallStatus = 'degraded';

    const heartbeatStatus = counts.offline === app_details.length && app_details.length > 0
      ? 'dead'
      : (counts.degraded > 0 || counts.critical > 0 ? 'degraded' : 'alive');

    const snapshotId = `eco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    // Aggregated SystemHealth record (written via service role)
    await base44.asServiceRole.entities.SystemHealth.create({
      snapshot_id: snapshotId,
      health_score: Math.round(avgHealth * 100) / 100,
      status: overallStatus,
      heartbeat_count: app_details.length,
      active_anomalies: totalActiveAnomalies,
      total_healing_events: totalHealingEvents,
      successful_heals: totalSuccessfulHeals,
      success_rate: Math.round(successRate * 100) / 100,
      pqc_readiness_score: Math.round(avgPqc * 100) / 100,
      timestamp: Date.now()
    });

    // PredictiveAlert records for critical apps
    const alertRecords = [];
    for (const app of classified.filter(a => a.classification === 'critical' || a.classification === 'offline')) {
      const alert = await base44.asServiceRole.entities.PredictiveAlert.create({
        alert_type: 'cross_app_critical',
        severity: 'critical',
        predicted_issue: `App "${app.app_name}" (${app.app_id}) classified as ${app.classification} with health_score ${app.health_score}`,
        probability: 0.95,
        affected_components: [app.app_id, app.app_name].filter(Boolean),
        recommended_action: app.classification === 'offline'
          ? `Investigate connectivity to ${app.app_name}; node may be down.`
          : `Trigger Aegis healing pipeline for ${app.app_name}; review ${app.active_anomalies} active anomalies.`,
        status: 'pending',
        created_at: timestamp
      });
      alertRecords.push({ id: alert.id, app_id: app.app_id, app_name: app.app_name });
    }

    // RemediationSweep record
    const completedAt = new Date().toISOString();
    const sweepSummary = `Cross-app monitor sweep ${sweep_id || snapshotId}: ${app_details.length} apps scanned — ${counts.healthy} healthy, ${counts.degraded} degraded, ${counts.critical} critical, ${counts.offline} offline. Overall: ${overallStatus}.`;
    const sweep = await base44.asServiceRole.entities.RemediationSweep.create({
      sweep_type: 'cross_app_monitoring',
      started_at: startedAt,
      completed_at: completedAt,
      anomalies_found: totalActiveAnomalies,
      anomalies_resolved: 0,
      agents_rebalanced: 0,
      orphans_purged: 0,
      nodes_refreshed: 0,
      healing_events_created: alertRecords.length,
      summary: sweepSummary,
      triggered_by: 'jasper_cross_app_monitor'
    });

    return Response.json({
      sweep_id: sweep_id || snapshotId,
      remediation_sweep_id: sweep.id,
      system_health_snapshot_id: snapshotId,
      ecosystem: {
        app_id: 'squirrel-os-ecosystem',
        overall_status: overallStatus,
        status: overallStatus,
        health_score: Math.round(avgHealth * 100) / 100,
        heartbeat_count: app_details.length,
        heartbeat_status: heartbeatStatus,
        active_anomaly_count: totalActiveAnomalies,
        agent_count: totalAgents,
        successful_heals: totalSuccessfulHeals,
        total_healing_events: totalHealingEvents,
        success_rate: Math.round(successRate * 100) / 100,
        pqc_readiness_score: Math.round(avgPqc * 100) / 100,
        uptime_percentage: Math.round(uptimePercentage * 100) / 100,
        timestamp
      },
      classification_counts: counts,
      alerts_created: alertRecords,
      timestamp
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});