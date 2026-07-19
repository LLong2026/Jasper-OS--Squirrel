import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Settlement Sentinel ──────────────────────────────────────────────────────
// Scans recent URIB settlements for bottlenecks and failures across the
// cross-rail mesh and raises SettlementAlert records for ops visibility.

const STALL_WINDOW_MS = 5 * 60 * 1000;        // 5 min of no throughput = stall
const FULL_RAIL_SET = ['ISO', 'BTC', 'XRP', 'CBDC'];
const MIN_THREAD_EVENTS = 5;                   // pipeline should emit >=5 ThreadZero events
const RETRY_STORM_THRESHOLD = 5;               // 5+ settlements by same actor in window

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const windowMinutes = Number(body.window_minutes) || 15;
    const windowMs = windowMinutes * 60 * 1000;
    const since = Date.now() - windowMs;

    // Fetch recent URIB settlements within the scan window
    const settlements = await base44.asServiceRole.entities.AuditLog.filter(
      { record_type: 'urib_settlement', timestamp: { $gte: since } },
      '-timestamp',
      100
    ).catch(() => []);

    const newAlerts = [];

    const buildDedupeKey = (type, settlementId, actor) =>
      `${type}::${settlementId || 'actor:' + (actor || 'system')}`;

    // ── 1. FAILED SETTLEMENTS ──
    for (const s of settlements) {
      const eventData = String(s.event_data || '');
      const isFailed = s.severity === 'error' || s.severity === 'critical' ||
        !s.c_stack || /error|fail/i.test(eventData);
      if (isFailed) {
        const reasons = [];
        if (!s.c_stack) reasons.push('missing stack commitment');
        if (s.severity === 'error' || s.severity === 'critical') reasons.push(`severity=${s.severity}`);
        if (/error|fail/i.test(eventData)) reasons.push('error marker in event data');
        newAlerts.push({
          alert_type: 'failure',
          severity: 'critical',
          title: `Settlement failed: ${s.actor || 'unknown'}`,
          description: `URIB settlement did not complete cleanly (${reasons.join('; ')}).`,
          related_settlement_id: s.id,
          actor: s.actor || 'unknown',
          thread_anchor: s.thread_anchor,
          c_stack: s.c_stack,
          detected_at: Date.now(),
          dedupe_key: buildDedupeKey('failure', s.id, s.actor),
        });
      }
    }

    // ── 2. PARTIAL RAIL COVERAGE (bottleneck — mesh not fully traversed) ──
    for (const s of settlements) {
      const rails = Array.isArray(s.rails) ? s.rails : [];
      const missing = FULL_RAIL_SET.filter(r => !rails.includes(r));
      if (missing.length > 0 && s.c_stack) {
        newAlerts.push({
          alert_type: 'partial_rail_coverage',
          severity: 'warning',
          title: `Bottleneck: ${s.actor || 'settlement'} skipped ${missing.join(', ')}`,
          description: `Settlement did not traverse the full cross-rail mesh — missing rails: ${missing.join(', ')}. Value equivalence cannot be guaranteed.`,
          related_settlement_id: s.id,
          actor: s.actor || 'unknown',
          thread_anchor: s.thread_anchor,
          c_stack: s.c_stack,
          detected_at: Date.now(),
          dedupe_key: buildDedupeKey('partial_rail_coverage', s.id, s.actor),
        });
      }
    }

    // ── 3. INCOMPLETE PIPELINE (low ThreadZero event count) ──
    for (const s of settlements) {
      if ((s.event_count || 0) < MIN_THREAD_EVENTS && s.c_stack) {
        newAlerts.push({
          alert_type: 'bottleneck',
          severity: 'warning',
          title: `Bottleneck: incomplete pipeline for ${s.actor || 'settlement'}`,
          description: `ThreadZero event count ${s.event_count || 0} is below the expected ${MIN_THREAD_EVENTS} — the pipeline likely stalled before settlement emission.`,
          related_settlement_id: s.id,
          actor: s.actor || 'unknown',
          thread_anchor: s.thread_anchor,
          c_stack: s.c_stack,
          detected_at: Date.now(),
          dedupe_key: buildDedupeKey('bottleneck', s.id, s.actor),
        });
      }
    }

    // ── 4. PIPELINE STALL (throughput dropped) ──
    const latest = settlements[0];
    const latestAge = latest ? Date.now() - (latest.timestamp || 0) : null;
    if (settlements.length === 0) {
      // Was there activity in the prior window? If yes and now stalled, raise.
      const priorWindow = await base44.asServiceRole.entities.AuditLog.filter(
        { record_type: 'urib_settlement', timestamp: { $gte: since - windowMs, $lt: since } },
        '-timestamp',
        1
      ).catch(() => []);
      if (priorWindow.length > 0) {
        newAlerts.push({
          alert_type: 'stall',
          severity: 'warning',
          title: 'Pipeline stall detected',
          description: `No URIB settlements in the last ${windowMinutes} min despite prior activity — the mesh may be blocked.`,
          actor: 'system',
          detected_at: Date.now(),
          dedupe_key: 'stall::system',
        });
      }
    } else if (latestAge !== null && latestAge > STALL_WINDOW_MS && settlements.length < 3) {
      newAlerts.push({
        alert_type: 'stall',
        severity: 'warning',
        title: 'Pipeline stall detected',
        description: `Most recent settlement was ${Math.round(latestAge / 60000)} min ago — throughput has dropped.`,
        actor: 'system',
        detected_at: Date.now(),
        dedupe_key: 'stall::system',
      });
    }

    // ── 5. RETRY STORM (same actor hammering the bridge) ──
    const byActor = {};
    for (const s of settlements) {
      const a = s.actor || 'unknown';
      byActor[a] = (byActor[a] || 0) + 1;
    }
    for (const [actor, count] of Object.entries(byActor)) {
      if (count >= RETRY_STORM_THRESHOLD) {
        newAlerts.push({
          alert_type: 'retry_storm',
          severity: 'critical',
          title: `Retry storm: ${actor} sent ${count} settlements`,
          description: `${actor} triggered ${count} settlements in ${windowMinutes} min — likely stuck retrying due to a rail bottleneck.`,
          actor,
          detected_at: Date.now(),
          dedupe_key: `retry_storm::actor:${actor}`,
        });
      }
    }

    // ── PERSIST NEW ALERTS (deduped against active ones) ──
    const created = [];
    for (const alert of newAlerts) {
      const existing = await base44.asServiceRole.entities.SettlementAlert.filter(
        { dedupe_key: alert.dedupe_key, status: 'active' },
        '-detected_at',
        1
      ).catch(() => []);
      if (existing.length === 0) {
        const rec = await base44.asServiceRole.entities.SettlementAlert.create(alert).catch(() => null);
        if (rec) created.push(rec);
      }
    }

    // ── RETURN ALL ACTIVE ALERTS ──
    const activeAlerts = await base44.asServiceRole.entities.SettlementAlert.filter(
      { status: 'active' },
      '-detected_at',
      50
    ).catch(() => []);

    return Response.json({
      success: true,
      scanned: settlements.length,
      window_minutes: windowMinutes,
      new_alerts: created.length,
      active_alerts: activeAlerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});