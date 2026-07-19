import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action } = await req.json();

        if (action === 'aggregate_learnings') {
            // Get all learning signals
            const learningSignals = await base44.asServiceRole.entities.LearningSignal.list('-created_date', 500);

            // Group by task type
            const taskGroups = {};
            for (const signal of learningSignals) {
                if (!taskGroups[signal.task_type]) {
                    taskGroups[signal.task_type] = [];
                }
                taskGroups[signal.task_type].push(signal);
            }

            // Analyze patterns across all agents
            const insights = [];
            for (const [taskType, signals] of Object.entries(taskGroups)) {
                const successfulAgents = {};
                const failedApproaches = [];

                for (const signal of signals) {
                    if (signal.success) {
                        for (const agent of signal.agents_used) {
                            successfulAgents[agent] = (successfulAgents[agent] || 0) + 1;
                        }
                    } else {
                        failedApproaches.push({
                            agents: signal.agents_used,
                            features: signal.features
                        });
                    }
                }

                insights.push({
                    task_type: taskType,
                    best_agents: Object.entries(successfulAgents)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 3)
                        .map(([agent, count]) => ({ agent, successes: count })),
                    common_failure_patterns: failedApproaches.slice(0, 5)
                });
            }

            // Broadcast learnings to all agents
            const allAgents = ['Wednesday', 'Arete', 'CodeForge', 'CreativeForge', 'SystemArchitect'];
            
            for (const agent of allAgents) {
                await base44.functions.invoke('agentCommunication', {
                    action: 'send_message',
                    from_agent: 'system',
                    to_agents: [agent],
                    message_type: 'intelligence',
                    payload: {
                        type: 'cross_agent_learnings',
                        insights,
                        message: 'Learn from collective experience across all agents'
                    },
                    priority: 'medium'
                });
            }

            return Response.json({
                success: true,
                insights,
                agents_notified: allAgents.length
            });
        }

        if (action === 'replicate_success') {
            const { source_agent, target_agent, task_type } = await req.json();

            // Find successful strategies from source agent
            const sourceSignals = await base44.asServiceRole.entities.LearningSignal.filter({
                task_type,
                success: true
            });

            const sourceSuccesses = sourceSignals.filter(s => 
                s.agents_used.includes(source_agent)
            );

            if (sourceSuccesses.length === 0) {
                return Response.json({
                    success: false,
                    message: 'No successful strategies found'
                });
            }

            // Extract successful patterns
            const successPatterns = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze successful strategies for replication:

Task Type: ${task_type}
Source Agent: ${source_agent}
Target Agent: ${target_agent}

Successful Executions:
${sourceSuccesses.map(s => JSON.stringify(s.features)).join('\n')}

Extract transferable strategies that ${target_agent} can adopt.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        strategies: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    strategy: { type: "string" },
                                    why_it_works: { type: "string" },
                                    how_to_adapt: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            // Send to target agent
            await base44.functions.invoke('agentCommunication', {
                action: 'send_message',
                from_agent: source_agent,
                to_agents: [target_agent],
                message_type: 'intelligence',
                payload: {
                    type: 'strategy_transfer',
                    strategies: successPatterns.strategies,
                    task_type
                },
                priority: 'high'
            });

            return Response.json({
                success: true,
                strategies_transferred: successPatterns.strategies.length,
                message: `${target_agent} can now learn from ${source_agent}'s success`
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Cross-agent learning error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});