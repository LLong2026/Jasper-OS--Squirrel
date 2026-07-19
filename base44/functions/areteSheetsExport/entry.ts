import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Arete Sheets Export — reads LearningMetric + OptimizationEvent records and
// appends them to a Google Sheet for long-term trend analysis. Tracks the last
// exported timestamp in GlobalMemory so only new records are appended each run.
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
    const stateRecords = await svc.GlobalMemory.filter({ source_agent: 'arete_sheets_export' });
    const state = stateRecords[0];
    let spreadsheetId = body.spreadsheet_id || state?.content?.spreadsheet_id || null;
    let lastMetricsTs = state?.content?.last_metrics_ts || 0;
    let lastProposalsTs = state?.content?.last_proposals_ts || 0;

    // --- Create spreadsheet + headers on first run ---
    if (!spreadsheetId) {
      const createRes = await fetch(SHEETS_API, {
        method: 'POST', headers,
        body: JSON.stringify({
          properties: { title: 'Arete Learning Analytics' },
          sheets: [
            { properties: { title: 'Metrics' } },
            { properties: { title: 'Proposals' } },
          ]
        })
      });
      if (!createRes.ok) {
        const err = await createRes.text();
        return Response.json({ error: `Failed to create spreadsheet: ${err}` }, { status: 500 });
      }
      const sheet = await createRes.json();
      spreadsheetId = sheet.spreadsheetId;

      await fetch(`${SHEETS_API}/${spreadsheetId}/values/Metrics!A1:append?valueInputOption=RAW`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [['metric_id', 'name', 'value', 'type', 'agent_name', 'domain', 'timestamp_iso', 'exported_at']] })
      });
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/Proposals!A1:append?valueInputOption=RAW`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [['proposal_id', 'optimization_type', 'source_agent', 'target_agent', 'risk_level', 'status', 'impact_score', 'created_at_iso', 'completed_at_iso', 'exported_at']] })
      });
    }

    // --- Query new metrics (ascending so oldest are appended first) ---
    const allMetrics = await svc.LearningMetric.list('timestamp', 500);
    const newMetrics = allMetrics.filter(m => (m.timestamp || 0) > lastMetricsTs);
    let metricsExported = 0;

    if (newMetrics.length > 0) {
      const rows = newMetrics.map(m => [
        m.metric_id || '', m.name || '', m.value ?? '', m.type || '',
        m.agent_name || '', m.domain || '',
        m.timestamp ? new Date(m.timestamp).toISOString() : '',
        new Date(now).toISOString()
      ]);
      const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Metrics!A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers, body: JSON.stringify({ values: rows })
      });
      if (appendRes.ok) metricsExported = newMetrics.length;
    }

    // --- Query new proposals (ascending by created_at) ---
    const allProposals = await svc.OptimizationEvent.list('created_at', 500);
    const newProposals = allProposals.filter(p => (p.created_at || 0) > lastProposalsTs);
    let proposalsExported = 0;

    if (newProposals.length > 0) {
      const rows = newProposals.map(p => [
        p.proposal_id || '', p.optimization_type || '', p.source_agent || '', p.target_agent || '',
        p.risk_level || '', p.status || '', p.impact_score ?? '',
        p.created_at ? new Date(p.created_at).toISOString() : '',
        p.completed_at ? new Date(p.completed_at).toISOString() : '',
        new Date(now).toISOString()
      ]);
      const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Proposals!A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers, body: JSON.stringify({ values: rows })
      });
      if (appendRes.ok) proposalsExported = newProposals.length;
    }

    // --- Update export state ---
    const maxMetricsTs = newMetrics.length > 0 ? Math.max(...newMetrics.map(m => m.timestamp || 0)) : lastMetricsTs;
    const maxProposalsTs = newProposals.length > 0 ? Math.max(...newProposals.map(p => p.created_at || 0)) : lastProposalsTs;
    const newStateContent = {
      spreadsheet_id: spreadsheetId,
      last_metrics_ts: maxMetricsTs,
      last_proposals_ts: maxProposalsTs,
      last_export_at: now,
    };

    if (state) {
      await svc.GlobalMemory.update(state.id, { content: newStateContent });
    } else {
      await svc.GlobalMemory.create({
        memory_type: 'audit_log',
        content: newStateContent,
        source_agent: 'arete_sheets_export',
        tags: ['arete', 'sheets_export'],
      });
    }

    return Response.json({
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      metrics_exported: metricsExported,
      proposals_exported: proposalsExported,
      last_export_at: new Date(now).toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});