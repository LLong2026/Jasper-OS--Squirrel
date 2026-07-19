import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Meta-Learning Engine - Learns how to learn better
 * Agents analyze what makes learning effective and optimize the learning process itself
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, agent_name, payload } = await req.json();

        if (action === 'analyze_learning_effectiveness') {
            // Analyze what learning approaches work best for this agent
            const improvements = await base44.asServiceRole.entities.ImprovementProposal.filter({
                agent_name,
                status: 'implemented'
            });

            const skillGaps = await base44.asServiceRole.entities.SkillGap.filter({
                agent_name,
                status: 'acquired'
            });

            const fineTuningJobs = await base44.asServiceRole.entities.FineTuningJob.filter({
                agent_name,
                status: 'deployed'
            });

            // Meta-analyze learning patterns
            const metaAnalysis = await base44.integrations.Core.InvokeLLM({
                prompt: `You are ${agent_name}. Analyze your own learning process to learn how to learn better.

Implemented Improvements:
${JSON.stringify(improvements.slice(0, 10), null, 2)}

Acquired Skills:
${JSON.stringify(skillGaps.slice(0, 10), null, 2)}

Fine-Tuning Results:
${JSON.stringify(fineTuningJobs.slice(0, 5), null, 2)}

Meta-analyze:
1. Which learning methods work best for you? (fine-tuning, prompt engineering, tool integration)
2. What types of weaknesses do you learn from fastest?
3. What's your optimal learning approach for different skill types?
4. How can you accelerate future learning?
5. What patterns exist in successful vs failed learning attempts?

Extract generalizable principles about YOUR learning process.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        most_effective_method: {
                            type: "string",
                            enum: ["fine_tuning", "prompt_engineering", "tool_integration", "collaboration"]
                        },
                        learning_velocity: {
                            type: "object",
                            properties: {
                                fast_learning_domains: { type: "array", items: { type: "string" } },
                                slow_learning_domains: { type: "array", items: { type: "string" } }
                            }
                        },
                        optimal_strategies: {
                            type: "object",
                            additionalProperties: true
                        },
                        learning_bottlenecks: {
                            type: "array",
                            items: { type: "string" }
                        },
                        meta_insights: {
                            type: "array",
                            items: { type: "string" }
                        },
                        suggested_optimizations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    optimization: { type: "string" },
                                    expected_speedup: { type: "number" }
                                }
                            }
                        }
                    }
                }
            });

            // Store meta-learning insights
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'system_state',
                content: {
                    agent: agent_name,
                    meta_learning_analysis: metaAnalysis,
                    analyzed_at: Date.now()
                },
                source_agent: agent_name,
                tags: ['meta_learning', `agent_${agent_name}`]
            });

            return Response.json({
                success: true,
                meta_analysis: metaAnalysis,
                learning_optimizations_available: metaAnalysis.suggested_optimizations.length
            });
        }

        if (action === 'optimize_learning_process') {
            const { meta_analysis } = payload;

            // Apply meta-learning optimizations
            const optimizations = [];

            for (const opt of meta_analysis.suggested_optimizations) {
                // Adjust learning policies based on meta-insights
                await base44.asServiceRole.entities.AdaptivePolicy.create({
                    agent_name,
                    policy_type: 'learning_strategy',
                    current_value: opt.expected_speedup,
                    default_value: 1.0,
                    adjustment_history: [{
                        timestamp: Date.now(),
                        reason: 'meta_learning_optimization',
                        optimization: opt.optimization
                    }],
                    last_adjusted: Date.now()
                });

                optimizations.push({
                    applied: opt.optimization,
                    expected_impact: opt.expected_speedup
                });
            }

            return Response.json({
                success: true,
                optimizations_applied: optimizations.length,
                details: optimizations,
                message: `${agent_name} optimized its learning process based on meta-analysis`
            });
        }

        if (action === 'transfer_learning_insights') {
            // Transfer successful learning strategies to other agents
            const sourceAgent = agent_name;
            const { target_agents } = payload;

            const sourceInsights = await base44.asServiceRole.entities.GlobalMemory.filter({
                source_agent: sourceAgent,
                tags: { $contains: 'meta_learning' }
            }, '-created_date', 1);

            if (sourceInsights.length === 0) {
                return Response.json({
                    success: false,
                    error: 'No meta-learning insights to transfer'
                }, { status: 404 });
            }

            const insights = sourceInsights[0].content.meta_learning_analysis;
            const transfers = [];

            for (const targetAgent of target_agents) {
                // Adapt insights to target agent
                const adaptedInsights = await base44.integrations.Core.InvokeLLM({
                    prompt: `${sourceAgent} learned effective learning strategies. Adapt them for ${targetAgent}.

${sourceAgent}'s Learning Insights:
${JSON.stringify(insights, null, 2)}

How can ${targetAgent} apply these lessons to its own learning process?
What needs to be adapted based on ${targetAgent}'s specialization?`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            applicable_strategies: { type: "array", items: { type: "string" } },
                            adaptations_needed: { type: "string" },
                            expected_benefit: { type: "string" }
                        }
                    }
                });

                // Apply to target agent
                await base44.asServiceRole.entities.GlobalMemory.create({
                    memory_type: 'experience',
                    content: {
                        transferred_from: sourceAgent,
                        adapted_insights: adaptedInsights,
                        transfer_date: Date.now()
                    },
                    source_agent: targetAgent,
                    tags: ['transferred_learning', `from_${sourceAgent}`, `to_${targetAgent}`]
                });

                transfers.push({
                    target: targetAgent,
                    strategies_transferred: adaptedInsights.applicable_strategies.length
                });
            }

            return Response.json({
                success: true,
                transfers,
                message: 'Learning insights transferred across agents'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Meta-learning error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});