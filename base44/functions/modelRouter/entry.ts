import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCachedBody } from './_bodyCache.js';
import { getAllModels, callLLM } from './llmProviderRegistry.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await getCachedBody(req);
        const {
            prompt = 'Summarize quantum computing in 10 words',
            system_message,
            task_type = 'summarize',
            priority = 'normal',
            cost_constraint = 'balanced',
            speed_requirement = 'normal',
            quality_requirement = 'high',
            domain_expertise = 'general',
            requires_privacy = false // New flag for Chimera routing
        } = payload;

        const startTime = Date.now();

        // --- CHIMERA ROUTING LOGIC ---
        // Determine if the task is simple enough for a smaller, faster local model
        const isSimpleTask = prompt.length < 200 && (task_type === 'summarize' || task_type === 'simple_qa');
        // Determine if fast response is prioritized
        const wantsFast = speed_requirement === 'urgent';

        // If privacy is required, or the task is simple, or speed is urgent, route to local inference
        if (requires_privacy || isSimpleTask || wantsFast) {
            const localModel = isSimpleTask ? 'phi3' : 'llama3'; // Phi3 for simple tasks, Llama3 for others if local
            const localResponse = await base44.functions.invoke('localInference', {
                model: localModel,
                prompt,
                system_message,
            });
            // Return the response from local inference directly, assuming it's already in the desired final format
            return Response.json(localResponse);
        }
        // --- END CHIMERA ROUTING ---

        // Analyze the request to determine optimal CLOUD model
        const selectedModel = selectOptimalModel({
            prompt,
            task_type,
            priority,
            cost_constraint,
            speed_requirement,
            quality_requirement,
            domain_expertise
        });

        // Route using unified interface
        let integrationResponse;

        if (selectedModel.provider === 'consensus') {
            integrationResponse = await base44.functions.invoke('multiModelConsensus', {
                prompt,
                system_message,
                consensus_type: selectedModel.consensus_type,
                models_to_use: selectedModel.models
            });
        } else {
            // Use unified LLM caller
            integrationResponse = await callLLM(
                selectedModel.provider,
                selectedModel.model,
                prompt,
                system_message,
                {
                    temperature: selectedModel.temperature,
                    max_tokens: selectedModel.max_tokens
                }
            );
        }

        const routingTimeMs = Date.now() - startTime;

        // Construct the base response object that includes original router metadata
        const responsePayload = {
            success: integrationResponse.success,
            response: integrationResponse.response,
            routing_decision: {
                selected_provider: selectedModel.provider,
                selected_model: selectedModel.model,
                reasoning: selectedModel.reasoning,
                cost_estimate: selectedModel.cost_estimate,
                speed_estimate: selectedModel.speed_estimate,
                quality_estimate: selectedModel.quality_estimate
            },
            original_response: integrationResponse, // The raw response from the underlying integration
            routing_time_ms: routingTimeMs
        };

        // Track performance
        await base44.asServiceRole.entities.LLMPerformance.create({
            provider: selectedModel.provider,
            model: selectedModel.model,
            task_type: task_type || 'general',
            total_requests: 1,
            successful_requests: integrationResponse.success ? 1 : 0,
            failed_requests: integrationResponse.success ? 0 : 1,
            avg_response_time_ms: routingTimeMs
        }).catch(() => {}); // Silent fail

        // IMPORTANT: Add the proof object to the final response
        const finalResponse = {
            ...responsePayload,
            proof: {
                source: selectedModel.provider,
                model: selectedModel.model,
                reasoning: selectedModel.reasoning,
                router: 'modelRouter'
            }
        };

        return Response.json(finalResponse);

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'model-router'
        }, { status: 500 });
    }
});

