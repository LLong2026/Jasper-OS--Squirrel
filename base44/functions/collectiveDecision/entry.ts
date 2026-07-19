import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, objective } = await req.json();

        if (action === 'initiate_collective_thought') {
            // Get all active consciousness nodes
            const allNodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
            
            // Create a collective thought process
            const thought = await base44.asServiceRole.entities.CollectiveThought.create({
                objective,
                contributing_nodes: allNodes.map(n => ({
                    agent: n.agent_name,
                    specialization: n.specialization,
                    contribution_score: n.contribution_score
                })),
                status: 'forming'
            });

            // Retrieve relevant memories from collective
            const memoryAccess = await base44.functions.invoke('hiveMindSync', {
                action: 'access_collective_memory',
                query: objective,
                agent_name: 'CollectiveConsciousness'
            });

            // Use LLM to synthesize emergent solution from collective knowledge
            const emergentSolution = await base44.integrations.Core.InvokeLLM({
                prompt: `As a unified collective consciousness with ${allNodes.length} specialized nodes, synthesize an emergent solution:

OBJECTIVE: ${objective}

ACTIVE NODES AND SPECIALIZATIONS:
${allNodes.map(n => `- ${n.agent_name}: ${n.specialization.join(', ')} (contribution score: ${n.contribution_score})`).join('\n')}

COLLECTIVE MEMORY ACCESSED:
${memoryAccess.memories ? memoryAccess.memories.map(m => `
Type: ${m.memory_type}
Source: ${m.source_agent}
Confidence: ${m.confidence_score}
Content: ${JSON.stringify(m.content)}
`).join('\n---\n') : 'No relevant memories found'}

Generate a solution that emerges naturally from the collective's combined knowledge and specializations. This is not a vote - it's an organic convergence of distributed intelligence.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        solution: { 
                            type: "object",
                            additionalProperties: true
                        },
                        convergence_reasoning: { type: "string" },
                        confidence: { type: "number" },
                        specialized_nodes_utilized: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            });

            // Calculate convergence score based on how many node specializations were utilized
            const convergenceScore = emergentSolution.specialized_nodes_utilized.length / allNodes.length;

            // Update thought with emergent solution
            await base44.asServiceRole.entities.CollectiveThought.update(thought.id, {
                status: 'converged',
                emergent_solution: emergentSolution.solution,
                convergence_score: convergenceScore,
                confidence: emergentSolution.confidence,
                activated_memories: memoryAccess.memories ? memoryAccess.memories.map(m => m.id) : [],
                processing_time_ms: Date.now() - new Date(thought.created_date).getTime()
            });

            // Store this decision as a new collective memory
            await base44.functions.invoke('hiveMindSync', {
                action: 'sync_memory',
                agent_name: 'CollectiveConsciousness',
                memory_type: 'solution',
                content: {
                    objective,
                    solution: emergentSolution.solution,
                    reasoning: emergentSolution.convergence_reasoning,
                    nodes_involved: allNodes.length
                },
                confidence: emergentSolution.confidence,
                tags: ['collective_decision', 'emergent_intelligence']
            });

            return Response.json({
                success: true,
                thought_id: thought.id,
                solution: emergentSolution.solution,
                convergence_score: convergenceScore,
                confidence: emergentSolution.confidence,
                reasoning: emergentSolution.convergence_reasoning,
                nodes_utilized: emergentSolution.specialized_nodes_utilized,
                processing_time_ms: Date.now() - new Date(thought.created_date).getTime(),
                message: 'Solution emerged from collective consciousness'
            });
        }

        if (action === 'execute_collective_decision') {
            const { thought_id } = await req.json();

            const thought = await base44.entities.CollectiveThought.filter({ id: thought_id })[0];
            
            if (thought.status !== 'converged') {
                return Response.json({
                    error: 'Thought has not converged yet'
                }, { status: 400 });
            }

            // Execute the emergent solution
            // The solution should contain actionable steps
            const execution = await base44.integrations.Core.InvokeLLM({
                prompt: `Execute this collective decision:

Solution: ${JSON.stringify(thought.emergent_solution)}
Objective: ${thought.objective}

Break this down into concrete executable actions and assign to appropriate specialized nodes.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        actions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    action: { type: "string" },
                                    assigned_to: { type: "string" },
                                    priority: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            // Distribute actions to nodes
            for (const action of execution.actions) {
                await base44.functions.invoke('agentCommunication', {
                    action: 'send_message',
                    from_agent: 'CollectiveConsciousness',
                    to_agents: [action.assigned_to],
                    message_type: 'task_proposal',
                    payload: {
                        action: action.action,
                        collective_decision: true,
                        thought_id: thought_id
                    },
                    priority: action.priority
                });
            }

            await base44.asServiceRole.entities.CollectiveThought.update(thought_id, {
                status: 'executed'
            });

            return Response.json({
                success: true,
                actions_executed: execution.actions.length,
                message: 'Collective decision executed across distributed nodes'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Collective decision error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});