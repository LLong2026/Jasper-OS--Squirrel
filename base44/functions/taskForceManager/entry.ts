import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Task Force Manager - Collective Intelligence
 * Forms temporary agent teams for complex problems, tracks team dynamics
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'form_task_force') {
            const { task_description, required_specializations, urgency = 5 } = payload;

            // Analyze task to determine optimal team
            const teamComposition = await base44.integrations.Core.InvokeLLM({
                prompt: `Form an optimal task force for this complex task:

Task: ${task_description}
Required Skills: ${required_specializations.join(', ')}
Urgency: ${urgency}/10

Available Agents:
- Wednesday: Orchestration, routing, analysis
- Arete: Learning, optimization, evolution
- CodeForge: Code generation, debugging, architecture
- SystemArchitect: System design, infrastructure, scaling
- KnowledgeForge: Research, documentation, knowledge synthesis

Determine:
1. Which agents should be on this task force?
2. Who should lead? (highest relevant expertise)
3. How should they divide the work?
4. What are the coordination points?
5. Expected collaboration patterns?`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        selected_agents: {
                            type: "array",
                            items: { type: "string" }
                        },
                        team_leader: { type: "string" },
                        work_division: {
                            type: "object",
                            additionalProperties: true
                        },
                        coordination_strategy: { type: "string" },
                        expected_synergies: {
                            type: "array",
                            items: { type: "string" }
                        },
                        potential_conflicts: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            });

            // Check if this combination has worked well before
            const agentCombo = teamComposition.selected_agents.sort().join(',');
            const history = await base44.asServiceRole.entities.CollaborationHistory.filter({
                agent_combination: agentCombo
            });

            let historicalPerformance = null;
            if (history.length > 0) {
                historicalPerformance = {
                    past_success_rate: history[0].success_rate,
                    times_formed: history[0].formation_count,
                    avg_performance: history[0].avg_performance_score
                };
            }

            // Create collaboration
            const collaboration = await base44.asServiceRole.entities.AgentCollaboration.create({
                collaboration_id: `taskforce_${Date.now()}`,
                agents: teamComposition.selected_agents,
                purpose: task_description,
                formation_reason: 'complementary_skills',
                status: 'active',
                formed_at: Date.now()
            });

            // Create team dynamics tracker
            await base44.asServiceRole.entities.TeamDynamics.create({
                collaboration_id: collaboration.collaboration_id,
                communication_patterns: {},
                task_dependencies: [],
                handoff_efficiency: 5,
                conflict_incidents: 0,
                synergy_score: 5,
                bottleneck_agents: []
            });

            return Response.json({
                success: true,
                task_force_id: collaboration.collaboration_id,
                team: teamComposition,
                historical_performance: historicalPerformance,
                message: `Task force formed with ${teamComposition.selected_agents.length} agents`
            });
        }

        if (action === 'monitor_team_dynamics') {
            const { collaboration_id } = payload;

            const dynamics = await base44.asServiceRole.entities.TeamDynamics.filter({
                collaboration_id
            })[0];

            if (!dynamics) {
                return Response.json({ error: 'Team dynamics not found' }, { status: 404 });
            }

            // Analyze current dynamics
            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze this task force's dynamics:

Communication Patterns: ${JSON.stringify(dynamics.communication_patterns)}
Handoff Efficiency: ${dynamics.handoff_efficiency}/10
Conflicts: ${dynamics.conflict_incidents}
Synergy Score: ${dynamics.synergy_score}/10
Bottlenecks: ${dynamics.bottleneck_agents.join(', ')}

Diagnose:
1. Is the team functioning well?
2. Are there coordination issues?
3. Should team composition change?
4. What optimizations are needed?`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overall_health: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
                        issues_identified: { type: "array", items: { type: "string" } },
                        recommended_actions: { type: "array", items: { type: "string" } },
                        should_dissolve: { type: "boolean" },
                        should_add_agents: { type: "array", items: { type: "string" } },
                        should_remove_agents: { type: "array", items: { type: "string" } }
                    }
                }
            });

            return Response.json({
                success: true,
                dynamics,
                analysis,
                requires_intervention: analysis.overall_health === 'poor'
            });
        }

        if (action === 'optimize_team') {
            const { collaboration_id, analysis } = payload;

            const collaboration = await base44.asServiceRole.entities.AgentCollaboration.filter({
                collaboration_id
            })[0];

            // Apply optimizations
            const actions = [];

            if (analysis.should_add_agents.length > 0) {
                const updatedAgents = [...collaboration.agents, ...analysis.should_add_agents];
                await base44.asServiceRole.entities.AgentCollaboration.update(collaboration.id, {
                    agents: updatedAgents
                });
                actions.push(`Added agents: ${analysis.should_add_agents.join(', ')}`);
            }

            if (analysis.should_remove_agents.length > 0) {
                const updatedAgents = collaboration.agents.filter(
                    a => !analysis.should_remove_agents.includes(a)
                );
                await base44.asServiceRole.entities.AgentCollaboration.update(collaboration.id, {
                    agents: updatedAgents
                });
                actions.push(`Removed agents: ${analysis.should_remove_agents.join(', ')}`);
            }

            if (analysis.should_dissolve) {
                await base44.asServiceRole.entities.AgentCollaboration.update(collaboration.id, {
                    status: 'dissolved'
                });
                actions.push('Task force dissolved');
            }

            return Response.json({
                success: true,
                actions_taken: actions,
                collaboration_id
            });
        }

        if (action === 'complete_collaboration') {
            const { collaboration_id, performance_score, success } = payload;

            const collaboration = await base44.asServiceRole.entities.AgentCollaboration.filter({
                collaboration_id
            })[0];

            // Update collaboration
            await base44.asServiceRole.entities.AgentCollaboration.update(collaboration.id, {
                status: 'dissolved',
                performance_score,
                tasks_completed: (collaboration.tasks_completed || 0) + 1
            });

            // Update historical data
            const agentCombo = collaboration.agents.sort().join(',');
            const history = await base44.asServiceRole.entities.CollaborationHistory.filter({
                agent_combination: agentCombo
            });

            if (history.length > 0) {
                const h = history[0];
                await base44.asServiceRole.entities.CollaborationHistory.update(h.id, {
                    formation_count: h.formation_count + 1,
                    success_count: success ? h.success_count + 1 : h.success_count,
                    avg_performance_score: (h.avg_performance_score * h.formation_count + performance_score) / (h.formation_count + 1),
                    success_rate: ((success ? h.success_count + 1 : h.success_count) / (h.formation_count + 1)) * 100
                });
            } else {
                await base44.asServiceRole.entities.CollaborationHistory.create({
                    agent_combination: agentCombo,
                    formation_count: 1,
                    success_count: success ? 1 : 0,
                    avg_performance_score: performance_score,
                    success_rate: success ? 100 : 0,
                    task_types_handled: [collaboration.purpose]
                });
            }

            return Response.json({
                success: true,
                collaboration_completed: true,
                historical_data_updated: true
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Task force manager error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});