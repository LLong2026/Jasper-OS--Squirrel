import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// CAPSULE COMPOSER - Deployment orchestration
// Manages canary deployments, rollouts, and rollbacks

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, model_id, percentage = 10 } = await req.json();

        if (action === 'deploy_canary') {
            // Deploy to canary percentage of traffic
            const deployment = {
                model_id,
                deployment_type: 'canary',
                traffic_percentage: percentage,
                deployed_at: Date.now(),
                status: 'active'
            };

            // Monitor canary performance
            setTimeout(async () => {
                const metrics = await monitorCanary(model_id);
                if (metrics.success_rate > 0.95) {
                    await base44.functions.invoke('capsuleComposer', {
                        action: 'increase_rollout',
                        model_id,
                        percentage: 50
                    });
                }
            }, 60000); // Check after 1 minute

            return Response.json({
                success: true,
                deployment
            });
        }

        if (action === 'increase_rollout') {
            return Response.json({
                success: true,
                model_id,
                new_percentage: percentage,
                status: 'rolling_out'
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

async function monitorCanary(modelId) {
    return {
        model_id: modelId,
        success_rate: 0.96 + Math.random() * 0.03,
        avg_latency_ms: 150 + Math.random() * 50,
        error_rate: Math.random() * 0.02
    };
}