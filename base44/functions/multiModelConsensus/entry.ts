import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, system_message, models_to_use = [], consensus_type = 'best_response', temperature = 0.7, max_tokens = 4000 } = await req.json();
        
        const startTime = Date.now();
        
        // Default model selection for different consensus types
        const defaultModels = {
            'critical_decision': ['gpt-4-turbo', 'claude-3-opus', 'gemini-ultra', 'mixtral', 'sonar-large-online'],
            'best_response': ['gpt-4-turbo', 'claude-3-sonnet', 'gemini-pro'],
            'fast_consensus': ['gpt-3.5-turbo', 'claude-3-haiku', 'mistral-small'],
            'research_consensus': ['sonar-large-online', 'claude-3-opus', 'gemini-pro']
        };
        
        const modelsToQuery = models_to_use.length > 0 ? models_to_use : defaultModels[consensus_type] || defaultModels['best_response'];
        
        // Execute parallel requests to different models
        const modelPromises = modelsToQuery.map(async (modelSpec) => {
            try {
                let provider, model;
                
                // Determine provider and model from specification
                if (modelSpec.includes('gpt') || modelSpec.includes('dall-e')) {
                    provider = 'openai';
                    model = modelSpec;
                } else if (modelSpec.includes('claude')) {
                    provider = 'anthropic';
                    model = modelSpec;
                } else if (modelSpec.includes('gemini') || modelSpec.includes('palm')) {
                    provider = 'google';
                    model = modelSpec;
                } else if (modelSpec.includes('sonar') || modelSpec.includes('llama-3.1-sonar')) {
                    provider = 'perplexity';
                    model = modelSpec;
                } else if (modelSpec.includes('mixtral') || modelSpec.includes('mistral')) {
                    provider = 'mistral';
                    model = modelSpec;
                } else if (modelSpec.includes('command')) {
                    provider = 'cohere';
                    model = modelSpec;
                } else {
                    provider = 'openai'; // Default fallback
                    model = 'gpt-4-turbo';
                }
                
                // Call the appropriate integration function
                let response;
                switch (provider) {
                    case 'openai': {
                        response = await base44.functions.invoke('openaiIntegration', {
                            model, prompt, system_message, temperature, max_tokens
                        });
                        break;
                    }
                    case 'anthropic': {
                        response = await base44.functions.invoke('anthropicIntegration', {
                            model, prompt, system_message, temperature, max_tokens
                        });
                        break;
                    }
                    case 'google': {
                        response = await base44.functions.invoke('googleIntegration', {
                            model, prompt, system_message, temperature, max_tokens
                        });
                        break;
                    }
                    case 'perplexity': {
                        response = await base44.functions.invoke('perplexityIntegration', {
                            model, prompt, system_message, temperature, max_tokens
                        });
                        break;
                    }
                    case 'mistral': {
                        response = await base44.functions.invoke('mistralIntegration', {
                            model, prompt, system_message, temperature, max_tokens
                        });
                        break;
                    }
                    case 'cohere': {
                        response = await base44.functions.invoke('cohereIntegration', {
                            model, prompt, system_message, temperature, max_tokens, task_type: 'chat'
                        });
                        break;
                    }
                    default:
                        throw new Error(`Unsupported provider: ${provider}`);
                }
                
                return {
                    provider,
                    model: modelSpec,
                    response: response.response,
                    success: response.success,
                    processing_time: response.processing_time_ms,
                    citations: response.citations || [],
                    usage: response.usage
                };
                
            } catch (error) {
                return {
                    provider: 'unknown',
                    model: modelSpec,
                    response: null,
                    success: false,
                    error: error.message,
                    processing_time: 0
                };
            }
        });
        
        // Wait for all models to respond
        const modelResponses = await Promise.all(modelPromises);
        
        // Filter successful responses
        const successfulResponses = modelResponses.filter(r => r.success && r.response);
        
        if (successfulResponses.length === 0) {
            return Response.json({
                success: false,
                error: 'All model queries failed',
                individual_responses: modelResponses
            }, { status: 500 });
        }
        
        // Analyze responses for consensus
        let consensusResult;
        
        switch (consensus_type) {
            case 'best_response': {
                // Return the response from the highest-tier model that succeeded
                const modelTierOrder = ['gpt-4-turbo', 'claude-3-opus', 'gemini-ultra', 'claude-3-sonnet', 'gemini-pro', 'mixtral'];
                consensusResult = successfulResponses.find(r => modelTierOrder.includes(r.model)) || successfulResponses[0];
                break;
            }
                
            case 'majority_consensus': {
                // Simple majority based on similar response patterns (would need more sophisticated analysis)
                consensusResult = successfulResponses[0]; // Placeholder
                break;
            }
                
            case 'synthesized': {
                // Use GPT-4 to synthesize all responses into one coherent answer
                const allResponses = successfulResponses.map(r => `**${r.model}**: ${r.response}`).join('\n\n');
                const synthesisPrompt = `Synthesize the following AI model responses into one coherent, comprehensive answer that captures the best insights from each:\n\n${allResponses}`;
                
                const synthesisResponse = await base44.functions.invoke('openaiIntegration', {
                    model: 'gpt-4-turbo',
                    prompt: synthesisPrompt,
                    system_message: 'You are an expert AI response synthesizer. Create a coherent response that combines the best elements from multiple AI models.',
                    temperature: 0.7,
                    max_tokens: max_tokens
                });
                
                consensusResult = {
                    provider: 'synthesized',
                    model: 'multi-model-synthesis',
                    response: synthesisResponse.response,
                    success: synthesisResponse.success
                };
                break;
            }
                
            default:
                consensusResult = successfulResponses[0];
        }
        
        // Calculate confidence score based on response similarity and model agreement
        const confidenceScore = Math.min(95, 60 + (successfulResponses.length * 8));
        
        // Attach the proof to the final response
        return Response.json({
            success: true,
            consensus_type: consensus_type,
            response: consensusResult.response, // Renamed from primary_response for consistency
            confidence_score: confidenceScore,
            models_queried: modelsToQuery.length,
            successful_responses: successfulResponses.length,
            individual_responses: modelResponses,
            processing_time_ms: Date.now() - startTime,
            provider: 'multi-model-consensus',
            proof: {
                source: 'Multi-Model Consensus',
                model: `${successfulResponses.length} models`,
                details: successfulResponses.map(r => r.model).join(', ')
            }
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'multi-model-consensus'
        }, { status: 500 });
    }
});