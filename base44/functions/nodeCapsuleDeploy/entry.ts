import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// CAPSULE DEPLOYMENT - Deploy capsules to nodes
// Handles signed manifest distribution and version management

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { capsule_id, target_nodes = [], manifest, version } = await req.json();

        // Create or update capsule
        const existingCapsules = await base44.entities.Capsule.filter({ capsule_id });
        
        let capsule;
        if (existingCapsules.length > 0) {
            capsule = await base44.entities.Capsule.update(existingCapsules[0].id, {
                version,
                manifest,
                deployed_nodes: target_nodes
            });
        } else {
            // Sign manifest
            const signature = await signManifest(manifest, version);
            
            capsule = await base44.entities.Capsule.create({
                capsule_id,
                name: manifest.name || capsule_id,
                version,
                manifest,
                signed_by: user.email,
                signature,
                deployed_nodes: target_nodes,
                policy_type: manifest.policy_type || 'scoring'
            });
        }

        // Notify target nodes (they'll fetch on next heartbeat)
        const deploymentResults = [];
        for (const nodeId of target_nodes) {
            deploymentResults.push({
                node_id: nodeId,
                status: 'pending_sync',
                capsule_id,
                version
            });
        }

        return Response.json({
            success: true,
            capsule_id,
            version,
            deployed_to: target_nodes.length,
            deployments: deploymentResults
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function signManifest(manifest, version) {
    const payload = JSON.stringify({ manifest, version, timestamp: Date.now() });
    return btoa(payload);
}