function selectOptimalModel(params) {
    const {
        prompt,
        task_type,
        priority,
        cost_constraint,
        speed_requirement,
        quality_requirement,
        domain_expertise
    } = params;

    // Analyze prompt characteristics
    const promptLength = prompt.length;
    const isComplex = promptLength > 1000 || prompt.includes('analyze') || prompt.includes('complex');
    const needsRealTime = prompt.toLowerCase().includes('current') || prompt.toLowerCase().includes('latest') || prompt.toLowerCase().includes('real-time');
    const needsCode = prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('program');
    const needsMath = prompt.toLowerCase().includes('calculate') || prompt.toLowerCase().includes('equation');

    // Get all available models from registry (vendor-independent)
    const allAvailableModels = getAllModels();
    const models = {};
    
    // Convert to lookup format with dynamic specialties
    for (const modelInfo of allAvailableModels) {
        const key = modelInfo.model;
        models[key] = {
            provider: modelInfo.provider,
            model: modelInfo.model,
            cost: modelInfo.cost,
            speed: modelInfo.speed,
            quality: modelInfo.quality,
            specialties: modelInfo.specialties,
            temperature: modelInfo.model.includes('code') ? 0.2 : 0.7,
            max_tokens: 4000
        };
    }

    // Legacy hardcoded models for backwards compatibility (will be overridden by registry)
    const legacyModels = {
        'gpt-4-turbo': {
            provider: 'openai',
            model: 'gpt-4-turbo',
            cost: 9,
            speed: 6,
            quality: 10,
            specialties: ['reasoning', 'code', 'general', 'complex'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'claude-3-opus': {
            provider: 'anthropic',
            model: 'claude-3-opus',
            cost: 9,
            speed: 5,
            quality: 10,
            specialties: ['reasoning', 'writing', 'analysis', 'philosophy'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'gemini-ultra': {
            provider: 'google',
            model: 'gemini-ultra',
            cost: 8,
            speed: 6,
            quality: 10,
            specialties: ['multimodal', 'reasoning', 'general'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'gpt-4': {
            provider: 'openai',
            model: 'gpt-4',
            cost: 8,
            speed: 5,
            quality: 9,
            specialties: ['reasoning', 'code', 'general'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'claude-3.5-sonnet': {
            provider: 'anthropic',
            model: 'claude-3.5-sonnet',
            cost: 7,
            speed: 8, // Faster than Opus
            quality: 10, // Top-tier quality
            specialties: ['balanced', 'reasoning', 'speed', 'code', 'writing'],
            temperature: 0.7,
            max_tokens: 4000
        },

        // Tier 2: Production Workhorses
        'claude-3-sonnet': {
            provider: 'anthropic',
            model: 'claude-3-sonnet',
            cost: 6,
            speed: 7,
            quality: 9,
            specialties: ['general', 'reasoning', 'balanced'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'gemini-pro': {
            provider: 'google',
            model: 'gemini-pro',
            cost: 4,
            speed: 8,
            quality: 8,
            specialties: ['general', 'multimodal', 'balanced'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'gpt-3.5-turbo': {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            cost: 2,
            speed: 9,
            quality: 7,
            specialties: ['speed', 'general', 'cost-effective'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'mixtral-8x7b': {
            provider: 'mistral',
            model: 'mixtral-8x7b-instruct',
            cost: 4,
            speed: 7,
            quality: 8,
            specialties: ['cost-effective', 'reasoning', 'open-source'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'command-r-plus': {
            provider: 'cohere',
            model: 'command-r-plus',
            cost: 6,
            speed: 7,
            quality: 8,
            specialties: ['enterprise', 'rag', 'business'],
            temperature: 0.7,
            max_tokens: 4000,
            task_type: 'chat'
        },

        // Tier 3: Specialized Excellence
        'sonar-large-online': {
            provider: 'perplexity',
            model: 'llama-3.1-sonar-large-128k-online', // Updated model name
            cost: 7,
            speed: 7,
            quality: 9,
            specialties: ['research', 'real-time', 'citations', 'web-search'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'claude-3-haiku': {
            provider: 'anthropic',
            model: 'claude-3-haiku',
            cost: 3,
            speed: 10,
            quality: 7,
            specialties: ['speed', 'simple', 'fast'],
            temperature: 0.7,
            max_tokens: 2000
        },
        'llama-2-70b': {
            provider: 'meta',
            model: 'llama-2-70b-chat',
            cost: 3,
            speed: 6,
            quality: 7,
            specialties: ['open-source', 'general', 'cost-effective'],
            temperature: 0.7,
            max_tokens: 4000
        },
        'codestral': {
            provider: 'mistral',
            model: 'codestral-latest',
            cost: 5,
            speed: 8,
            quality: 9,
            specialties: ['code', 'programming', 'development'],
            temperature: 0.2, // Lower temp for code
            max_tokens: 4000
        },
        'command-r': {
            provider: 'cohere',
            model: 'command-r',
            cost: 4,
            speed: 8,
            quality: 7,
            specialties: ['rag', 'business', 'enterprise'],
            temperature: 0.7,
            max_tokens: 4000,
            task_type: 'chat'
        }
    };

    // Merge legacy with registry (registry takes precedence)
    Object.assign(legacyModels, models);

    // Scoring function
    function scoreModel(model) {
        let score = 0;

        // Cost constraint scoring
        const costMultiplier = {
            'low': model.cost <= 3 ? 3 : model.cost <= 5 ? 1 : -2,
            'balanced': model.cost >= 4 && model.cost <= 7 ? 2 : 0,
            'premium': model.cost >= 7 ? 2 : -1
        };
        score += (costMultiplier[cost_constraint] || 0);

        // Speed requirement scoring
        const speedMultiplier = {
            'urgent': model.speed >= 8 ? 3 : -2,
            'normal': model.speed >= 6 ? 1 : 0,
            'thorough': model.quality >= 8 ? 2 : -1
        };
        score += (speedMultiplier[speed_requirement] || 0);

        // Quality requirement scoring
        const qualityMultiplier = {
            'basic': model.quality >= 6 ? 1 : -1,
            'high': model.quality >= 8 ? 2 : -1,
            'premium': model.quality >= 9 ? 3 : -2
        };
        score += (qualityMultiplier[quality_requirement] || 0);

        // Domain expertise scoring
        const domainBonus = {
            'research': model.specialties.includes('research') || model.specialties.includes('real-time') ? 5 : 0,
            'code': model.specialties.includes('code') || model.specialties.includes('programming') ? 5 : 0,
            'writing': model.specialties.includes('writing') ? 3 : 0,
            'math': model.specialties.includes('reasoning') ? 2 : 0,
            'general': model.specialties.includes('general') ? 1 : 0,
            'business': model.specialties.includes('enterprise') || model.specialties.includes('business') ? 3 : 0,
            'philosophy': model.specialties.includes('philosophy') || model.specialties.includes('reasoning') ? 3 : 0
        };
        score += (domainBonus[domain_expertise] || 0);

        // Task-specific bonuses
        if (needsRealTime && (model.specialties.includes('real-time') || model.specialties.includes('web-search'))) score += 8;
        if (needsCode && (model.specialties.includes('code') || model.specialties.includes('programming'))) score += 5;
        if (needsMath && model.specialties.includes('reasoning')) score += 3;
        if (isComplex && model.quality >= 9) score += 3;
        if (priority === 'critical' && model.quality >= 9) score += 4;

        return score;
    }

    // Score all models and select the best
    let bestModel = null;
    let bestScore = -Infinity;

    for (const [name, model] of Object.entries(legacyModels)) {
        const score = scoreModel(model);
        if (score > bestScore) {
            bestScore = score;
            bestModel = { ...model, name, score };
        }
    }

    // Special case: use consensus for critical decisions
    if (priority === 'critical' && quality_requirement === 'premium') {
        return {
            provider: 'consensus',
            model: 'multi-model-consensus',
            consensus_type: 'critical_decision',
            models: ['gpt-4-turbo', 'claude-3-opus', 'gemini-ultra'],
            reasoning: 'Critical decision requires multi-model consensus',
            cost_estimate: 'high',
            speed_estimate: 'slow',
            quality_estimate: 'premium'
        };
    }

    return {
        ...bestModel,
        reasoning: `Selected based on: ${needsRealTime ? 'real-time needs, ' : ''}${isComplex ? 'complex reasoning, ' : ''}${needsCode ? 'code generation, ' : ''}cost constraint: ${cost_constraint}, speed: ${speed_requirement}, quality: ${quality_requirement}`,
        cost_estimate: bestModel.cost <= 3 ? 'low' : bestModel.cost <= 6 ? 'medium' : 'high',
        speed_estimate: bestModel.speed >= 8 ? 'fast' : bestModel.speed >= 6 ? 'medium' : 'slow',
        quality_estimate: bestModel.quality >= 9 ? 'premium' : bestModel.quality >= 7 ? 'high' : 'basic'
    };
}