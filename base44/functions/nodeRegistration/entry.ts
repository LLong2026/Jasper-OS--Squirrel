import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// NODE REGISTRATION - Control plane endpoint for node registration
// Handles node bootstrap, key exchange, and capability registration

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            node_id, 
            node_type, 
            public_key, 
            capabilities = [],
            attestation_token 
        } = await req.json();

        // Verify attestation if provided (TPM/SGX)
        if (attestation_token) {
            const attestationValid = await verifyAttestation(attestation_token);
            if (!attestationValid) {
                return Response.json({ 
                    error: 'Attestation verification failed' 
                }, { status: 403 });
            }
        }

        // Check if node already exists
        const existing = await base44.asServiceRole.entities.Node.filter({ node_id });
        
        let node;
        if (existing.length > 0) {
            // Update existing node
            node = await base44.asServiceRole.entities.Node.update(existing[0].id, {
                status: 'active',
                public_key,
                capabilities,
                last_heartbeat: Date.now()
            });
        } else {
            // Register new node
            node = await base44.asServiceRole.entities.Node.create({
                node_id,
                node_type,
                public_key,
                capabilities,
                status: 'active',
                last_heartbeat: Date.now(),
                installed_plugins: [],
                metrics: {}
            });
        }

        // Generate bootstrap tokens
        const bootstrapToken = generateBootstrapToken(node_id, public_key);

        return Response.json({
            success: true,
            node_id,
            bootstrap_token: bootstrapToken,
            control_plane_endpoint: 'wss://control.base44.com',
            initial_capsules: await getInitialCapsules()
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function verifyAttestation(token) {
    // Simulate attestation verification
    return token && token.length > 10;
}

function generateBootstrapToken(nodeId, publicKey) {
    const payload = `${nodeId}:${publicKey}:${Date.now()}`;
    return btoa(payload);
}

async function getInitialCapsules() {
    return [
        { capsule_id: 'base44.safety.v1', version: '1.0.0' },
        { capsule_id: 'base44.scoring.v1', version: '1.0.0' }
    ];
}