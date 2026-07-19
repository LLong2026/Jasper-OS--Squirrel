import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Stability Sheets Export — reads SettlementAlert, AegisAnomaly, and
// AegisHealingEvent records and appends them to a Google Sheet for long-term
// platform stability tracking. Uses GlobalMemory to track the last exported
// timestamp per entity so only new records are appended each run.
// Invoked by a scheduled workflow (no user context — uses service role).

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;

    const body = await req.json().catch(() => ({}));
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const now = Date.now();

    // --- Load export state from GlobalMemory ---
    const stateRecords = await svc.GlobalMemory.filter({ source_agent: 'stability_sheets_export' });
    const state = stateRecords[0];
    let spreadsheetId = body.spreadsheet_id || state?.content?.spreadsheet_id || null;
    let lastAlertsTs = state?.content?.last_alerts_ts || 0;
    let lastAnomaliesTs = state?.content?.last_anomalies_ts || 0;
    let lastHealingTs = state?.content?.last_healing_ts || 0;
    let lastOptimizationsTs = state?.content?.last_optimizations_ts || 0;

    // --- Create spreadsheet + headers on first run ---
    if (!spreadsheetId) {
      const createRes = await fetch(SHEETS_API, {
        method: 'POST', headers,
        body: JSON.stringify({
          properties: { title: 'Jasper Platform Stability' },
          sheets: [
            { properties: { title: 'SettlementAlerts' } },
            { properties: { title: 'AegisAnomalies' } },
            { properties: { title: 'HealingEvents' } },
            { properties: { title: 'OptimizationEvents' } },
          ]
        })
      });
      if (!createRes.ok) {
        const err = await createRes.text();
        return Response.json({ error: `Failed to create spreadsheet: ${err}` }, { status: 500 });
      }
      const sheet = await createRes.json();
      spreadsheetId = sheet.spreadsheetId;

      await fetch(`${SHEETS_API}/${spreadsheetId}/values/SettlementAlerts!A1:append?valueInputOption=RAW`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [['alert_type', 'severity', 'title', 'description', 'status', 'actor', 'related_settlement_id', 'thread_anchor', 'c_stack', 'detected_at_iso', 'exported_at']] })
      });
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/AegisAnomalies!A1:append?valueInputOption=RAW`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [['anomaly_id', 'anomaly_type', 'category', 'severity', 'component', 'description', 'root_cause', 'playbook_id', 'confidence', 'status', 'detected_at_iso', 'exported_at']] })
      });
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/HealingEvents!A1:append?valueInputOption=RAW`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [['event_id', 'anomaly_id', 'playbook_id', 'playbook_name', 'status', 'trigger', 'execution_time_ms', 'result_summary', 'started_at_iso', 'completed_at_iso', 'exported_at']] })
      });
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/OptimizationEvents!A1:append?valueInputOption=RAW`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [['proposal_id', 'optimization_type', 'source_agent', 'target_agent', 'risk_level', 'status', 'impact_score', 'expected_improvement', 'proposed_changes', 'actual_results', 'created_at_iso', 'completed_at_iso', 'exported_at']] })
      });
    }

    // --- Query new settlement alerts (ascending by detected_at) ---
    const allAlerts = await svc.SettlementAlert.list('detected_at', 500);
    const newAlerts = allAlerts.filter(a => (a.detected_at || 0) > lastAlertsTs);
    let alertsExported = 0;

    if (newAlerts.length > 0) {
      const rows = newAlerts.map(a => [
        a.alert_type || '', a.severity || '', a.title || '', a.description || '',
        a.status || '', a.actor || '', a.related_settlement_id || '',
        a.thread_anchor || '', a.c_stack || '',
        a.detected_at ? new Date(a.detected_at).toISOString() : '',
        new Date(now).toISOString()
      ]);
      const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/SettlementAlerts!A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers, body: JSON.stringify({ values: rows })
      });
      if (appendRes.ok) alertsExported = newAlerts.length;
    }

    // --- Query new Aegis anomalies (ascending by detected_at) ---
    const allAnomalies = await svc.AegisAnomaly.list('detected_at', 500);
    const newAnomalies = allAnomalies.filter(a => (a.detected_at || 0) > lastAnomaliesTs);
    let anomaliesExported = 0;

    if (newAnomalies.length > 0) {
      const rows = newAnomalies.map(a => [
        a.anomaly_id || '', a.anomaly_type || '', a.category || '', a.severity || '',
        a.component || '', a.description || '', a.root_cause || '',
        a.playbook_id || '', a.confidence ?? '', a.status || '',
        a.detected_at ? new Date(a.detected_at).toISOString() : '',
        new Date(now).toISOString()
      ]);
      const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/AegisAnomalies!A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers, body: JSON.stringify({ values: rows })
      });
      if (appendRes.ok) anomaliesExported = newAnomalies.length;
    }

    // --- Query new healing events (ascending by started_at) ---
    const allHealing = await svc.AegisHealingEvent.list('started_at', 500);
    const newHealing = allHealing.filter(h => (h.started_at || 0) > lastHealingTs);
    let healingExported = 0;

    if (newHealing.length > 0) {
      const rows = newHealing.map(h => [
        h.event_id || '', h.anomaly_id || '', h.playbook_id || '', h.playbook_name || '',
        h.status || '', h.trigger || '', h.execution_time_ms ?? '',
        h.result_summary || '',
        h.started_at ? new Date(h.started_at).toISOString() : '',
        h.completed_at ? new Date(h.completed_at).toISOString() : '',
        new Date(now).toISOString()
      ]);
      const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/HealingEvents!A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers, body: JSON.stringify({ values: rows })
      });
      if (appendRes.ok) healingExported = newHealing.length;
    }

    // --- Query new Arete optimization proposals (ascending by created_at) ---
    const allOptimizations = await svc.OptimizationEvent.list('created_at', 500);
    const newOptimizations = allOptimizations.filter(o => (o.created_at || 0) > lastOptimizationsTs);
    let optimizationsExported = 0;

    if (newOptimizations.length > 0) {
      const rows = newOptimizations.map(o => [
        o.proposal_id || '', o.optimization_type || '', o.source_agent || '',
        o.target_agent || '', o.risk_level || '', o.status || '',
        o.impact_score ?? '',
        JSON.stringify(o.expected_improvement || {}),
        JSON.stringify(o.proposed_changes || {}),
        JSON.stringify(o.actual_results || {}),
        o.created_at ? new Date(o.created_at).toISOString() : '',
        o.completed_at ? new Date(o.completed_at).toISOString() : '',
        new Date(now).toISOString()
      ]);
      const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/OptimizationEvents!A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers, body: JSON.stringify({ values: rows })
      });
      if (appendRes.ok) optimizationsExported = newOptimizations.length;
    }

    // --- Update export state ---
    const maxAlertsTs = newAlerts.length > 0 ? Math.max(...newAlerts.map(a => a.detected_at || 0)) : lastAlertsTs;
    const maxAnomaliesTs = newAnomalies.length > 0 ? Math.max(...newAnomalies.map(a => a.detected_at || 0)) : lastAnomaliesTs;
    const maxHealingTs = newHealing.length > 0 ? Math.max(...newHealing.map(h => h.started_at || 0)) : lastHealingTs;
    const maxOptimizationsTs = newOptimizations.length > 0 ? Math.max(...newOptimizations.map(o => o.created_at || 0)) : lastOptimizationsTs;
    const newStateContent = {
      spreadsheet_id: spreadsheetId,
      last_alerts_ts: maxAlertsTs,
      last_anomalies_ts: maxAnomaliesTs,
      last_healing_ts: maxHealingTs,
      last_optimizations_ts: maxOptimizationsTs,
      last_export_at: now,
    };

    if (state) {
      await svc.GlobalMemory.update(state.id, { content: newStateContent });
    } else {
      await svc.GlobalMemory.create({
        memory_type: 'audit_log',
        content: newStateContent,
        source_agent: 'stability_sheets_export',
        tags: ['stability', 'sheets_export', 'aegis', 'settlement'],
      });
    }

    return Response.json({
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      alerts_exported: alertsExported,
      anomalies_exported: anomaliesExported,
      healing_events_exported: healingExported,
      optimization_events_exported: optimizationsExported,
      last_export_at: new Date(now).toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});