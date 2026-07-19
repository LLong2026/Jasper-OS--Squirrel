import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action_type, details, estimated_cost } = await req.json();

        // Define risk factors
        let risk_score = 0;
        const risk_factors = [];

        // Cost-based risk
        if (estimated_cost > 1000) {
            risk_score += 3;
            risk_factors.push('High cost transaction');
        } else if (estimated_cost > 100) {
            risk_score += 2;
            risk_factors.push('Medium cost transaction');
        } else if (estimated_cost > 0) {
            risk_score += 1;
        }

        // Action type risk
        const high_risk_actions = ['purchase', 'payment', 'deployment', 'code_modification'];
        const medium_risk_actions = ['booking', 'scheduling', 'email', 'data_access'];
        
        if (high_risk_actions.includes(action_type)) {
            risk_score += 2;
            risk_factors.push('High-risk action type');
        } else if (medium_risk_actions.includes(action_type)) {
            risk_score += 1;
            risk_factors.push('Medium-risk action type');
        }

        // Data sensitivity
        if (details.involves_payment_info) {
            risk_score += 2;
            risk_factors.push('Involves payment information');
        }

        if (details.involves_personal_data) {
            risk_score += 1;
            risk_factors.push('Involves personal data');
        }

        // Reversibility
        if (details.irreversible === true) {
            risk_score += 2;
            risk_factors.push('Irreversible action');
        }

        // Determine risk level
        let risk_level;
        if (risk_score >= 7) {
            risk_level = 'critical';
        } else if (risk_score >= 5) {
            risk_level = 'high';
        } else if (risk_score >= 3) {
            risk_level = 'medium';
        } else {
            risk_level = 'low';
        }

        // Recommend approval workflow
        const requires_approval = risk_level === 'high' || risk_level === 'critical' || 
                                 (estimated_cost && estimated_cost > (user.auto_approve_limit || 50));

        return Response.json({
            success: true,
            risk_level,
            risk_score,
            risk_factors,
            requires_approval,
            recommendation: requires_approval 
                ? 'Manual approval recommended before execution'
                : 'Safe for automatic execution'
        });

    } catch (error) {
        console.error('Risk assessment error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});