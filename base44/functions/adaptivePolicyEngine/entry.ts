import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ADAPTIVE POLICY ENGINE - Autonomous parameter adjustment for agents
// Agents learn optimal configurations from performance data

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { agent_name, feedback_data, correction_data } = await req.json();

        // Get agent's current policies
        const policies = await base44.asServiceRole.entities.AdaptivePolicy.filter({ agent_name });
        
        // Get agent performance history
        const performance = await base44.asServiceRole.entities.AgentPerformance.filter({ agent_name });
        const agentPerf = performance[0];

        if (!agentPerf) {
            return Response.json({ success: false, error: 'Agent not found' });
        }

        const adjustments = [];

        // Adjust confidence threshold based on success rate
        const confPolicy = policies.find(p => p.policy_type === 'confidence_threshold');
        if (agentPerf.success_rate < 70 && (!confPolicy || confPolicy.current_value > 0.6)) {
            const adjustment = await adjustPolicy(base44, agent_name, 'confidence_threshold', {
                current: confPolicy?.current_value || 0.8,
                new_value: 0.6,
                reason: 'Low success rate - lowering confidence threshold'
            });
            adjustments.push(adjustment);
        } else if (agentPerf.success_rate > 90 && (!confPolicy || confPolicy.current_value < 0.85)) {
            const adjustment = await adjustPolicy(base44, agent_name, 'confidence_threshold', {
                current: confPolicy?.current_value || 0.8,
                new_value: 0.85,
                reason: 'High success rate - raising confidence threshold'
            });
            adjustments.push(adjustment);
        }

        // Adjust timeout based on execution time
        const timeoutPolicy = policies.find(p => p.policy_type === 'timeout_duration');
        if (agentPerf.avg_execution_time_ms > 5000 && (!timeoutPolicy || timeoutPolicy.current_value < 10000)) {
            const adjustment = await adjustPolicy(base44, agent_name, 'timeout_duration', {
                current: timeoutPolicy?.current_value || 5000,
                new_value: Math.min(agentPerf.avg_execution_time_ms * 2, 15000),
                reason: 'High execution time - increasing timeout'
            });
            adjustments.push(adjustment);
        }

        // Adjust retry mechanism based on failure patterns
        if (correction_data?.failure_type === 'timeout') {
            const retryPolicy = policies.find(p => p.policy_type === 'retry_mechanism');
            const adjustment = await adjustPolicy(base44, agent_name, 'retry_mechanism', {
                current: retryPolicy?.current_value || 1,
                new_value: 3,
                reason: 'Timeout failures detected - enabling retries'
            });
            adjustments.push(adjustment);
        }

        return Response.json({
            success: true,
            agent_name,
            adjustments,
            new_policies: await base44.asServiceRole.entities.AdaptivePolicy.filter({ agent_name })
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function adjustPolicy(base44, agentName, policyType, adjustment) {
    const policies = await base44.asServiceRole.entities.AdaptivePolicy.filter({ 
        agent_name: agentName, 
        policy_type: policyType 
    });

    const adjustmentRecord = {
        timestamp: Date.now(),
        from: adjustment.current,
        to: adjustment.new_value,
        reason: adjustment.reason
    };

    if (policies.length > 0) {
        const policy = policies[0];
        const history = policy.adjustment_history || [];
        history.push(adjustmentRecord);

        await base44.asServiceRole.entities.AdaptivePolicy.update(policy.id, {
            current_value: adjustment.new_value,
            adjustment_history: history,
            last_adjusted: Date.now()
        });
    } else {
        await base44.asServiceRole.entities.AdaptivePolicy.create({
            agent_name: agentName,
            policy_type: policyType,
            current_value: adjustment.new_value,
            default_value: adjustment.current,
            adjustment_history: [adjustmentRecord],
            last_adjusted: Date.now()
        });
    }

    return adjustmentRecord;
}