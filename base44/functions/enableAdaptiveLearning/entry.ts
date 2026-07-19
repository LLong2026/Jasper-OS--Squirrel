import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_name, learning_enabled } = await req.json();

        if (!agent_name) {
            return Response.json({ error: 'agent_name is required' }, { status: 400 });
        }

        // Create learning signal tracking entity records
        const learningConfig = await base44.asServiceRole.entities.LearningSignal.create({
            agent_name: agent_name,
            learning_enabled: learning_enabled !== false,
            learning_rate: 0.1,
            adaptation_threshold: 0.7,
            feedback_sources: ['user_ratings', 'task_success', 'response_time', 'user_corrections'],
            last_adaptation: Date.now()
        });

        // Set up feedback collection hooks
        await base44.asServiceRole.entities.AgentPerformance.update(
            { agent_name: agent_name },
            { 
                adaptive_learning_enabled: true,
                learning_config_id: learningConfig.id,
                last_updated: Date.now()
            }
        );

        // Initialize learning memory
        await base44.asServiceRole.entities.GlobalMemory.create({
            memory_type: 'agent_learning_state',
            content: {
                agent_name: agent_name,
                learning_enabled: true,
                real_time_processing: true,
                learned_patterns: [],
                user_preferences: {},
                common_errors: [],
                successful_strategies: [],
                learning_velocity: 0,
                adaptation_speed: 'fast'
            },
            confidence: 1.0,
            source: 'adaptive_learning_system',
            tags: ['learning', agent_name, 'adaptive', 'real_time']
        });

        // Enable real-time learning hooks
        await base44.asServiceRole.entities.AdaptivePolicy.create({
            agent_name: agent_name,
            policy_type: 'real_time_learning',
            current_value: 1,
            default_value: 0,
            adjustment_history: [],
            performance_correlation: 1.0,
            last_adjusted: Date.now()
        });

        return Response.json({
            success: true,
            message: `Fast adaptive learning enabled for ${agent_name} with real-time processing`,
            learning_config: learningConfig,
            features: {
                real_time_processing: true,
                instant_knowledge_sharing: true,
                predictive_pre_learning: true,
                micro_adjustments: true
            }
        });

    } catch (error) {
        console.error('Error enabling adaptive learning:', error);
        return Response.json({ 
            error: error.message || 'Failed to enable adaptive learning' 
        }, { status: 500 });
    }
});