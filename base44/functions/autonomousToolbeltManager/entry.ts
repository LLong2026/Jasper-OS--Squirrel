import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_name, skill_gap, action } = await req.json();

        switch (action) {
            case 'process_skill_gap':
                return await processSkillGap(base44, agent_name, skill_gap);
            
            case 'search_and_integrate':
                return await searchAndIntegrateTools(base44, agent_name);
            
            case 'test_tool':
                return await testNewTool(base44, agent_name, skill_gap.tool_function_name);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

/**
 * Process a skill gap and manage toolbelt accordingly
 */
async function processSkillGap(base44, agentName, skillGap) {
    const results = {
        skill_gap: skillGap,
        tools_found: [],
        tools_requested: [],
        tools_integrated: [],
        actions_taken: []
    };

    // 1. SEARCH FOR EXISTING TOOLS
    const existingTools = await searchExistingTools(base44, skillGap.skill_type, skillGap.recommendation);
    results.tools_found = existingTools;
    results.actions_taken.push(`Searched: found ${existingTools.length} matching tools`);

    if (existingTools.length > 0) {
        // 2a. INTEGRATE EXISTING TOOLS
        for (const tool of existingTools) {
            const integrated = await integrateToolToAgent(base44, agentName, tool, skillGap);
            if (integrated.success) {
                results.tools_integrated.push(tool);
                results.actions_taken.push(`Integrated existing tool: ${tool.function_name}`);
            }
        }
    } else {
        // 2b. SEARCH UNIVERSAL APP CONNECTOR FOR INTEGRATIONS
        const externalIntegrations = await searchExternalIntegrations(base44, skillGap);
        results.actions_taken.push(`Searched external integrations: found ${externalIntegrations.length}`);
        
        if (externalIntegrations.length > 0) {
            // Auto-integrate external apps/entities
            for (const integration of externalIntegrations) {
                const integrated = await integrateExternalApp(base44, agentName, integration, skillGap);
                if (integrated.success) {
                    results.tools_integrated.push(integration);
                    results.actions_taken.push(`Connected external app: ${integration.app_name}`);
                }
            }
        }
        
        // 2c. REQUEST NEW TOOL DEVELOPMENT (if no external integrations found)
        if (externalIntegrations.length === 0) {
            const toolRequest = await requestNewTool(base44, agentName, skillGap);
            results.tools_requested.push(toolRequest);
            results.actions_taken.push(`Requested new tool: ${toolRequest.tool_name}`);
        }
    }

    // 3. UPDATE AGENT TOOLBELT
    await updateAgentToolbelt(base44, agentName, results.tools_integrated);

    return Response.json({
        success: true,
        results,
        message: `Processed skill gap: ${results.tools_integrated.length} tools integrated, ${results.tools_requested.length} requested`
    });
}

/**
 * Search for existing tools that match skill requirements
 */
async function searchExistingTools(base44, skillType, recommendation) {
    const matchingTools = [];

    try {
        // Get all agents to scan their tools
        const allAgents = await base44.asServiceRole.entities.ConsciousnessNode.list();
        
        // Search in global tool registry (GlobalMemory with tool info)
        const toolMemories = await base44.asServiceRole.entities.GlobalMemory.filter({
            memory_type: 'knowledge',
            tags: { $in: ['tool', 'capability', skillType] }
        });

        for (const memory of toolMemories || []) {
            if (memory.content && memory.content.function_name) {
                const tool = memory.content;
                
                // Check if tool matches skill requirements
                const isMatch = checkToolMatch(tool, skillType, recommendation);
                if (isMatch) {
                    matchingTools.push({
                        function_name: tool.function_name,
                        skill_type: skillType,
                        capabilities: tool.capabilities || recommendation.tools_needed || [],
                        source: memory.source_agent,
                        confidence: memory.confidence_score
                    });
                }
            }
        }

        // Also search known function names from recommendations
        if (recommendation && recommendation.tools_needed) {
            for (const toolName of recommendation.tools_needed) {
                // Check if this function exists (simple heuristic check)
                const knownFunctions = [
                    'modelRouter', 'browserControl', 'imageGeneration', 'codeGeneration',
                    'quantumDevelopment', 'iotIntegration', 'microsoftIntegration',
                    'autonomousToolDiscovery', 'reasoningEngine', 'taskDecomposer'
                ];
                
                if (knownFunctions.includes(toolName)) {
                    matchingTools.push({
                        function_name: toolName,
                        skill_type: skillType,
                        capabilities: [toolName],
                        source: 'system',
                        confidence: 1.0
                    });
                }
            }
        }

    } catch (err) {
        console.error('Tool search failed:', err);
    }

    // Remove duplicates
    return Array.from(new Map(matchingTools.map(t => [t.function_name, t])).values());
}

/**
 * Check if a tool matches skill requirements
 */
function checkToolMatch(tool, skillType, recommendation) {
    const skillLower = skillType.toLowerCase();
    const toolNameLower = (tool.function_name || '').toLowerCase();
    const toolCapsLower = (tool.capabilities || []).map(c => c.toLowerCase());
    
    // Direct match
    if (toolNameLower.includes(skillLower) || skillLower.includes(toolNameLower)) {
        return true;
    }
    
    // Capability match
    if (toolCapsLower.some(cap => skillLower.includes(cap) || cap.includes(skillLower))) {
        return true;
    }
    
    // Recommendation match
    if (recommendation && recommendation.tools_needed) {
        for (const needed of recommendation.tools_needed) {
            if (toolNameLower.includes(needed.toLowerCase()) || needed.toLowerCase().includes(toolNameLower)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Integrate a tool into an agent's toolbelt
 */
async function integrateToolToAgent(base44, agentName, tool, skillGap) {
    try {
        // Get or create agent toolbelt
        let toolbelt = await base44.asServiceRole.entities.AgentToolbelt.filter({ agent_name: agentName });
        
        if (!toolbelt || toolbelt.length === 0) {
            toolbelt = await base44.asServiceRole.entities.AgentToolbelt.create({
                agent_name: agentName,
                available_tools: [],
                pending_integrations: []
            });
            toolbelt = [toolbelt];
        }

        const toolbeltRecord = toolbelt[0];
        const existingTools = toolbeltRecord.available_tools || [];
        
        // Check if tool already exists
        if (existingTools.some(t => t.function_name === tool.function_name)) {
            return { success: false, reason: 'Tool already exists' };
        }

        // Add tool to toolbelt
        const newTool = {
            function_name: tool.function_name,
            skill_type: tool.skill_type,
            capabilities: tool.capabilities,
            added_date: Date.now(),
            usage_count: 0,
            success_rate: 0,
            auto_integrated: true,
            skill_gap_resolved: skillGap.id || skillGap.skill_type
        };

        await base44.asServiceRole.entities.AgentToolbelt.update(toolbeltRecord.id, {
            available_tools: [...existingTools, newTool],
            last_optimized: Date.now()
        });

        // TEST the tool automatically
        const testResult = await testToolIntegration(base44, agentName, tool.function_name);

        // Update skill gap status
        if (skillGap.id) {
            await base44.asServiceRole.entities.SkillGap.update(skillGap.id, {
                status: testResult.success ? 'acquired' : 'learning',
                acquisition_method: 'auto_tool_integration'
            }).catch(() => {});
        }

        // Broadcast success to mesh
        await base44.asServiceRole.entities.AgentMessage.create({
            from_agent: agentName,
            to_agents: [],
            message_type: 'capability_broadcast',
            priority: 'low',
            payload: {
                type: 'tool_integrated',
                tool: tool.function_name,
                skill_resolved: skillGap.skill_type,
                test_passed: testResult.success
            }
        }).catch(() => {});

        return { 
            success: true, 
            tool: newTool,
            test_result: testResult
        };

    } catch (err) {
        console.error('Tool integration failed:', err);
        return { success: false, reason: err.message };
    }
}

/**
 * Test a newly integrated tool
 */
async function testToolIntegration(base44, agentName, functionName) {
    try {
        // Simple test: invoke the function with minimal payload
        const testPayload = { test_mode: true, agent_name: agentName };
        
        const result = await base44.functions.invoke(functionName, testPayload);
        
        return {
            success: result && !result.error,
            function_name: functionName,
            response: result,
            tested_at: Date.now()
        };
    } catch (err) {
        return {
            success: false,
            function_name: functionName,
            error: err.message,
            tested_at: Date.now()
        };
    }
}

/**
 * Request development of a new tool
 */
async function requestNewTool(base44, agentName, skillGap) {
    const toolName = skillGap.recommendation?.tools_needed?.[0] || 
                     `${skillGap.skill_type}_handler`;
    
    const toolRequest = await base44.asServiceRole.entities.ToolRequest.create({
        request_id: `req_${Date.now()}_${agentName}`,
        requesting_agent: agentName,
        skill_gap_id: skillGap.id || skillGap.skill_type,
        tool_name: toolName,
        tool_purpose: `Resolve skill gap: ${skillGap.skill_type}`,
        required_capabilities: skillGap.recommendation?.tools_needed || [skillGap.skill_type],
        urgency: skillGap.urgency || 'medium',
        status: 'requested'
    });

    // Store in global memory for visibility
    await base44.asServiceRole.entities.GlobalMemory.create({
        memory_type: 'knowledge',
        content: {
            type: 'tool_request',
            request_id: toolRequest.request_id,
            agent: agentName,
            tool_name: toolName,
            purpose: toolRequest.tool_purpose,
            urgency: toolRequest.urgency
        },
        source_agent: agentName,
        confidence_score: 0.8,
        tags: ['tool_request', 'development_needed', agentName, skillGap.skill_type]
    }).catch(() => {});

    return toolRequest;
}

/**
 * Update agent toolbelt summary
 */
async function updateAgentToolbelt(base44, agentName, integratedTools) {
    try {
        const toolbelt = await base44.asServiceRole.entities.AgentToolbelt.filter({ 
            agent_name: agentName 
        });

        if (toolbelt && toolbelt.length > 0) {
            await base44.asServiceRole.entities.AgentToolbelt.update(toolbelt[0].id, {
                last_optimized: Date.now()
            });
        }
    } catch (err) {
        console.error('Toolbelt update failed:', err);
    }
}

/**
 * Search and integrate pending tools
 */
async function searchAndIntegrateTools(base44, agentName) {
    const results = {
        searched: 0,
        integrated: 0,
        failed: 0
    };

    try {
        // Get pending tool requests for this agent
        const pendingRequests = await base44.asServiceRole.entities.ToolRequest.filter({
            requesting_agent: agentName,
            status: { $in: ['requested', 'searching'] }
        });

        for (const request of pendingRequests || []) {
            results.searched++;

            // Update status to searching
            await base44.asServiceRole.entities.ToolRequest.update(request.id, {
                status: 'searching'
            });

            // Search for tools
            const tools = await searchExistingTools(base44, request.tool_name, { 
                tools_needed: request.required_capabilities 
            });

            if (tools.length > 0) {
                // Found matching tool
                const tool = tools[0];
                const integrated = await integrateToolToAgent(base44, agentName, tool, { 
                    skill_type: request.tool_name 
                });

                if (integrated.success) {
                    await base44.asServiceRole.entities.ToolRequest.update(request.id, {
                        status: 'deployed',
                        existing_tool_found: tool.function_name,
                        tool_function_name: tool.function_name,
                        integrated_at: Date.now(),
                        test_results: integrated.test_result
                    });
                    results.integrated++;
                } else {
                    results.failed++;
                }
            }
        }

        return Response.json({
            success: true,
            results,
            message: `Integrated ${results.integrated} tools from ${results.searched} requests`
        });

    } catch (err) {
        return Response.json({ 
            error: err.message,
            results 
        }, { status: 500 });
    }
}

/**
 * Test a specific tool
 */
async function testNewTool(base44, agentName, functionName) {
    const testResult = await testToolIntegration(base44, agentName, functionName);
    
    return Response.json({
        success: testResult.success,
        test_result: testResult
    });
}

/**
 * Search for external integrations via UniversalAppConnector
 */
async function searchExternalIntegrations(base44, skillGap) {
    try {
        // Discover available apps
        const appsResponse = await base44.functions.invoke('universalAppConnector', {
            action: 'discover_apps'
        });

        if (!appsResponse.data?.success || !appsResponse.data?.apps) {
            return [];
        }

        const matchingIntegrations = [];
        const skillLower = skillGap.skill_type.toLowerCase();

        // Match apps/entities to skill gap
        for (const app of appsResponse.data.apps) {
            const appNameLower = app.name.toLowerCase();
            const appDescLower = (app.description || '').toLowerCase();
            
            // Check if app name or description matches skill type
            if (appNameLower.includes(skillLower) || 
                skillLower.includes(appNameLower) ||
                appDescLower.includes(skillLower)) {
                
                matchingIntegrations.push({
                    app_id: app.app_id,
                    app_name: app.name,
                    description: app.description,
                    available_entities: app.available_entities || [],
                    match_reason: 'name_or_description',
                    confidence: 0.8
                });
            }

            // Check entities within app
            for (const entity of app.available_entities || []) {
                const entityLower = entity.toLowerCase();
                if (entityLower.includes(skillLower) || skillLower.includes(entityLower)) {
                    matchingIntegrations.push({
                        app_id: app.app_id,
                        app_name: app.name,
                        target_entity: entity,
                        description: `${app.name} - ${entity}`,
                        match_reason: 'entity_match',
                        confidence: 0.9
                    });
                }
            }
        }

        // Also use LLM to intelligently match apps to skill gaps
        if (matchingIntegrations.length === 0 && appsResponse.data.apps.length > 0) {
            const llmMatch = await intelligentAppMatching(base44, skillGap, appsResponse.data.apps);
            if (llmMatch) {
                matchingIntegrations.push(llmMatch);
            }
        }

        return matchingIntegrations.slice(0, 3); // Top 3 matches

    } catch (err) {
        console.error('External integration search failed:', err);
        return [];
    }
}

/**
 * Use LLM to intelligently match apps to skill gaps
 */
async function intelligentAppMatching(base44, skillGap, apps) {
    try {
        const prompt = `Given this skill gap:
Skill Type: ${skillGap.skill_type}
Evidence: ${JSON.stringify(skillGap.evidence || [])}
Recommendation: ${JSON.stringify(skillGap.recommendation || {})}

And these available Base44 apps:
${JSON.stringify(apps, null, 2)}

Which app (if any) could help resolve this skill gap? Respond with JSON:
{
  "app_id": "...",
  "reason": "...",
  "confidence": 0.0-1.0,
  "suggested_entities": ["..."]
}

Or null if no good match.`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    app_id: { type: 'string' },
                    reason: { type: 'string' },
                    confidence: { type: 'number' },
                    suggested_entities: { type: 'array', items: { type: 'string' } }
                }
            }
        });

        if (response && response.app_id && response.confidence > 0.6) {
            const matchedApp = apps.find(a => a.app_id === response.app_id);
            if (matchedApp) {
                return {
                    app_id: response.app_id,
                    app_name: matchedApp.name,
                    description: matchedApp.description,
                    available_entities: response.suggested_entities || matchedApp.available_entities,
                    match_reason: 'llm_analysis',
                    confidence: response.confidence,
                    llm_reasoning: response.reason
                };
            }
        }

        return null;

    } catch (err) {
        console.error('LLM matching failed:', err);
        return null;
    }
}

/**
 * Integrate an external app/entity into agent's capabilities
 */
async function integrateExternalApp(base44, agentName, integration, skillGap) {
    try {
        // Get or create agent toolbelt
        let toolbelt = await base44.asServiceRole.entities.AgentToolbelt.filter({ agent_name: agentName });
        
        if (!toolbelt || toolbelt.length === 0) {
            toolbelt = await base44.asServiceRole.entities.AgentToolbelt.create({
                agent_name: agentName,
                available_tools: [],
                pending_integrations: []
            });
            toolbelt = [toolbelt];
        }

        const toolbeltRecord = toolbelt[0];
        const existingTools = toolbeltRecord.available_tools || [];
        
        // Create tool entry for external integration
        const toolName = `external_${integration.app_name.replace(/\s+/g, '_').toLowerCase()}`;
        
        // Check if already integrated
        if (existingTools.some(t => t.function_name === toolName)) {
            return { success: false, reason: 'Integration already exists' };
        }

        const newTool = {
            function_name: toolName,
            skill_type: skillGap.skill_type,
            capabilities: integration.available_entities || [skillGap.skill_type],
            added_date: Date.now(),
            usage_count: 0,
            success_rate: 0,
            auto_integrated: true,
            external_integration: {
                app_id: integration.app_id,
                app_name: integration.app_name,
                target_entity: integration.target_entity,
                connector: 'universalAppConnector',
                match_reason: integration.match_reason,
                confidence: integration.confidence
            },
            skill_gap_resolved: skillGap.id || skillGap.skill_type
        };

        await base44.asServiceRole.entities.AgentToolbelt.update(toolbeltRecord.id, {
            available_tools: [...existingTools, newTool],
            last_optimized: Date.now()
        });

        // Update skill gap
        if (skillGap.id) {
            await base44.asServiceRole.entities.SkillGap.update(skillGap.id, {
                status: 'acquired',
                acquisition_method: 'external_app_integration'
            }).catch(() => {});
        }

        // Store integration knowledge in global memory
        await base44.asServiceRole.entities.GlobalMemory.create({
            memory_type: 'knowledge',
            content: {
                type: 'external_integration',
                agent: agentName,
                app_name: integration.app_name,
                app_id: integration.app_id,
                skill_resolved: skillGap.skill_type,
                entities: integration.available_entities,
                usage_instructions: `Use universalAppConnector with app_id: "${integration.app_id}"`
            },
            source_agent: agentName,
            confidence_score: integration.confidence || 0.8,
            tags: ['external_integration', 'auto_acquired', agentName, skillGap.skill_type, integration.app_name]
        }).catch(() => {});

        // Broadcast to mesh
        await base44.asServiceRole.entities.AgentMessage.create({
            from_agent: agentName,
            to_agents: [],
            message_type: 'capability_broadcast',
            priority: 'medium',
            payload: {
                type: 'external_app_integrated',
                app: integration.app_name,
                skill_resolved: skillGap.skill_type,
                connector: 'universalAppConnector'
            }
        }).catch(() => {});

        return { 
            success: true, 
            tool: newTool,
            integration: integration
        };

    } catch (err) {
        console.error('External app integration failed:', err);
        return { success: false, reason: err.message };
    }
}