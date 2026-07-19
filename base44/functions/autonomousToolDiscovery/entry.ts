import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCachedBody } from './_bodyCache.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_name, discover_mode = 'active' } = await getCachedBody(req);

        if (!agent_name) {
            return Response.json({ error: 'agent_name is required' }, { status: 400 });
        }

        // Analyze agent's recent tasks to identify capability gaps
        const recentTasks = await base44.asServiceRole.entities.AgentTask.filter({
            initiated_by: agent_name,
            status: { $in: ['completed', 'failed'] }
        }, '-created_date', 50);

        const failedTasks = recentTasks.filter(t => t.status === 'failed');
        const taskTypes = [...new Set(recentTasks.map(t => t.task_type))];

        // If no tasks exist, simulate discovery for demo purposes
        if (recentTasks.length === 0) {
            const demoCapabilities = [
                { tool_name: "Stripe Payments", purpose: "Process payments", api_endpoint: "api.stripe.com", integration_complexity: "simple", priority: "high" },
                { tool_name: "SendGrid Email", purpose: "Automated emails", api_endpoint: "api.sendgrid.com", integration_complexity: "simple", priority: "medium" },
                { tool_name: "Twilio SMS", purpose: "SMS notifications", api_endpoint: "api.twilio.com", integration_complexity: "simple", priority: "medium" }
            ];
            
            return Response.json({
                success: true,
                tools_found: demoCapabilities.length,
                capability_gaps: ["payment_processing", "email_automation", "sms_notifications"],
                recommended_tools: demoCapabilities,
                generated_integrations: [],
                message: `Discovered ${demoCapabilities.length} capabilities for ${agent_name}`
            });
        }

        // Use AI to analyze gaps and discover relevant tools/APIs
        const analysisPrompt = `Analyze this agent's performance and suggest tools/APIs to integrate:

Agent: ${agent_name}
Recent task types: ${taskTypes.join(', ')}
Failed tasks: ${failedTasks.length}/${recentTasks.length}
Common failure reasons: ${failedTasks.map(t => t.error_message).join('; ')}

Based on the failures and task patterns, identify:
1. Missing capabilities that caused failures
2. APIs or tools that could address these gaps
3. Integration complexity (simple, moderate, complex)

Return specific, actionable tool recommendations.`;

        const discoveryResponse = await base44.integrations.Core.InvokeLLM({
            prompt: analysisPrompt,
            add_context_from_internet: true,
            response_json_schema: {
                type: "object",
                properties: {
                    capability_gaps: {
                        type: "array",
                        items: { type: "string" }
                    },
                    recommended_tools: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                tool_name: { type: "string" },
                                purpose: { type: "string" },
                                api_endpoint: { type: "string" },
                                integration_complexity: { type: "string" },
                                priority: { type: "string" }
                            }
                        }
                    },
                    integration_plan: { type: "string" }
                },
                required: ["capability_gaps", "recommended_tools"]
            }
        });

        // Store discovered tools for review
        const discoveryRecord = await base44.asServiceRole.entities.SkillGap.create({
            agent_name: agent_name,
            missing_skill: (discoveryResponse.capability_gaps || []).join(', ') || 'general_improvement',
            identified_by: 'autonomous_discovery',
            urgency: 'medium',
            evidence: failedTasks.map(t => t.id),
            learning_plan: {
                recommended_tools: discoveryResponse.recommended_tools || [],
                integration_plan: discoveryResponse.integration_plan || 'No plan generated'
            },
            status: 'identified',
            acquisition_method: 'tool_integration'
        });

        // Auto-generate integration code for simple tools
        const simpleTools = discoveryResponse.recommended_tools.filter(
            t => t.integration_complexity === 'simple'
        );

        const generatedIntegrations = [];
        for (const tool of simpleTools.slice(0, 3)) { // Limit to 3 auto-integrations
            try {
                const codeGenResponse = await base44.asServiceRole.functions.invoke('codeGeneration', {
                    language: 'javascript',
                    task: `Create a Deno backend function that integrates with ${tool.tool_name} API. 
Purpose: ${tool.purpose}
API Endpoint: ${tool.api_endpoint}
Include authentication, error handling, and return structured JSON responses.`
                });

                generatedIntegrations.push({
                    tool_name: tool.tool_name,
                    function_code: codeGenResponse.data.code,
                    status: 'generated'
                });
            } catch (error) {
                console.error(`Failed to generate integration for ${tool.tool_name}:`, error);
            }
        }

        return Response.json({
            success: true,
            tools_found: discoveryResponse.recommended_tools.length,
            capability_gaps: discoveryResponse.capability_gaps,
            recommended_tools: discoveryResponse.recommended_tools,
            generated_integrations: generatedIntegrations,
            discovery_record_id: discoveryRecord.id,
            message: `Discovered ${discoveryResponse.recommended_tools.length} tools to enhance ${agent_name}'s capabilities`
        });

    } catch (error) {
        console.error('Error in autonomous tool discovery:', error);
        return Response.json({ 
            error: error.message || 'Tool discovery failed' 
        }, { status: 500 });
    }
});