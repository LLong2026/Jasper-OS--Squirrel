import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Reads optimization trend rows from the connected Google Sheet
// (OptimizationEvents tab created by stabilitySheetsExport) and returns
// chart-ready data: one point per proposal with type, impact_score, status,
// and a parsed timestamp. Used by the OptimizationTrendsChart component.

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;

    // Spreadsheet id is persisted by stabilitySheetsExport in GlobalMemory.
    const stateRecords = await svc.GlobalMemory.filter({ source_agent: 'stability_sheets_export' });
    const spreadsheetId = stateRecords[0]?.content?.spreadsheet_id;

    if (!spreadsheetId) {
      return Response.json({
        error: 'No stability spreadsheet found. Run stabilitySheetsExport first to create it.',
      }, { status: 404 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const headers = { 'Authorization': `Bearer ${accessToken}` };

    // Discover the actual sheet title (the export may have used a different name).
    const metaRes = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, { headers });
    const meta = metaRes.ok ? await metaRes.json() : {};
    const sheetTitles = (meta.sheets || []).map(s => s.properties?.title).filter(Boolean);
    const target = sheetTitles.find(t => /optim/i.test(t)) || sheetTitles[0];

    if (!target) {
      return Response.json({
        error: 'Spreadsheet has no readable sheets.',
        spreadsheet_id: spreadsheetId,
        sheet_titles: sheetTitles,
      }, { status: 404 });
    }

    const rangeRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(target)}`,
      { headers }
    );

    if (!rangeRes.ok) {
      const err = await rangeRes.text();
      return Response.json({ error: `Sheets read failed: ${err}` }, { status: 502 });
    }

    const sheet = await rangeRes.json();
    const rows = sheet.values || [];
    if (rows.length < 2) {
      return Response.json({ spreadsheet_id: spreadsheetId, points: [], count: 0 });
    }

    const header = rows[0];
    const idx = (name) => header.indexOf(name);

    const points = rows.slice(1)
      .filter(r => r[idx('proposal_id')])
      .map(r => {
        const createdIso = r[idx('created_at_iso')] || '';
        const ts = createdIso ? Date.parse(createdIso) : NaN;
        return {
          proposal_id: r[idx('proposal_id')] || '',
          optimization_type: r[idx('optimization_type')] || 'unknown',
          source_agent: r[idx('source_agent')] || '',
          risk_level: r[idx('risk_level')] || '',
          status: r[idx('status')] || '',
          impact_score: Number(r[idx('impact_score')] || 0),
          created_at: Number.isNaN(ts) ? null : ts,
          created_at_iso: createdIso,
        };
      })
      .filter(p => p.created_at !== null)
      .sort((a, b) => a.created_at - b.created_at);

    return Response.json({
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      points,
      count: points.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});