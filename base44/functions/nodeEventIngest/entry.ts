import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// NODE EVENT INGEST - Control plane endpoint for node event ingestion
// Accepts batched events from nodes with Merkle proofs

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            node_id, 
            events = [],
            batch_merkle_root,
            batch_signature
        } = await req.json();

        // Verify node exists and is active
        const nodes = await base44.asServiceRole.entities.Node.filter({ node_id });
        if (nodes.length === 0) {
            return Response.json({ error: 'Unknown node' }, { status: 404 });
        }

        const node = nodes[0];
        if (node.status === 'terminated') {
            return Response.json({ error: 'Node terminated' }, { status: 403 });
        }

        // Verify batch signature
        const signatureValid = await verifyBatchSignature(
            events, 
            batch_merkle_root, 
            batch_signature, 
            node.public_key
        );

        if (!signatureValid) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Store events
        const storedEvents = [];
        for (const event of events) {
            const stored = await base44.asServiceRole.entities.NodeEvent.create({
                node_id,
                event_type: event.event_type,
                payload: event.payload,
                local_seq: event.local_seq,
                merkle_leaf_hash: event.merkle_leaf_hash,
                signature: event.signature,
                synced: true
            });
            storedEvents.push(stored);
        }

        // Forward to Event Mesh for processing
        await base44.functions.invoke('eventMesh', {
            event_type: 'node_events_batch',
            payload: {
                node_id,
                event_count: events.length,
                merkle_root: batch_merkle_root
            }
        });

        return Response.json({
            success: true,
            ingested: events.length,
            batch_merkle_root,
            control_plane_anchor_id: `anchor_${Date.now()}`
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function verifyBatchSignature(events, merkleRoot, signature, publicKey) {
    // Simulate signature verification
    return signature && signature.length > 10;
}