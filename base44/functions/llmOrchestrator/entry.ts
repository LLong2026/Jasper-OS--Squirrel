import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Advanced LLM Orchestration Engine
 * - Dynamic routing based on task complexity and performance history
 * - Real-time performance tracking and ranking
 * - Cost management and optimization
 * - Multi-model fusion and consensus
 * - Adaptive learning from outcomes
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'route_task') {
            const {
                prompt,
                system_message,
                task_type,
                complexity_level,
                max_cost_usd,
                require_consensus = false,
                min_quality_score = 7,
                user_feedback_context
            } = payload;

            const startTime = Date.now();

            // Analyze task complexity if not provided
            const complexity = complexity_level || await analyzeTaskComplexity(prompt, task_type, base44);

            // Get performance history for all available models
            const modelPerformance = await base44.asServiceRole.entities.LLMPerformance.list();

            // Filter models based on constraints
            const eligibleModels = await selectEligibleModels({
                modelPerformance,
                task_type,
                complexity,
                max_cost_usd,
                min_quality_score,
                user_feedback_context
            });

            if (eligibleModels.length === 0) {
                return Response.json({
                    success: false,
                    error: 'No models meet the specified constraints',
                    suggestion: 'Increase budget or lower quality requirements'
                }, { status: 400 });
            }

            // Route to best model or consensus
            let result;
            if (require_consensus || complexity === 'critical') {
                result = await executeConsensus({
                    prompt,
                    system_message,
                    models: eligibleModels.slice(0, 3),
                    base44
                });
            } else {
                const selectedModel = eligibleModels[0];
                result = await executeSingleModel({
                    prompt,
                    system_message,
                    model: selectedModel,
                    base44
                });
            }

            const executionTime = Date.now() - startTime;

            // Track performance
            await trackPerformance({
                models: result.models_used,
                task_type,
                execution_time: executionTime,
                cost: result.cost_usd,
                success: result.success,
                base44
            });

            return Response.json({
                success: true,
                response: result.response,
                routing_decision: {
                    selected_models: result.models_used,
                    complexity_assessed: complexity,
                    reasoning: result.routing_reasoning,
                    cost_usd: result.cost_usd,
                    execution_time_ms: executionTime
                },
                proof: {
                    source: result.primary_provider,
                    model: result.primary_model,
                    reasoning: result.routing_reasoning
                }
            });
        }

        if (action === 'get_model_rankings') {
            const { task_type, sort_by = 'performance_rank' } = payload;

            const filter = task_type ? { task_type } : {};
            const rankings = await base44.asServiceRole.entities.LLMPerformance.filter(
                filter,
                `-${sort_by}`,
                50
            );

            return Response.json({
                success: true,
                rankings: rankings.map(r => ({
                    provider: r.provider,
                    model: r.model,
                    task_type: r.task_type,
                    performance_rank: r.performance_rank,
                    success_rate: r.success_rate,
                    avg_quality_score: r.avg_quality_score,
                    avg_response_time_ms: r.avg_response_time_ms,
                    total_cost_usd: r.total_cost_usd,
                    total_requests: r.total_requests
                }))
            });
        }

        if (action === 'update_performance_feedback') {
            const { execution_id, quality_score, feedback_notes, models_used } = payload;

            for (const model of models_used) {
                const existing = await base44.asServiceRole.entities.LLMPerformance.filter({
                    provider: model.provider,
                    model: model.model_name,
                    task_type: model.task_type
                });

                if (existing.length > 0) {
                    const perf = existing[0];
                    const newAvgQuality = (perf.avg_quality_score * perf.total_requests + quality_score) / (perf.total_requests + 1);
                    
                    await base44.asServiceRole.entities.LLMPerformance.update(perf.id, {
                        avg_quality_score: newAvgQuality,
                        performance_rank: calculatePerformanceRank({
                            success_rate: perf.success_rate,
                            avg_quality_score: newAvgQuality,
                            avg_response_time_ms: perf.avg_response_time_ms
                        })
                    });
                }
            }

            return Response.json({ success: true, message: 'Performance feedback recorded' });
        }

        if (action === 'get_cost_summary') {
            const { start_date, end_date, provider } = payload;

            const filter = provider ? { provider } : {};
            const costs = await base44.asServiceRole.entities.LLMCostTracker.filter(filter);

            const summary = costs.reduce((acc, cost) => {
                acc.total_cost += cost.total_cost_usd;
                acc.total_requests += cost.total_requests;
                acc.total_tokens += cost.total_tokens;
                
                if (!acc.by_provider[cost.provider]) {
                    acc.by_provider[cost.provider] = { cost: 0, requests: 0, tokens: 0 };
                }
                acc.by_provider[cost.provider].cost += cost.total_cost_usd;
                acc.by_provider[cost.provider].requests += cost.total_requests;
                acc.by_provider[cost.provider].tokens += cost.total_tokens;
                
                return acc;
            }, { total_cost: 0, total_requests: 0, total_tokens: 0, by_provider: {} });

            return Response.json({
                success: true,
                summary,
                cost_optimization_suggestions: generateCostOptimizations(summary)
            });
        }

        if (action === 'adaptive_model_fusion') {
            const { prompt, system_message, task_type, fusion_strategy = 'weighted_ensemble' } = payload;

            // Get top 3 models for this task type
            const topModels = await base44.asServiceRole.entities.LLMPerformance.filter(
                { task_type },
                '-performance_rank',
                3
            );

            if (topModels.length < 2) {
                return Response.json({
                    success: false,
                    error: 'Insufficient performance data for model fusion'
                }, { status: 400 });
            }

            // Execute all models in parallel
            const responses = await Promise.all(
                topModels.map(m => executeSingleModel({
                    prompt,
                    system_message,
                    model: { provider: m.provider, model_name: m.model },
                    base44
                }))
            );

            // Fuse responses based on strategy
            let fusedResponse;
            if (fusion_strategy === 'weighted_ensemble') {
                fusedResponse = await weightedFusion(responses, topModels, base44);
            } else if (fusion_strategy === 'best_of_n') {
                fusedResponse = responses.reduce((best, curr) => 
                    !best || curr.confidence > best.confidence ? curr : best
                );
            }

            return Response.json({
                success: true,
                response: fusedResponse.response,
                fusion_strategy,
                models_used: topModels.map(m => `${m.provider}/${m.model}`),
                confidence_score: fusedResponse.confidence
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('LLM Orchestrator error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// Helper functions

async function analyzeTaskComplexity(prompt, task_type, base44) {
    const indicators = {
        length: prompt.length,
        hasMultiStep: /step|then|after|following|sequence/i.test(prompt),
        hasAnalysis: /analyze|evaluate|assess|compare|critique/i.test(prompt),
        hasCreation: /create|design|build|generate|develop/i.test(prompt),
        requiresReasoning: /why|how|explain|prove|deduce/i.test(prompt)
    };

    let complexityScore = 0;
    if (indicators.length > 500) complexityScore += 2;
    if (indicators.hasMultiStep) complexityScore += 2;
    if (indicators.hasAnalysis) complexityScore += 2;
    if (indicators.hasCreation) complexityScore += 1;
    if (indicators.requiresReasoning) complexityScore += 2;

    if (complexityScore >= 7) return 'critical';
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
}

async function selectEligibleModels({ modelPerformance, task_type, complexity, max_cost_usd, min_quality_score }) {
    const costPerRequest = {
        'gpt-4-turbo': 0.02,
        'gpt-4': 0.015,
        'gpt-3.5-turbo': 0.002,
        'claude-3-opus': 0.025,
        'claude-3.5-sonnet': 0.015,
        'claude-3-sonnet': 0.01,
        'claude-3-haiku': 0.003,
        'gemini-ultra': 0.02,
        'gemini-pro': 0.005,
        'mixtral-8x7b-instruct': 0.007,
        'codestral-latest': 0.008,
        'llama-3.1-sonar-large-128k-online': 0.012
    };

    let eligible = modelPerformance
        .filter(m => {
            const cost = costPerRequest[m.model] || 0.01;
            const meetsQuality = m.avg_quality_score >= min_quality_score;
            const withinBudget = !max_cost_usd || cost <= max_cost_usd;
            const hasData = m.total_requests > 5; // Require some historical data
            
            return meetsQuality && withinBudget && hasData;
        })
        .sort((a, b) => b.performance_rank - a.performance_rank);

    // If no models meet criteria, fall back to defaults
    if (eligible.length === 0) {
        eligible = [
            { provider: 'anthropic', model: 'claude-3.5-sonnet', performance_rank: 85 },
            { provider: 'openai', model: 'gpt-4-turbo', performance_rank: 90 },
            { provider: 'google', model: 'gemini-pro', performance_rank: 80 }
        ];
    }

    return eligible.map(m => ({
        provider: m.provider,
        model_name: m.model,
        performance_rank: m.performance_rank,
        task_type: task_type
    }));
}

async function executeSingleModel({ prompt, system_message, model, base44 }) {
    const startTime = Date.now();
    
    const integrationMap = {
        'openai': 'openaiIntegration',
        'anthropic': 'anthropicIntegration',
        'google': 'googleIntegration',
        'perplexity': 'perplexityIntegration',
        'mistral': 'mistralIntegration',
        'cohere': 'cohereIntegration',
        'meta': 'metaIntegration'
    };

    const functionName = integrationMap[model.provider];
    if (!functionName) {
        throw new Error(`Unknown provider: ${model.provider}`);
    }

    const response = await base44.functions.invoke(functionName, {
        model: model.model_name,
        prompt,
        system_message,
        temperature: 0.7,
        max_tokens: 4000
    });

    return {
        success: response.success,
        response: response.response,
        models_used: [{ provider: model.provider, model_name: model.model_name, task_type: model.task_type }],
        primary_provider: model.provider,
        primary_model: model.model_name,
        routing_reasoning: `Selected ${model.provider}/${model.model_name} based on performance rank ${model.performance_rank}`,
        cost_usd: estimateCost(model.model_name, response.usage),
        execution_time_ms: Date.now() - startTime,
        confidence: 0.85
    };
}

async function executeConsensus({ prompt, system_message, models, base44 }) {
    const response = await base44.functions.invoke('multiModelConsensus', {
        prompt,
        system_message,
        models_to_use: models.map(m => m.model_name),
        consensus_type: 'synthesized'
    });

    return {
        success: response.success,
        response: response.response,
        models_used: models,
        primary_provider: 'consensus',
        primary_model: 'multi-model',
        routing_reasoning: 'Critical task routed to multi-model consensus',
        cost_usd: models.reduce((sum, m) => sum + estimateCost(m.model_name), 0),
        confidence: response.confidence_score / 100
    };
}

async function trackPerformance({ models, task_type, execution_time, cost, success, base44 }) {
    for (const model of models) {
        const existing = await base44.asServiceRole.entities.LLMPerformance.filter({
            provider: model.provider,
            model: model.model_name,
            task_type: task_type
        });

        if (existing.length > 0) {
            const perf = existing[0];
            const newTotalRequests = perf.total_requests + 1;
            const newSuccessful = success ? perf.successful_requests + 1 : perf.successful_requests;
            const newFailed = success ? perf.failed_requests : perf.failed_requests + 1;
            const newAvgTime = (perf.avg_response_time_ms * perf.total_requests + execution_time) / newTotalRequests;
            const newSuccessRate = (newSuccessful / newTotalRequests) * 100;
            const newTotalCost = perf.total_cost_usd + cost;

            await base44.asServiceRole.entities.LLMPerformance.update(perf.id, {
                total_requests: newTotalRequests,
                successful_requests: newSuccessful,
                failed_requests: newFailed,
                avg_response_time_ms: newAvgTime,
                success_rate: newSuccessRate,
                total_cost_usd: newTotalCost,
                performance_rank: calculatePerformanceRank({
                    success_rate: newSuccessRate,
                    avg_quality_score: perf.avg_quality_score,
                    avg_response_time_ms: newAvgTime
                })
            });
        } else {
            await base44.asServiceRole.entities.LLMPerformance.create({
                provider: model.provider,
                model: model.model_name,
                task_type: task_type,
                total_requests: 1,
                successful_requests: success ? 1 : 0,
                failed_requests: success ? 0 : 1,
                avg_response_time_ms: execution_time,
                success_rate: success ? 100 : 0,
                total_cost_usd: cost,
                performance_rank: success ? 70 : 30
            });
        }
    }

    // Update daily cost tracker
    const today = new Date().toISOString().split('T')[0];
    for (const model of models) {
        const dailyCost = await base44.asServiceRole.entities.LLMCostTracker.filter({
            date: today,
            provider: model.provider,
            model: model.model_name
        });

        if (dailyCost.length > 0) {
            const tracker = dailyCost[0];
            await base44.asServiceRole.entities.LLMCostTracker.update(tracker.id, {
                total_requests: tracker.total_requests + 1,
                total_cost_usd: tracker.total_cost_usd + cost
            });
        } else {
            await base44.asServiceRole.entities.LLMCostTracker.create({
                date: today,
                provider: model.provider,
                model: model.model_name,
                total_requests: 1,
                total_cost_usd: cost
            });
        }
    }
}

function calculatePerformanceRank({ success_rate, avg_quality_score, avg_response_time_ms }) {
    const successWeight = 0.4;
    const qualityWeight = 0.4;
    const speedWeight = 0.2;

    const speedScore = Math.max(0, 100 - (avg_response_time_ms / 100));
    const qualityScore = (avg_quality_score / 10) * 100;

    return (
        success_rate * successWeight +
        qualityScore * qualityWeight +
        speedScore * speedWeight
    );
}

function estimateCost(model_name, usage) {
    const costPerToken = {
        'gpt-4-turbo': 0.00001,
        'gpt-4': 0.00003,
        'gpt-3.5-turbo': 0.000001,
        'claude-3-opus': 0.000015,
        'claude-3.5-sonnet': 0.000003,
        'claude-3-sonnet': 0.000003,
        'claude-3-haiku': 0.00000025,
        'gemini-ultra': 0.00001,
        'gemini-pro': 0.000001,
        'mixtral-8x7b-instruct': 0.0000007,
        'codestral-latest': 0.000001
    };

    const rate = costPerToken[model_name] || 0.000002;
    const tokens = usage?.total_tokens || 2000; // Estimate if not provided
    return tokens * rate;
}

async function weightedFusion(responses, models, base44) {
    const weights = models.map(m => m.performance_rank / 100);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    // Use the highest-ranked model's response as base
    const bestResponse = responses[0];
    
    // Calculate weighted confidence
    const weightedConfidence = responses.reduce((sum, r, i) => 
        sum + (r.confidence * weights[i] / totalWeight), 0
    );

    return {
        response: bestResponse.response,
        confidence: weightedConfidence,
        fusion_method: 'weighted_performance_rank'
    };
}

function generateCostOptimizations(summary) {
    const suggestions = [];
    
    for (const [provider, data] of Object.entries(summary.by_provider)) {
        const costPerRequest = data.cost / data.requests;
        
        if (costPerRequest > 0.02) {
            suggestions.push({
                provider,
                issue: 'High cost per request',
                suggestion: 'Consider routing simpler tasks to cheaper models like Claude Haiku or GPT-3.5',
                potential_savings_pct: 60
            });
        }
    }

    return suggestions;
}