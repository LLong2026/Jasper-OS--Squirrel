import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, data } = await req.json();

        switch (action) {
            case 'analyzeLead':
                return Response.json({
                    success: true,
                    lead_score: Math.floor(Math.random() * 100),
                    priority: data.priority || 'high',
                    recommended_approach: data.approach || "Direct outreach with value proposition",
                    close_probability: (Math.random() * 80 + 20).toFixed(1)
                });

            case 'generateProposal':
                return Response.json({
                    success: true,
                    proposal: {
                        executive_summary: data.summary || "Executive summary tailored to client needs",
                        value_proposition: data.value || "Unique value proposition",
                        pricing_strategy: data.pricing || "Competitive pricing framework"
                    }
                });

            case 'trackPipeline':
                return Response.json({
                    success: true,
                    pipeline_status: {
                        leads: Math.floor(Math.random() * 100),
                        qualified: Math.floor(Math.random() * 50),
                        proposals: Math.floor(Math.random() * 20),
                        closing: Math.floor(Math.random() * 10)
                    }
                });

            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});