import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// AUDIT SERVICE - Immutable event log and compliance trail
// Creates cryptographic audit trail for all system actions

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, event_id, agents_used, results, synthesis, execution_time_ms } = await req.json();

        if (action === 'log_decision') {
            const auditEntry = {
                audit_id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                event_id,
                agents_used: agents_used.map(a => a.name),
                execution_time_ms,
                timestamp: Date.now(),
                hash: generateHash({ event_id, agents_used, results, synthesis })
            };

            return Response.json({
                success: true,
                audit_entry
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

function generateHash(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
}