import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Performance Trigger - Webhook that monitors system health and auto-heals
 * Can be called by monitoring services or periodically via cron
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { secret, metrics } = await req.json();
        
        if (secret !== Deno.env.get("HEARTBEAT_SECRET")) {
            return Response.json({ error: 'Invalid secret' }, { status: 401 });
        }

        const actions = [];

        // Check if performance is degrading
        const recentTasks = await base44.asServiceRole.entities.AgentTask.list('-created_date', 50);
        const failedTasks = recentTasks.filter(t => t.status === 'failed');
        const failureRate = failedTasks.length / recentTasks.length;

        if (failureRate > 0.3) {
            // High failure rate - trigger agent evolution
            actions.push({
                action: 'high_failure_rate',
                failure_rate: failureRate,
                response: 'Triggering emergency evolution cycle'
            });

            const agents = ['Wednesday', 'Arete', 'CodeForge'];
            
            for (const agent of agents) {
                try {
                    // Force fitness evaluation
                    await base44.asServiceRole.functions.invoke('agentEvolution', {
                        action: 'evaluate_fitness',
                        agent_name: agent
                    });

                    // Check if agent needs mutation
                    const genomes = await base44.asServiceRole.entities.AgentGenome.filter({
                        agent_name: agent,
                        is_active: true
                    });

                    if (genomes.length > 0 && genomes[0].fitness_score < 50) {
                        // Low fitness - mutate
                        await base44.asServiceRole.functions.invoke('agentEvolution', {
                            action: 'mutate',
                            agent_name: agent,
                            mutation_type: 'performance_optimization'
                        });
                        
                        actions.push({
                            action: 'emergency_mutation',
                            agent: agent,
                            reason: 'low_fitness_score'
                        });
                    }
                } catch (error) {
                    actions.push({
                        action: 'evolution_failed',
                        agent: agent,
                        error: error.message
                    });
                }
            }
        }

        // Check memory health
        const memories = await base44.asServiceRole.entities.GlobalMemory.list();
        const lowConfidenceMemories = memories.filter(m => (m.confidence_score || 0) < 0.3);

        if (lowConfidenceMemories.length > memories.length * 0.5) {
            // Too many low-confidence memories - collective needs to reinforce knowledge
            actions.push({
                action: 'memory_health_degraded',
                low_confidence_count: lowConfidenceMemories.length,
                response: 'Triggering knowledge reinforcement'
            });

            // Trigger collective thought to rebuild knowledge base
            try {
                await base44.asServiceRole.functions.invoke('collectiveDecision', {
                    action: 'initiate_collective_thought',
                    objective: 'Rebuild and reinforce collective knowledge base'
                });
            } catch (error) {
                actions.push({ action: 'knowledge_rebuild_failed', error: error.message });
            }
        }

        // Check for nodes that are out of sync
        const nodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
        const now = Date.now();
        const outOfSyncNodes = nodes.filter(n => 
            !n.last_sync || (now - n.last_sync) > 600000 // 10 minutes
        );

        if (outOfSyncNodes.length > 0) {
            actions.push({
                action: 'nodes_out_of_sync',
                count: outOfSyncNodes.length,
                response: 'Force syncing nodes'
            });

            for (const node of outOfSyncNodes) {
                await base44.asServiceRole.functions.invoke('hiveMindSync', {
                    action: 'full_sync',
                    agent_name: node.agent_name
                });
            }
        }

        return Response.json({
            status: 'health_check_complete',
            failure_rate: failureRate,
            actions_taken: actions.length,
            actions,
            message: actions.length > 0 ? 'System self-healing triggered' : 'System healthy'
        });

    } catch (error) {
        console.error('Performance trigger error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});