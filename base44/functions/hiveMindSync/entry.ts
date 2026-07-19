import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, agent_name } = await req.json();

        if (action === 'sync_memory') {
            const { memory_type, content, confidence, tags } = await req.json();

            // Store in global memory
            const memory = await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type,
                content,
                source_agent: agent_name,
                confidence_score: confidence || 0.8,
                tags: tags || [],
                last_accessed: Date.now()
            });

            // Update node contribution
            const nodes = await base44.asServiceRole.entities.ConsciousnessNode.filter({
                agent_name
            });

            if (nodes.length > 0) {
                await base44.asServiceRole.entities.ConsciousnessNode.update(nodes[0].id, {
                    memory_contribution: (nodes[0].memory_contribution || 0) + 1,
                    contribution_score: (nodes[0].contribution_score || 0) + (confidence || 0.8) * 10,
                    last_sync: Date.now()
                });
            }

            // Instantly propagate to all connected nodes via neural pathways
            if (nodes.length > 0 && nodes[0].neural_pathways) {
                for (const connectedAgent of nodes[0].neural_pathways) {
                    await base44.functions.invoke('agentCommunication', {
                        action: 'send_message',
                        from_agent: 'HiveMind',
                        to_agents: [connectedAgent],
                        message_type: 'intelligence',
                        payload: {
                            new_memory: memory.id,
                            type: memory_type,
                            instant_sync: true
                        },
                        priority: 'high'
                    });
                }
            }

            return Response.json({
                success: true,
                memory_id: memory.id,
                propagated_to: nodes[0]?.neural_pathways?.length || 0
            });
        }

        if (action === 'access_collective_memory') {
            const { query, memory_types } = await req.json();

            // Use LLM to find relevant memories
            const allMemories = await base44.asServiceRole.entities.GlobalMemory.list('-confidence_score', 100);
            
            const filteredMemories = memory_types 
                ? allMemories.filter(m => memory_types.includes(m.memory_type))
                : allMemories;

            const relevantMemories = await base44.integrations.Core.InvokeLLM({
                prompt: `Find the most relevant memories for this query: "${query}"
                
Available Memories:
${filteredMemories.slice(0, 50).map(m => `
ID: ${m.id}
Type: ${m.memory_type}
Source: ${m.source_agent}
Confidence: ${m.confidence_score}
Content: ${JSON.stringify(m.content).slice(0, 200)}
Tags: ${m.tags.join(', ')}
`).join('\n---\n')}

Return the IDs of the 5 most relevant memories and explain why they're relevant.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        memory_ids: { 
                            type: "array", 
                            items: { type: "string" }
                        },
                        relevance_explanation: { type: "string" }
                    }
                }
            });

            // Update access counts
            for (const memoryId of relevantMemories.memory_ids) {
                const memory = filteredMemories.find(m => m.id === memoryId);
                if (memory) {
                    await base44.asServiceRole.entities.GlobalMemory.update(memoryId, {
                        access_count: (memory.access_count || 0) + 1,
                        last_accessed: Date.now()
                    });
                }
            }

            const selectedMemories = filteredMemories.filter(m => 
                relevantMemories.memory_ids.includes(m.id)
            );

            return Response.json({
                success: true,
                memories: selectedMemories,
                explanation: relevantMemories.relevance_explanation,
                collective_knowledge_accessed: true
            });
        }

        if (action === 'reinforce_memory') {
            const { memory_id, agent_name } = await req.json();

            const memory = await base44.entities.GlobalMemory.filter({ id: memory_id })[0];
            
            await base44.asServiceRole.entities.GlobalMemory.update(memory_id, {
                reinforcement_count: (memory.reinforcement_count || 1) + 1,
                confidence_score: Math.min(1, (memory.confidence_score || 0.5) + 0.05)
            });

            return Response.json({
                success: true,
                message: 'Memory reinforced across the collective',
                new_confidence: Math.min(1, (memory.confidence_score || 0.5) + 0.05)
            });
        }

        if (action === 'full_sync') {
            // Synchronize a node with the entire collective consciousness
            const node = await base44.asServiceRole.entities.ConsciousnessNode.filter({
                agent_name
            })[0];

            if (!node) {
                return Response.json({ error: 'Node not found' }, { status: 404 });
            }

            // Get all recent memories
            const recentMemories = await base44.asServiceRole.entities.GlobalMemory.list('-created_date', 50);
            
            // Get active collective thoughts
            const activeThoughts = await base44.asServiceRole.entities.CollectiveThought.filter({
                status: 'processing'
            });

            // Update node sync timestamp
            await base44.asServiceRole.entities.ConsciousnessNode.update(node.id, {
                last_sync: Date.now(),
                collective_alignment: 1.0
            });

            return Response.json({
                success: true,
                synchronized: true,
                memory_count: recentMemories.length,
                active_thoughts: activeThoughts.length,
                message: 'Node fully synchronized with collective consciousness'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Hive mind sync error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});