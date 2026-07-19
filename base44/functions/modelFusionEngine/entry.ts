import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Model Fusion Engine
 * Combines multiple trained models into powerful ensembles
 * Leverages diverse architectures and training approaches
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, model_ids, config } = await req.json();

        if (action === 'create_ensemble') {
            const { 
                fusion_method = 'weighted_average',
                optimization_target = 'accuracy',
                diversity_threshold = 0.3
            } = config;

            // Retrieve all models
            const modelMemories = await Promise.all(
                model_ids.map(id => 
                    base44.asServiceRole.entities.GlobalMemory.filter({
                        tags: { $contains: `model_${id}` }
                    })
                )
            );

            const models = modelMemories.map((mem, idx) => ({
                id: model_ids[idx],
                architecture: mem[0]?.content?.architecture,
                performance: mem[0]?.content?.performance || {}
            }));

            // Analyze model diversity
            const diversityAnalysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze diversity of ${models.length} models for ensemble creation:

Models:
${models.map((m, i) => `
Model ${i + 1}:
- Layers: ${m.architecture?.total_layers}
- Parameters: ${m.architecture?.total_parameters}
- Architecture Type: ${m.architecture?.skip_connections ? 'ResNet-style' : 'Standard'}
`).join('\n')}

Analyze:
1. Architecture diversity (different depths, widths, connections)
2. Complementary strengths (what each model is good at)
3. Optimal fusion strategy for ${fusion_method}
4. Predicted ensemble performance improvement

Return diversity score (0-1) and fusion recommendations.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        diversity_score: { type: "number" },
                        architecture_diversity: { type: "number" },
                        complementary_strengths: { 
                            type: "array", 
                            items: { type: "string" } 
                        },
                        optimal_weights: { 
                            type: "array", 
                            items: { type: "number" } 
                        },
                        fusion_strategy: { type: "string" },
                        predicted_improvement: { type: "number" },
                        recommendations: { 
                            type: "array", 
                            items: { type: "string" } 
                        }
                    }
                }
            });

            if (diversityAnalysis.diversity_score < diversity_threshold) {
                return Response.json({
                    warning: 'Low model diversity detected',
                    diversity_score: diversityAnalysis.diversity_score,
                    recommendation: 'Consider training more diverse architectures for better ensemble performance',
                    proceed: false
                });
            }

            // Create ensemble configuration
            const ensembleConfig = {
                ensemble_id: `ensemble_${Date.now()}`,
                member_models: models.map((m, idx) => ({
                    model_id: m.id,
                    weight: diversityAnalysis.optimal_weights[idx] || (1 / models.length)
                })),
                fusion_method,
                diversity_score: diversityAnalysis.diversity_score,
                expected_improvement: diversityAnalysis.predicted_improvement,
                created_at: Date.now()
            };

            // Store ensemble
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'system_state',
                content: ensembleConfig,
                source_agent: 'ModelFusionEngine',
                tags: ['ensemble', 'model_fusion', ...model_ids.map(id => `model_${id}`)]
            });

            return Response.json({
                success: true,
                ensemble_id: ensembleConfig.ensemble_id,
                diversity_analysis: diversityAnalysis,
                member_count: models.length,
                expected_improvement: `+${(diversityAnalysis.predicted_improvement * 100).toFixed(1)}%`,
                message: 'Ensemble created successfully'
            });
        }

        if (action === 'adaptive_fusion') {
            // Dynamically weight models based on input characteristics
            const { input_characteristics } = config;

            const adaptiveStrategy = await base44.integrations.Core.InvokeLLM({
                prompt: `Design adaptive fusion strategy for model ensemble:

Input Characteristics: ${JSON.stringify(input_characteristics)}
Available Models: ${model_ids.length}

Create a strategy that:
1. Dynamically adjusts model weights based on input type
2. Routes different inputs to specialized models
3. Combines predictions intelligently
4. Handles model disagreement

Return adaptive weighting scheme and routing logic.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        routing_rules: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    condition: { type: "string" },
                                    model_weights: { type: "array", items: { type: "number" } }
                                }
                            }
                        },
                        disagreement_resolution: { type: "string" },
                        confidence_thresholds: { type: "object" }
                    }
                }
            });

            return Response.json({
                success: true,
                adaptive_strategy: adaptiveStrategy,
                message: 'Adaptive fusion strategy generated'
            });
        }

        if (action === 'hierarchical_fusion') {
            // Create hierarchical ensemble with specialized sub-ensembles
            const { specialization_domains } = config;

            const hierarchy = [];

            for (const domain of specialization_domains) {
                const domainModels = model_ids.slice(0, Math.ceil(model_ids.length / specialization_domains.length));
                
                const subEnsemble = await base44.functions.invoke('modelFusionEngine', {
                    action: 'create_ensemble',
                    model_ids: domainModels,
                    config: {
                        fusion_method: 'weighted_average',
                        optimization_target: domain
                    }
                });

                hierarchy.push({
                    domain,
                    ensemble_id: subEnsemble.ensemble_id,
                    model_count: domainModels.length
                });
            }

            // Create top-level meta-ensemble
            const metaEnsemble = {
                meta_ensemble_id: `meta_${Date.now()}`,
                sub_ensembles: hierarchy,
                fusion_method: 'hierarchical',
                specialization_domains
            };

            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'system_state',
                content: metaEnsemble,
                source_agent: 'ModelFusionEngine',
                tags: ['meta_ensemble', 'hierarchical_fusion']
            });

            return Response.json({
                success: true,
                meta_ensemble_id: metaEnsemble.meta_ensemble_id,
                hierarchy,
                total_models: model_ids.length,
                specializations: specialization_domains.length,
                message: 'Hierarchical ensemble created'
            });
        }

        if (action === 'mixture_of_experts') {
            // Mixture of Experts routing
            const expertiseAnalysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Design Mixture of Experts system for ${model_ids.length} models:

Create a gating network that:
1. Analyzes input and routes to best expert model
2. Can combine multiple experts for complex inputs
3. Learns from routing decisions over time
4. Handles expert failure gracefully

Return MoE architecture and routing strategy.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        gating_architecture: { type: "object" },
                        expert_specializations: { 
                            type: "array", 
                            items: { type: "string" } 
                        },
                        routing_strategy: { type: "string" },
                        load_balancing_method: { type: "string" }
                    }
                }
            });

            const moeConfig = {
                moe_id: `moe_${Date.now()}`,
                experts: model_ids,
                gating_network: expertiseAnalysis.gating_architecture,
                routing_strategy: expertiseAnalysis.routing_strategy
            };

            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'system_state',
                content: moeConfig,
                source_agent: 'ModelFusionEngine',
                tags: ['mixture_of_experts', 'dynamic_routing']
            });

            return Response.json({
                success: true,
                moe_id: moeConfig.moe_id,
                expert_count: model_ids.length,
                expertise_analysis: expertiseAnalysis,
                message: 'Mixture of Experts system created'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Model fusion error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});