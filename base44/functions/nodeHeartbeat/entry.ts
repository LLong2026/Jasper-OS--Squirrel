import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// NODE HEARTBEAT - Continuous health monitoring
// Nodes report status, metrics, and queue depth

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            node_id, 
            metrics, 
            queue_size = 0,
            merkle_root,
            plugin_status = []
        } = await req.json();

        // Find node
        const nodes = await base44.asServiceRole.entities.Node.filter({ node_id });
        if (nodes.length === 0) {
            return Response.json({ error: 'Node not registered' }, { status: 404 });
        }

        const node = nodes[0];

        // Determine health status
        const status = determineStatus(metrics, queue_size);

        // Update node
        await base44.asServiceRole.entities.Node.update(node.id, {
            last_heartbeat: Date.now(),
            status,
            metrics,
            merkle_root_current: merkle_root || node.merkle_root_current
        });

        // Check for pending updates or commands
        const pendingCommands = await checkPendingCommands(node_id);

        return Response.json({
            success: true,
            status,
            commands: pendingCommands,
            timestamp: Date.now()
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

function determineStatus(metrics, queueSize) {
    if (!metrics) return 'degraded';
    
    if (metrics.cpu_usage > 90 || metrics.memory_usage > 90) return 'degraded';
    if (queueSize > 10000) return 'degraded';
    
    return 'active';
}

async function checkPendingCommands(nodeId) {
    // Simulate checking for pending capsule updates, config changes, etc.
    return [];
}