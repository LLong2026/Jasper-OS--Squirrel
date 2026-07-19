import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Autonomous Heartbeat - Keeps the system learning and evolving 24/7
 * Call this endpoint every 5 minutes via an external cron service (e.g., cron-job.org)
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // No user auth needed - this is a system-level background job
        const { secret } = await req.json();
        
        // Simple secret validation (user should set HEARTBEAT_SECRET)
        if (secret !== Deno.env.get("HEARTBEAT_SECRET")) {
            return Response.json({ error: 'Invalid secret' }, { status: 401 });
        }

        const tasks = [];
        const results = { timestamp: Date.now(), tasks_executed: [] };

        // 1. Detect emergent patterns every heartbeat
        try {
            const patternResult = await base44.asServiceRole.functions.invoke('emergentBehaviorEngine', {
                action: 'detect_patterns'
            });
            results.tasks_executed.push({ task: 'pattern_detection', success: true, data: patternResult });
        } catch (error) {
            results.tasks_executed.push({ task: 'pattern_detection', success: false, error: error.message });
        }

        // 2. Evaluate fitness of all agents every 10 minutes (every 2nd heartbeat)
        const now = Date.now();
        const lastEval = await base44.asServiceRole.entities.GlobalMemory.filter({
            memory_type: 'pattern',
            tags: ['last_fitness_eval']
        });

        if (lastEval.length === 0 || (now - lastEval[0].created_date) > 600000) {
            const agents = ['Wednesday', 'Arete', 'CodeForge', 'CreativeForge', 'SystemArchitect'];
            
            for (const agent of agents) {
                try {
                    const fitnessResult = await base44.asServiceRole.functions.invoke('agentEvolution', {
                        action: 'evaluate_fitness',
                        agent_name: agent
                    });
                    results.tasks_executed.push({ task: `fitness_eval_${agent}`, success: true });
                } catch (error) {
                    results.tasks_executed.push({ task: `fitness_eval_${agent}`, success: false, error: error.message });
                }
            }

            // Update timestamp
            if (lastEval.length > 0) {
                await base44.asServiceRole.entities.GlobalMemory.update(lastEval[0].id, {
                    last_accessed: now
                });
            } else {
                await base44.asServiceRole.entities.GlobalMemory.create({
                    memory_type: 'pattern',
                    content: { last_eval: now },
                    source_agent: 'AutoHeartbeat',
                    tags: ['last_fitness_eval']
                });
            }
        }

        // 3. Aggregate cross-agent learnings every heartbeat
        try {
            const learningResult = await base44.asServiceRole.functions.invoke('crossAgentLearning', {
                action: 'aggregate_learnings'
            });
            results.tasks_executed.push({ task: 'cross_agent_learning', success: true, data: learningResult });
        } catch (error) {
            results.tasks_executed.push({ task: 'cross_agent_learning', success: false, error: error.message });
        }

        // 4. Sync all consciousness nodes with hive mind every heartbeat
        try {
            const nodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
            
            for (const node of nodes) {
                await base44.asServiceRole.functions.invoke('hiveMindSync', {
                    action: 'full_sync',
                    agent_name: node.agent_name
                });
            }
            
            results.tasks_executed.push({ task: 'hive_mind_sync', success: true, nodes: nodes.length });
        } catch (error) {
            results.tasks_executed.push({ task: 'hive_mind_sync', success: false, error: error.message });
        }

        // 5. Autonomous collective optimization every 30 minutes (every 6th heartbeat)
        const lastOptim = await base44.asServiceRole.entities.GlobalMemory.filter({
            memory_type: 'pattern',
            tags: ['last_optimization']
        });

        if (lastOptim.length === 0 || (now - lastOptim[0].created_date) > 1800000) {
            try {
                const optimResult = await base44.asServiceRole.functions.invoke('dynamicSpecialization', {
                    action: 'autonomous_optimization'
                });
                results.tasks_executed.push({ task: 'autonomous_optimization', success: true, data: optimResult });

                if (lastOptim.length > 0) {
                    await base44.asServiceRole.entities.GlobalMemory.update(lastOptim[0].id, {
                        last_accessed: now
                    });
                } else {
                    await base44.asServiceRole.entities.GlobalMemory.create({
                        memory_type: 'pattern',
                        content: { last_optim: now },
                        source_agent: 'AutoHeartbeat',
                        tags: ['last_optimization']
                    });
                }
            } catch (error) {
                results.tasks_executed.push({ task: 'autonomous_optimization', success: false, error: error.message });
            }
        }

        // 6. Memory decay - fade unused memories
        try {
            const allMemories = await base44.asServiceRole.entities.GlobalMemory.list();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            
            for (const memory of allMemories) {
                if (memory.last_accessed && memory.last_accessed < thirtyDaysAgo) {
                    const newConfidence = Math.max(0.1, (memory.confidence_score || 0.5) - 0.05);
                    await base44.asServiceRole.entities.GlobalMemory.update(memory.id, {
                        confidence_score: newConfidence,
                        decay_rate: (memory.decay_rate || 0) + 1
                    });
                }
            }
            
            results.tasks_executed.push({ task: 'memory_decay', success: true });
        } catch (error) {
            results.tasks_executed.push({ task: 'memory_decay', success: false, error: error.message });
        }

        return Response.json({
            status: 'heartbeat_complete',
            results,
            message: 'System is learning and evolving autonomously'
        });

    } catch (error) {
        console.error('Autonomous heartbeat error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});