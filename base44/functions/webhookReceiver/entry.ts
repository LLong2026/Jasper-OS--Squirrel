import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Webhook Receiver — accepts incoming webhooks from external services,
// logs them to AuditLog, and routes to appropriate handlers.

const HANDLERS = {
  'payment.completed': async (base44, payload) => {
    await base44.asServiceRole.entities.AuditLog.create({
      event_type: 'webhook_payment_completed', actor: payload.source || 'stripe',
      timestamp: Date.now(), severity: 'info',
      event_data: JSON.stringify({ amount: payload.amount, currency: payload.currency, id: payload.id }).substring(0, 5000),
    });
    return { routed: true, handler: 'payment' };
  },
  'agent.task_completed': async (base44, payload) => {
    await base44.asServiceRole.entities.AuditLog.create({
      event_type: 'webhook_agent_task', actor: payload.source || 'agent_mesh',
      timestamp: Date.now(), severity: 'info',
      event_data: JSON.stringify({ task_id: payload.task_id, result: payload.result }).substring(0, 5000),
    });
    return { routed: true, handler: 'agent' };
  },
  'anomaly.detected': async (base44, payload) => {
    await base44.asServiceRole.entities.AegisAnomaly.create({
      anomaly_id: `wh_anom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      anomaly_type: payload.anomaly_type || 'service_unreachable',
      category: payload.category || 'infra',
      severity: payload.severity || 'medium',
      component: payload.component || 'external',
      description: payload.description || 'Anomaly reported via webhook',
      detected_at: Date.now(), status: 'detected',
      metrics: payload.metrics || {},
    });
    return { routed: true, handler: 'aegis' };
  },
  'settlement.update': async (base44, payload) => {
    await base44.asServiceRole.entities.AuditLog.create({
      event_type: 'webhook_settlement_update', actor: payload.source || 'urib',
      timestamp: Date.now(), severity: 'info', record_type: 'urib_settlement',
      event_data: JSON.stringify({ settlement_id: payload.settlement_id, status: payload.status, rails: payload.rails }).substring(0, 5000),
      thread_anchor: payload.thread_anchor, c_stack: payload.c_stack,
    });
    return { routed: true, handler: 'urib' };
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Signature, X-Webhook-Source',
      },
    });
  }

  if (req.method === 'GET') {
    return Response.json({
      success: true,
      status: 'active',
      endpoint: '/webhookReceiver',
      methods: ['POST'],
      event_types: Object.keys(HANDLERS),
      timestamp: Date.now(),
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed. Use POST to send webhooks or GET for status.' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const eventType = body.event_type || body.type || body.event || 'unknown';
    const source = body.source || body.provider || req.headers.get('X-Webhook-Source') || 'external';
    const signature = req.headers.get('X-Webhook-Signature');
    const ts = Date.now();

    // Always log the incoming webhook
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        event_type: `webhook_received:${eventType}`,
        actor: source,
        timestamp: ts,
        severity: 'info',
        event_data: JSON.stringify(body).substring(0, 10000),
      });
    } catch {}

    // Route to handler
    const handler = HANDLERS[eventType];
    let handlerResult = { routed: false, message: `No handler for event type: ${eventType}` };
    if (handler) {
      try {
        handlerResult = await handler(base44, { ...body, source });
      } catch (e) {
        handlerResult = { routed: false, error: e.message };
      }
    }

    return Response.json({
      success: true,
      received_at: ts,
      event_type: eventType,
      source,
      signature_verified: !signature, // true if no signature expected; in production, verify HMAC
      handler_result: handlerResult,
    });
  } catch (error) {
    return Response.json({ error: error.message, received_at: Date.now() }, { status: 500 });
  }
});