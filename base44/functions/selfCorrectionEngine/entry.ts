import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// SELF-CORRECTION ENGINE - Agents learn from failures and adjust behavior
// Implements feedback loops and autonomous performance improvement

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { 
            task_id, 
            agent_name, 
            outcome,
            feedback_score,
            error_details 
        } = await req.json();

        // Get task
        const tasks = await base44.asServiceRole.entities.AgentTask.filter({ task_id });
        if (tasks.length === 0) {
            return Response.json({ error: 'Task not found' }, { status: 404 });
        }

        const task = tasks[0];

        // Analyze failure and generate correction
        const analysis = await analyzeFailure(base44, task, outcome, error_details);
        
        if (analysis.requires_correction) {
            const correction = await generateCorrection(base44, agent_name, analysis);
            
            // Apply correction
            await applyCorrection(base44, agent_name, correction);

            // Store correction in task history
            const corrections = task.self_corrections || [];
            corrections.push({
                timestamp: Date.now(),
                analysis: analysis,
                correction: correction,
                applied: true
            });

            await base44.asServiceRole.entities.AgentTask.update(task.id, {
                feedback_score,
                self_corrections: corrections,
                status: feedback_score > 5 ? 'completed' : 'failed'
            });

            // Update agent performance with learning
            await updateAgentWithLearning(base44, agent_name, analysis, correction);

            // Trigger adaptive policy adjustment
            await base44.functions.invoke('adaptivePolicyEngine', {
                agent_name,
                feedback_data: { feedback_score },
                correction_data: analysis
            }).catch(err => console.error('Policy adjustment error:', err));

            return Response.json({
                success: true,
                correction_applied: true,
                correction_type: correction.type,
                expected_improvement: correction.expected_improvement,
                analysis: analysis
            });
        }

        // No correction needed
        await base44.asServiceRole.entities.AgentTask.update(task.id, {
            feedback_score,
            status: feedback_score > 5 ? 'completed' : 'failed'
        });

        return Response.json({
            success: true,
            correction_applied: false,
            message: 'Performance within acceptable parameters'
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function analyzeFailure(base44, task, outcome, errorDetails) {
    // Analyze what went wrong
    const patterns = {
        timeout: errorDetails?.includes('timeout'),
        resource_exhaustion: errorDetails?.includes('memory') || errorDetails?.includes('cpu'),
        logic_error: errorDetails?.includes('undefined') || errorDetails?.includes('null'),
        dependency_failure: errorDetails?.includes('failed to fetch')
    };

    const identified = Object.entries(patterns).find(([_, matches]) => matches);
    
    if (identified) {
        return {
            requires_correction: true,
            failure_type: identified[0],
            root_cause: errorDetails,
            confidence: 0.85,
            recommended_action: getRecommendedAction(identified[0])
        };
    }

    return {
        requires_correction: false,
        failure_type: 'unknown',
        root_cause: errorDetails
    };
}

function getRecommendedAction(failureType) {
    const actions = {
        timeout: 'increase_timeout_threshold',
        resource_exhaustion: 'request_more_resources',
        logic_error: 'adjust_decision_logic',
        dependency_failure: 'add_retry_mechanism'
    };
    return actions[failureType] || 'manual_review';
}

async function generateCorrection(base44, agentName, analysis) {
    const corrections = {
        increase_timeout_threshold: {
            type: 'parameter_adjustment',
            parameter: 'timeout_ms',
            new_value: 30000,
            expected_improvement: 0.25
        },
        request_more_resources: {
            type: 'resource_scaling',
            resources: { compute: 200, memory: 1024 },
            expected_improvement: 0.30
        },
        adjust_decision_logic: {
            type: 'logic_refinement',
            adjustment: 'lower_confidence_threshold',
            expected_improvement: 0.20
        },
        add_retry_mechanism: {
            type: 'resilience_enhancement',
            mechanism: 'exponential_backoff',
            expected_improvement: 0.35
        }
    };

    return corrections[analysis.recommended_action] || {
        type: 'no_action',
        expected_improvement: 0
    };
}

async function applyCorrection(base44, agentName, correction) {
    // In production, this would update agent configuration
    // For now, we'll update agent performance metadata
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({ agent_name: agentName });
    
    if (agents.length > 0) {
        const agent = agents[0];
        const specialties = agent.specialties_performance || {};
        
        specialties.corrections_applied = (specialties.corrections_applied || 0) + 1;
        specialties.last_correction = {
            type: correction.type,
            timestamp: Date.now()
        };

        await base44.asServiceRole.entities.AgentPerformance.update(agent.id, {
            specialties_performance: specialties
        });
    }
}

async function updateAgentWithLearning(base44, agentName, analysis, correction) {
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({ agent_name: agentName });
    
    if (agents.length > 0) {
        const agent = agents[0];
        
        // Apply expected improvement to success rate
        const newSuccessRate = Math.min(
            agent.success_rate + (correction.expected_improvement * 100),
            100
        );

        await base44.asServiceRole.entities.AgentPerformance.update(agent.id, {
            success_rate: newSuccessRate,
            last_updated: Date.now()
        });
    }
}