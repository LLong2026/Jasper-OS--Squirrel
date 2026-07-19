import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, from_agent, to_agents, message_type, payload, priority, thread_id } = await req.json();

        if (action === 'send_message') {
            // Create message
            const message = await base44.asServiceRole.entities.AgentMessage.create({
                from_agent,
                to_agents: to_agents || [],
                message_type,
                payload,
                priority: priority || 'medium',
                thread_id: thread_id || `thread_${Date.now()}`,
                requires_response: message_type === 'consensus_request' || message_type === 'task_proposal'
            });

            // If broadcast or intelligence sharing, notify all relevant agents
            if (to_agents.length === 0 || message_type === 'intelligence') {
                await base44.asServiceRole.entities.NodeEvent.create({
                    node_id: 'agent_mesh',
                    event_type: 'intelligence_broadcast',
                    payload: {
                        from: from_agent,
                        type: message_type,
                        content: payload
                    }
                });
            }

            // Detect conflicts automatically
            if (message_type === 'task_proposal') {
                const conflicts = await detectConflicts(base44, payload);
                if (conflicts.length > 0) {
                    await base44.asServiceRole.entities.AgentMessage.create({
                        from_agent: 'system',
                        to_agents: [from_agent],
                        message_type: 'conflict_alert',
                        payload: { conflicts },
                        priority: 'high'
                    });
                }
            }

            return Response.json({
                success: true,
                message,
                conflicts_detected: message_type === 'task_proposal'
            });
        }

        if (action === 'acknowledge') {
            const { message_id, acknowledging_agent } = await req.json();
            
            const message = await base44.entities.AgentMessage.filter({ id: message_id })[0];
            if (!message) {
                return Response.json({ error: 'Message not found' }, { status: 404 });
            }

            const updatedAcknowledged = [...(message.acknowledged_by || []), acknowledging_agent];
            await base44.asServiceRole.entities.AgentMessage.update(message_id, {
                acknowledged_by: updatedAcknowledged
            });

            return Response.json({
                success: true,
                all_acknowledged: updatedAcknowledged.length === message.to_agents.length
            });
        }

        if (action === 'get_messages') {
            const { agent_name, unacknowledged_only } = await req.json();
            
            const allMessages = await base44.entities.AgentMessage.list('-created_date', 100);
            
            let filtered = allMessages.filter(m => 
                m.to_agents.includes(agent_name) || m.to_agents.length === 0
            );

            if (unacknowledged_only) {
                filtered = filtered.filter(m => 
                    !m.acknowledged_by.includes(agent_name)
                );
            }

            return Response.json({
                success: true,
                messages: filtered,
                count: filtered.length
            });
        }

        if (action === 'get_thread') {
            const messages = await base44.entities.AgentMessage.filter({ thread_id });
            
            return Response.json({
                success: true,
                thread_id,
                messages: messages.sort((a, b) => 
                    new Date(a.created_date) - new Date(b.created_date)
                )
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Agent communication error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function detectConflicts(base44, proposedTask) {
    const conflicts = [];

    // Check for resource conflicts
    const activeTasks = await base44.asServiceRole.entities.AgentTask.filter({
        status: 'in_progress'
    });

    for (const task of activeTasks) {
        if (task.required_resources) {
            const overlap = findResourceOverlap(
                proposedTask.required_resources,
                task.required_resources
            );
            if (overlap.length > 0) {
                conflicts.push({
                    type: 'resource_conflict',
                    conflicting_task: task.task_id,
                    resources: overlap
                });
            }
        }
    }

    // Check for agent availability conflicts
    const taskForces = await base44.asServiceRole.entities.TaskForce.filter({
        status: 'active'
    });

    for (const tf of taskForces) {
        const proposedAgents = proposedTask.agents_needed || [];
        const occupiedAgents = tf.members.map(m => m.agent_name);
        const overlap = proposedAgents.filter(a => occupiedAgents.includes(a));
        
        if (overlap.length > 0) {
            conflicts.push({
                type: 'agent_availability',
                task_force: tf.name,
                agents: overlap
            });
        }
    }

    return conflicts;
}

function findResourceOverlap(resources1, resources2) {
    if (!resources1 || !resources2) return [];
    
    const overlap = [];
    for (const [key, value] of Object.entries(resources1)) {
        if (resources2[key] && resources2[key] > 0 && value > 0) {
            overlap.push(key);
        }
    }
    return overlap;
}