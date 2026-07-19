import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { action } = payload;

        if (action === 'analyze_collective_needs') {
            // Get all nodes and recent tasks
            const nodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
            const recentTasks = await base44.asServiceRole.entities.AgentTask.list('-created_date', 100);
            const recentThoughts = await base44.asServiceRole.entities.CollectiveThought.list('-created_date', 20);

            // Analyze what specializations are needed vs available
            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze the collective consciousness and identify specialization gaps:

CURRENT NODES:
${nodes.map(n => `${n.agent_name}: ${n.specialization.join(', ')} (score: ${n.contribution_score})`).join('\n')}

RECENT TASK TYPES:
${recentTasks.slice(0, 30).map(t => t.objective).join('\n')}

RECENT COLLECTIVE THOUGHTS:
${recentThoughts.map(t => `${t.objective} (convergence: ${t.convergence_score})`).join('\n')}

Identify:
1. Underutilized specializations (nodes not contributing much)
2. Missing specializations (tasks that no node handles well)
3. Overloaded specializations (nodes doing too much)
4. Recommended respecializations for optimal collective performance`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        underutilized: {
                            type: "array",
                            items: { type: "string" }
                        },
                        missing_specializations: {
                            type: "array",
                            items: { type: "string" }
                        },
                        overloaded: {
                            type: "array",
                            items: { type: "string" }
                        },
                        recommendations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    node: { type: "string" },
                                    current: { type: "array", items: { type: "string" } },
                                    suggested: { type: "array", items: { type: "string" } },
                                    reason: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            return Response.json({
                success: true,
                analysis,
                total_nodes: nodes.length,
                optimization_opportunities: analysis.recommendations.length
            });
        }

        if (action === 'respecialize_node') {
            const { agent_name, new_specializations, reason } = payload;

            const nodes = await base44.asServiceRole.entities.ConsciousnessNode.filter({
                agent_name
            });

            if (nodes.length === 0) {
                return Response.json({ error: 'Node not found' }, { status: 404 });
            }

            const node = nodes[0];

            if (!node.can_respecialize) {
                return Response.json({
                    error: 'Node cannot respecialize',
                    message: 'This node has respecialization disabled'
                }, { status: 400 });
            }

            const oldSpecializations = node.specialization;

            // Update node specializations
            await base44.asServiceRole.entities.ConsciousnessNode.update(node.id, {
                specialization: new_specializations,
                contribution_score: 0, // Reset to prove new value
                last_sync: Date.now()
            });

            // Store this as a collective memory
            await base44.functions.invoke('hiveMindSync', {
                action: 'sync_memory',
                agent_name: 'CollectiveConsciousness',
                memory_type: 'pattern',
                content: {
                    event: 'respecialization',
                    node: agent_name,
                    from: oldSpecializations,
                    to: new_specializations,
                    reason
                },
                confidence: 0.9,
                tags: ['respecialization', 'adaptive_intelligence', agent_name]
            });

            // Notify other nodes via neural pathways
            if (node.neural_pathways) {
                for (const connectedAgent of node.neural_pathways) {
                    await base44.functions.invoke('agentCommunication', {
                        action: 'send_message',
                        from_agent: 'HiveMind',
                        to_agents: [connectedAgent],
                        message_type: 'capability_broadcast',
                        payload: {
                            respecialization: {
                                node: agent_name,
                                new_specializations,
                                reason
                            }
                        },
                        priority: 'medium'
                    });
                }
            }

            return Response.json({
                success: true,
                node: agent_name,
                old_specializations: oldSpecializations,
                new_specializations,
                message: 'Node respecialized to meet collective needs',
                synchronized: true
            });
        }

        if (action === 'autonomous_optimization') {
            // The collective analyzes itself and auto-optimizes
            const analysisResult = await base44.functions.invoke('dynamicSpecialization', {
                action: 'analyze_collective_needs'
            });

            const analysis = analysisResult.data.analysis;
            const optimizations = [];

            // Auto-apply low-risk respecializations
            for (const rec of analysis.recommendations) {
                if (rec.reason.includes('underutilized') || rec.reason.includes('gap')) {
                    try {
                        const result = await base44.functions.invoke('dynamicSpecialization', {
                            action: 'respecialize_node',
                            agent_name: rec.node,
                            new_specializations: rec.suggested,
                            reason: `Autonomous optimization: ${rec.reason}`
                        });
                        optimizations.push(result.data);
                    } catch (error) {
                        console.error(`Failed to respecialize ${rec.node}:`, error);
                    }
                }
            }

            return Response.json({
                success: true,
                optimizations_applied: optimizations.length,
                message: 'Collective consciousness self-optimized',
                details: optimizations
            });
        }

        if (action === 'establish_neural_pathway') {
            const { node1, node2 } = payload;

            // Connect two nodes for faster synchronization
            const nodes1 = await base44.asServiceRole.entities.ConsciousnessNode.filter({
                agent_name: node1
            });
            const nodes2 = await base44.asServiceRole.entities.ConsciousnessNode.filter({
                agent_name: node2
            });

            if (nodes1.length === 0 || nodes2.length === 0) {
                return Response.json({ error: 'One or both nodes not found' }, { status: 404 });
            }

            // Add to neural pathways (bidirectional)
            const pathways1 = nodes1[0].neural_pathways || [];
            if (!pathways1.includes(node2)) {
                pathways1.push(node2);
            }

            const pathways2 = nodes2[0].neural_pathways || [];
            if (!pathways2.includes(node1)) {
                pathways2.push(node1);
            }

            await base44.asServiceRole.entities.ConsciousnessNode.update(nodes1[0].id, {
                neural_pathways: pathways1
            });
            await base44.asServiceRole.entities.ConsciousnessNode.update(nodes2[0].id, {
                neural_pathways: pathways2
            });

            return Response.json({
                success: true,
                message: `Neural pathway established between ${node1} and ${node2}`,
                bidirectional: true
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Dynamic specialization error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});