import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// MODEL REGISTRY - Version control and deployment for AI models
// Manages model lifecycle from training to production

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, model, rollout_percentage = 10 } = await req.json();

        if (action === 'register') {
            // Register new model
            const registered = {
                ...model,
                status: 'registered',
                registered_at: Date.now()
            };

            // Start canary deployment
            await base44.functions.invoke('capsuleComposer', {
                action: 'deploy_canary',
                model_id: model.model_id,
                percentage: rollout_percentage
            });

            return Response.json({
                success: true,
                model: registered,
                deployment_status: 'canary_deployed'
            });
        }

        if (action === 'promote') {
            // Promote model to production
            return Response.json({
                success: true,
                model_id: model.model_id,
                status: 'promoted_to_production'
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