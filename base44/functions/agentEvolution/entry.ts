import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, agent_name } = await req.json();

        if (action === 'evaluate_fitness') {
            // Get agent performance
            const performance = await base44.asServiceRole.entities.AgentPerformance.filter({
                agent_name
            })[0];

            if (!performance) {
                return Response.json({ error: 'No performance data' }, { status: 404 });
            }

            // Calculate fitness score
            const fitness = (
                (performance.success_rate * 0.4) +
                (performance.total_tasks / 100 * 0.2) +
                (performance.avg_execution_time_ms < 1000 ? 30 : 10) +
                (Object.keys(performance.specialties_performance || {}).length * 5)
            );

            // Get or create genome
            const existingGenome = await base44.asServiceRole.entities.AgentGenome.filter({
                agent_name,
                is_active: true
            });

            if (existingGenome.length === 0) {
                // Initialize genome from agent config
                const agentConfig = await base44.functions.invoke('readFile', {
                    file_path: `agents/${agent_name}.json`
                });

                const genome = await base44.asServiceRole.entities.AgentGenome.create({
                    agent_name,
                    generation: 1,
                    instruction_dna: JSON.parse(agentConfig.content).instructions,
                    trait_weights: { exploration: 0.5, exploitation: 0.5, collaboration: 0.5 },
                    fitness_score: fitness,
                    safety_constraints: {
                        never_modify: ['authentication', 'authorization', 'data_deletion'],
                        require_approval: ['system_changes', 'external_api_calls']
                    }
                });

                return Response.json({ success: true, genome, fitness });
            }

            await base44.asServiceRole.entities.AgentGenome.update(existingGenome[0].id, {
                fitness_score: fitness
            });

            return Response.json({ success: true, genome: existingGenome[0], fitness });
        }

        if (action === 'mutate') {
            const { mutation_type } = await req.json();

            const genome = await base44.asServiceRole.entities.AgentGenome.filter({
                agent_name,
                is_active: true
            })[0];

            // Use LLM to generate beneficial mutation
            const mutation = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a beneficial mutation for agent ${agent_name}:

Current Instructions: ${genome.instruction_dna}
Current Fitness: ${genome.fitness_score}
Generation: ${genome.generation}

Mutation Type: ${mutation_type}

Create an improved version of the instructions that:
1. Maintains safety constraints
2. Improves task performance
3. Is a small, testable change
4. Has clear success criteria

Return the mutated instructions and expected improvement.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        mutated_instructions: { type: "string" },
                        mutation_description: { type: "string" },
                        expected_improvement: { type: "string" },
                        risk_level: { type: "string", enum: ["low", "medium", "high"] }
                    }
                }
            });

            // Safety check - require approval for medium/high risk
            if (mutation.risk_level !== 'low') {
                const approval = await base44.functions.invoke('approvalWorkflow', {
                    action: 'create',
                    action_type: 'agent_mutation',
                    details: {
                        agent: agent_name,
                        mutation: mutation.mutation_description,
                        risk: mutation.risk_level
                    },
                    estimated_cost: 0
                });

                if (!approval.auto_approved) {
                    return Response.json({
                        success: true,
                        requires_approval: true,
                        approval_id: approval.approval_request.id,
                        mutation
                    });
                }
            }

            // Golden Master Validation every 10 generations
            if ((genome.generation + 1) % 10 === 0) {
                const validationTasks = await base44.asServiceRole.entities.CoreValidationTask.filter({
                    agent_name
                });

                if (validationTasks.length > 0) {
                    const validationResults = [];
                    let totalScore = 0;

                    for (const task of validationTasks) {
                        const result = await base44.integrations.Core.InvokeLLM({
                            prompt: `Test agent instructions against core functionality:

New Instructions: ${mutation.mutated_instructions}
Task: ${task.task_description}
Expected Outcome: ${JSON.stringify(task.expected_outcome)}

Does the agent still accomplish this core task? Score 0-10.`,
                            response_json_schema: {
                                type: "object",
                                properties: {
                                    score: { type: "number" },
                                    passes: { type: "boolean" },
                                    reasoning: { type: "string" }
                                }
                            }
                        });

                        validationResults.push({
                            task_id: task.id,
                            task: task.task_description,
                            score: result.score,
                            passes: result.passes,
                            reasoning: result.reasoning
                        });

                        totalScore += result.score;
                    }

                    const avgScore = totalScore / validationTasks.length;

                    // Reject if validation fails
                    if (avgScore < 7.0) {
                        return Response.json({
                            success: false,
                            error: 'Golden Master validation failed',
                            validation_score: avgScore,
                            validation_results: validationResults,
                            message: 'Evolution rejected - agent has drifted from core functionality'
                        });
                    }
                    }
                    }

                    // CONSTITUTIONAL FIREWALL - Validate against immutable laws
                    const constitutionalCheck = await base44.asServiceRole.functions.invoke('safetyValidator', {
                    proposed_genome: {
                    agent_name,
                    generation: genome.generation + 1,
                    instruction_dna: mutation.mutated_instructions,
                    mutations: [...genome.mutations, {
                        type: mutation_type,
                        description: mutation.mutation_description,
                        generation: genome.generation + 1,
                        timestamp: Date.now()
                    }]
                    },
                    current_genome: genome
                    });

                    if (!constitutionalCheck.approved) {
                    return Response.json({
                    success: false,
                    error: 'Constitutional violation detected',
                    risks: constitutionalCheck.risks,
                    law_violations: constitutionalCheck.law_violations,
                    message: 'Evolution BLOCKED by Constitutional Firewall - immutable law violation'
                    });
                    }

                    // Log successful constitutional approval
                    await base44.asServiceRole.entities.GlobalMemory.create({
                    memory_type: 'experience',
                    content: {
                    event: 'mutation_approved',
                    agent: agent_name,
                    generation: genome.generation + 1,
                    mutation_type
                    },
                    source_agent: 'ConstitutionalFirewall',
                    tags: ['evolution', 'approved']
                    });

                    // Continue with mutation if approved
                    {
                }
            }

            // Create new generation
            await base44.asServiceRole.entities.AgentGenome.update(genome.id, {
                is_active: false
            });

            const newGenome = await base44.asServiceRole.entities.AgentGenome.create({
                agent_name,
                generation: genome.generation + 1,
                instruction_dna: mutation.mutated_instructions,
                trait_weights: genome.trait_weights,
                mutations: [...genome.mutations, {
                    type: mutation_type,
                    description: mutation.mutation_description,
                    generation: genome.generation + 1,
                    timestamp: Date.now()
                }],
                fitness_score: genome.fitness_score,
                parent_genome_id: genome.id,
                safety_constraints: genome.safety_constraints,
                validation_history: genome.validation_history || [],
                last_validation_score: genome.last_validation_score
            });

            return Response.json({
                success: true,
                new_generation: newGenome.generation,
                mutation,
                message: 'Agent evolved to next generation'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Agent evolution error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});