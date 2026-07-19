import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Task Decomposition Engine
 * Breaks abstract goals into concrete, executable sub-tasks
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, agent_name, payload } = await req.json();

        if (action === 'decompose_goal') {
            const { abstract_goal, max_depth = 3, available_agents } = payload;

            // Use reasoning to understand the goal
            const goalAnalysis = await base44.functions.invoke('reasoningEngine', {
                action: 'multi_hop_reasoning',
                agent_name,
                payload: {
                    query: `Analyze this abstract goal and identify what needs to be done: ${abstract_goal}`,
                    max_hops: 3
                }
            });

            // Decompose into subtasks
            const decomposition = await base44.integrations.Core.InvokeLLM({
                prompt: `You are ${agent_name}. Break down this abstract goal into concrete, executable subtasks.

Abstract Goal: ${abstract_goal}

Analysis: ${goalAnalysis.data.final_conclusion}

Available Agents: ${available_agents?.join(', ') || 'Wednesday, Arete, CodeForge, SystemArchitect'}

Create a decomposition with:
1. Clear, actionable subtasks
2. Dependencies between subtasks
3. Complexity estimates (1-10)
4. Required capabilities for each subtask
5. Suggested agent assignments
6. Execution order/parallelization

Be specific. Each subtask should be executable with clear success criteria.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        subtasks: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    subtask_id: { type: "string" },
                                    description: { type: "string" },
                                    success_criteria: { type: "string" },
                                    dependencies: { type: "array", items: { type: "string" } },
                                    estimated_complexity: { type: "number" },
                                    required_capabilities: { type: "array", items: { type: "string" } },
                                    assigned_agent: { type: "string" },
                                    parallelizable: { type: "boolean" }
                                }
                            }
                        },
                        execution_strategy: {
                            type: "object",
                            properties: {
                                parallel_batches: { type: "array" },
                                critical_path: { type: "array", items: { type: "string" } },
                                estimated_total_time: { type: "number" }
                            }
                        }
                    }
                }
            });

            // Create task decomposition record
            const taskDecomp = await base44.asServiceRole.entities.TaskDecomposition.create({
                decomposition_id: `decomp_${Date.now()}`,
                agent_name,
                abstract_goal,
                concrete_subtasks: decomposition.subtasks.map(st => ({
                    ...st,
                    status: 'pending'
                })),
                execution_plan: decomposition.execution_strategy,
                status: 'planning'
            });

            // Create agent tasks for each subtask
            const createdTasks = [];
            for (const subtask of decomposition.subtasks) {
                const task = await base44.asServiceRole.entities.AgentTask.create({
                    task_id: subtask.subtask_id,
                    initiated_by: agent_name,
                    task_type: 'decomposed_subtask',
                    priority: 10 - subtask.estimated_complexity,
                    status: 'pending',
                    assigned_agents: [subtask.assigned_agent],
                    required_resources: {
                        compute: subtask.estimated_complexity * 10,
                        dependencies: subtask.dependencies
                    }
                });
                createdTasks.push(task.task_id);
            }

            return Response.json({
                success: true,
                decomposition_id: taskDecomp.decomposition_id,
                subtasks_created: decomposition.subtasks.length,
                subtasks: decomposition.subtasks,
                execution_strategy: decomposition.execution_strategy,
                task_ids: createdTasks
            });
        }

        if (action === 'execute_decomposition') {
            const { decomposition_id } = payload;

            const decomp = await base44.asServiceRole.entities.TaskDecomposition.filter({
                decomposition_id
            })[0];

            if (!decomp) {
                return Response.json({ error: 'Decomposition not found' }, { status: 404 });
            }

            // Update status
            await base44.asServiceRole.entities.TaskDecomposition.update(decomp.id, {
                status: 'executing'
            });

            // Execute in parallel batches according to strategy
            const executionResults = [];
            const parallelBatches = decomp.execution_plan.parallel_batches || [];

            for (const batch of parallelBatches) {
                const batchResults = await Promise.all(
                    batch.map(async (subtaskId) => {
                        const subtask = decomp.concrete_subtasks.find(st => st.subtask_id === subtaskId);
                        
                        // Execute via assigned agent
                        const result = await base44.functions.invoke('autonomousOrchestrator', {
                            action: 'delegate_task',
                            agent_name: subtask.assigned_agent,
                            payload: {
                                task_description: subtask.description,
                                success_criteria: subtask.success_criteria
                            }
                        });

                        return {
                            subtask_id: subtaskId,
                            success: result.data.success,
                            result: result.data
                        };
                    })
                );

                executionResults.push(...batchResults);
            }

            // Update decomposition with results
            const allSuccessful = executionResults.every(r => r.success);
            const progress = (executionResults.filter(r => r.success).length / decomp.concrete_subtasks.length) * 100;

            await base44.asServiceRole.entities.TaskDecomposition.update(decomp.id, {
                status: allSuccessful ? 'completed' : 'failed',
                progress
            });

            return Response.json({
                success: allSuccessful,
                decomposition_id,
                execution_results: executionResults,
                progress,
                message: allSuccessful ? 'All subtasks completed successfully' : 'Some subtasks failed'
            });
        }

        if (action === 'adaptive_replan') {
            // Re-plan if subtasks are failing
            const { decomposition_id, failed_subtasks } = payload;

            const decomp = await base44.asServiceRole.entities.TaskDecomposition.filter({
                decomposition_id
            })[0];

            const replan = await base44.integrations.Core.InvokeLLM({
                prompt: `Re-plan this decomposition. Some subtasks failed.

Original Goal: ${decomp.abstract_goal}
Failed Subtasks: ${failed_subtasks.map(f => f.description).join(', ')}

Generate alternative approaches for the failed subtasks.
Consider:
1. Different decomposition strategies
2. Different agent assignments
3. Additional resources needed
4. Workarounds or fallbacks`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        alternative_subtasks: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    subtask_id: { type: "string" },
                                    description: { type: "string" },
                                    replaces: { type: "string" },
                                    rationale: { type: "string" }
                                }
                            }
                        },
                        updated_strategy: { type: "string" }
                    }
                }
            });

            // Update decomposition with new plan
            const updatedSubtasks = decomp.concrete_subtasks.map(st => {
                const replacement = replan.alternative_subtasks.find(alt => alt.replaces === st.subtask_id);
                return replacement ? { ...st, ...replacement, status: 'pending' } : st;
            });

            await base44.asServiceRole.entities.TaskDecomposition.update(decomp.id, {
                concrete_subtasks: updatedSubtasks,
                execution_plan: {
                    ...decomp.execution_plan,
                    updated_strategy: replan.updated_strategy
                }
            });

            return Response.json({
                success: true,
                replanned_subtasks: replan.alternative_subtasks.length,
                message: 'Decomposition replanned with alternative approaches'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Task decomposer error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});