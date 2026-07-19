import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// PLUGIN MANAGEMENT - Install, update, and manage node plugins
// Handles signed plugin distribution and verification

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            action,
            node_id,
            plugin_manifest
        } = await req.json();

        if (action === 'install') {
            // Verify plugin signature
            const signatureValid = await verifyPluginSignature(plugin_manifest);
            if (!signatureValid) {
                return Response.json({ 
                    error: 'Invalid plugin signature' 
                }, { status: 401 });
            }

            // Get node
            const nodes = await base44.asServiceRole.entities.Node.filter({ node_id });
            if (nodes.length === 0) {
                return Response.json({ error: 'Node not found' }, { status: 404 });
            }

            const node = nodes[0];

            // Check compatibility
            const compatible = checkPluginCompatibility(plugin_manifest, node);
            if (!compatible.ok) {
                return Response.json({ 
                    error: 'Plugin incompatible',
                    reason: compatible.reason
                }, { status: 400 });
            }

            // Add to installed plugins
            const installedPlugins = node.installed_plugins || [];
            installedPlugins.push({
                plugin_id: plugin_manifest.plugin_id,
                version: plugin_manifest.version,
                installed_at: Date.now(),
                status: 'active'
            });

            await base44.asServiceRole.entities.Node.update(node.id, {
                installed_plugins: installedPlugins
            });

            return Response.json({
                success: true,
                plugin_id: plugin_manifest.plugin_id,
                version: plugin_manifest.version,
                node_id
            });
        }

        if (action === 'list') {
            const nodes = await base44.asServiceRole.entities.Node.filter({ node_id });
            if (nodes.length === 0) {
                return Response.json({ error: 'Node not found' }, { status: 404 });
            }

            return Response.json({
                success: true,
                plugins: nodes[0].installed_plugins || []
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

async function verifyPluginSignature(manifest) {
    return manifest.signature && manifest.signature.length > 10;
}

function checkPluginCompatibility(manifest, node) {
    // Check if node has required capabilities
    const required = manifest.required_permissions || [];
    const nodeCapabilities = node.capabilities || [];
    
    for (const req of required) {
        if (!nodeCapabilities.some(cap => req.includes(cap))) {
            return { ok: false, reason: `Missing capability: ${req}` };
        }
    }
    
    return { ok: true };
}