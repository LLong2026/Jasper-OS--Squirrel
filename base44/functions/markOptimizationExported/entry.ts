import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Mark an OptimizationEvent as 'exported' after it has been synced to Google Sheets
// by the Arete Optimization Export workflow. Invoked with service role (no user context).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const entityId = body.entity_id || body.proposal_id;

    if (!entityId) {
      return Response.json({ error: 'entity_id is required' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.OptimizationEvent.update(entityId, {
      status: 'exported'
    });

    return Response.json({
      success: true,
      entity_id: entityId,
      status: updated.status,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});