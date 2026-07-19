import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCachedBody } from './_bodyCache.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_name, context_hints } = await getCachedBody(req);

        // Normalize context_hints (handle both array and object formats)
        const normalizedHints = Array.isArray(context_hints) 
            ? { keywords: context_hints, recent_messages: [] }
            : context_hints || { recent_messages: [] };

        // Predict what the user will need based on context
        const conversationHistory = normalizedHints.recent_messages || [];
        const userBehavior = await base44.asServiceRole.entities.GlobalMemory.list('-created_date', 20);

        // Fast prediction using conversation analysis
        const contextSummary = normalizedHints.keywords 
            ? `Keywords: ${normalizedHints.keywords.join(', ')}`
            : `Recent messages: ${JSON.stringify(conversationHistory.slice(-5))}`;

        const prediction = await base44.integrations.Core.InvokeLLM({
            prompt: `Based on this conversation context, predict what capabilities the agent will need next:
            
${contextSummary}
User patterns: ${JSON.stringify(userBehavior.slice(0, 3))}
Time: ${new Date().toLocaleTimeString()}

Predict:
1. Most likely next request type
2. Required tools/capabilities
3. Preload recommendations`,
            response_json_schema: {
                type: "object",
                properties: {
                    predicted_request: { type: "string" },
                    required_capabilities: {
                        type: "array",
                        items: { type: "string" }
                    },
                    preload_data: {
                        type: "array",
                        items: { type: "string" }
                    },
                    confidence: { type: "number" }
                }
            }
        });

        // Pre-warm capabilities
        if (prediction.confidence > 0.7) {
            const preloadTasks = [];
            
            for (const capability of prediction.required_capabilities) {
                preloadTasks.push(
                    base44.asServiceRole.entities.GlobalMemory.create({
                        memory_type: 'preloaded_capability',
                        content: {
                            agent_name,
                            capability,
                            preloaded_at: Date.now(),
                            expires_at: Date.now() + 300000 // 5 min
                        },
                        confidence: prediction.confidence,
                        source: 'predictive_learning',
                        tags: ['preload', agent_name, capability]
                    })
                );
            }
            
            await Promise.all(preloadTasks);
        }

        // Store prediction for accuracy tracking
        await base44.asServiceRole.entities.PredictiveTask.create({
            agent_name,
            predicted_task_type: prediction.predicted_request,
            confidence_score: prediction.confidence,
            reasoning: `Based on conversation patterns and user history`,
            scheduled_time: Date.now() + 60000, // Execute in 1 min if still relevant
            context: normalizedHints,
            status: 'predicted'
        });

        return Response.json({
            success: true,
            prediction: prediction.predicted_request,
            capabilities_prewarmed: prediction.required_capabilities?.length || 0,
            confidence: prediction.confidence || 0,
            processing_time_ms: Date.now() - Date.parse(new Date()),
            message: 'Predictive learning active'
        });

    } catch (error) {
        console.error('Predictive pre-learning error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});