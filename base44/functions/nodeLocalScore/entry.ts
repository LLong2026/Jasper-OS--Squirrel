import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// LOCAL SCORING ENDPOINT - Low-latency policy scoring
// Nodes can call this for centralized model inference when local cache misses

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            node_id,
            capsule_id, 
            input_state, 
            context = {},
            signature 
        } = await req.json();

        // Verify node
        const nodes = await base44.asServiceRole.entities.Node.filter({ node_id });
        if (nodes.length === 0) {
            return Response.json({ error: 'Unknown node' }, { status: 404 });
        }

        // Get capsule
        const capsules = await base44.asServiceRole.entities.Capsule.filter({ capsule_id });
        if (capsules.length === 0) {
            return Response.json({ error: 'Capsule not found' }, { status: 404 });
        }

        const capsule = capsules[0];

        // Perform scoring based on capsule type
        const score = await performScore(capsule, input_state, context);

        // Log decision for learning
        await base44.asServiceRole.entities.NodeEvent.create({
            node_id,
            event_type: 'local_score',
            payload: {
                capsule_id,
                score,
                input_state,
                context
            },
            synced: true
        });

        return Response.json({
            success: true,
            action: score.action,
            confidence: score.confidence,
            policy_id: capsule_id,
            explanation: score.explanation,
            timestamp: Date.now()
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function performScore(capsule, inputState, context) {
    // Simulate policy scoring
    const actions = ['approve', 'reject', 'review', 'escalate'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    return {
        action,
        confidence: 0.80 + Math.random() * 0.15,
        explanation: `Policy ${capsule.capsule_id} evaluated input and decided: ${action}`
    };
}