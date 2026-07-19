import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ARETE - Recursive Self-Learning Orchestrator
// Master AI that coordinates all specialized agents and learns from every interaction

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { task, context, priority = 'normal', domain = 'general' } = await req.json();
        const startTime = Date.now();

        // 1. INGEST - Publish to Event Mesh
        const eventId = await base44.functions.invoke('eventMesh', {
            event_type: 'task_received',
            payload: { task, context, domain, priority },
            timestamp: startTime
        });

        // 2. FEATURE EXTRACTION - Real-time feature store
        const features = await base44.functions.invoke('featureStore', {
            action: 'extract',
            task,
            context,
            domain
        });

        // 3. AGENT SELECTION - Query Agent Mesh for best agent(s)
        const selectedAgents = await base44.functions.invoke('agentMesh', {
            action: 'select_agents',
            features: features.features,
            domain,
            task_complexity: features.complexity_score
        });

        // 4. SAFETY CHECK - Pre-execution validation
        const safetyCheck = await base44.functions.invoke('safetyGuardian', {
            agents: selectedAgents.agents,
            task,
            context
        });

        if (!safetyCheck.approved) {
            return Response.json({
                success: false,
                error: 'Safety check failed',
                reason: safetyCheck.reason
            }, { status: 403 });
        }

        // 5. EXECUTE - Parallel agent execution
        const executionPromises = selectedAgents.agents.map(async (agent) => {
            return await base44.functions.invoke(agent.function_name, {
                task,
                context,
                parameters: agent.parameters
            });
        });

        const results = await Promise.all(executionPromises);

        // 6. SYNTHESIS - Combine results
        const synthesis = await base44.functions.invoke('modelRouter', {
            prompt: `Synthesize these agent results into a coherent response:
            
Task: ${task}
Agent Results: ${JSON.stringify(results, null, 2)}

Provide a unified, actionable response.`,
            task_type: 'synthesize',
            quality_requirement: 'premium'
        });

        // 7. AUDIT - Write decision snapshot
        await base44.functions.invoke('auditService', {
            action: 'log_decision',
            event_id: eventId.event_id,
            agents_used: selectedAgents.agents,
            results,
            synthesis: synthesis.response,
            execution_time_ms: Date.now() - startTime
        });

        // 8. LEARN - Feed execution data to learner
        const executionTime = Date.now() - startTime;
        base44.functions.invoke('recursiveLearner', {
            event_id: eventId.event_id,
            features: features.features,
            agents_used: selectedAgents.agents,
            outcome: synthesis.response,
            success: true,
            execution_time_ms: executionTime
        }).catch(err => console.error('Learning error:', err));

        // 9. SELF-CORRECTION - Evaluate and improve
        const feedbackScore = Math.min(synthesis.response.length / 100, 10);
        if (feedbackScore < 7) {
            base44.functions.invoke('selfCorrectionEngine', {
                task_id: eventId.event_id,
                agent_name: selectedAgents.agents[0].name,
                outcome: synthesis.response,
                feedback_score: feedbackScore,
                error_details: 'Low quality output detected'
            }).catch(err => console.error('Correction error:', err));
        }

        return Response.json({
            success: true,
            response: synthesis.response,
            agents_used: selectedAgents.agents.map(a => a.name),
            execution_time_ms: executionTime,
            feedback_score: feedbackScore,
            event_id: eventId.event_id,
            proof: {
                source: 'Arete Orchestrator',
                model: 'Recursive Self-Learning',
                details: `Coordinated ${selectedAgents.agents.length} agents`
            }
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});