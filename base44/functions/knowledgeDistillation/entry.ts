import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Knowledge Distillation Service
 * Compresses knowledge from massive models (50K+ layers) into efficient smaller models
 * Enables deployment of learned intelligence at scale
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, teacher_model_id, config } = await req.json();

        if (action === 'distill_knowledge') {
            const { 
                target_layers = 12,
                distillation_method = 'attention_transfer',
                preserve_capabilities = []
            } = config;

            // Get teacher model architecture
            const teacherMemory = await base44.asServiceRole.entities.GlobalMemory.filter({
                tags: { $contains: `model_${teacher_model_id}` }
            })[0];

            if (!teacherMemory) {
                return Response.json({ error: 'Teacher model not found' }, { status: 404 });
            }

            const teacherArch = teacherMemory.content.architecture;
            const compressionRatio = teacherArch.total_layers / target_layers;

            // Use LLM to design optimal student architecture
            const studentDesign = await base44.integrations.Core.InvokeLLM({
                prompt: `Design a compact student model to distill knowledge from a ${teacherArch.total_layers}-layer teacher:

Teacher Model:
- Layers: ${teacherArch.total_layers}
- Parameters: ${teacherArch.total_parameters}
- Skip Connections: ${teacherArch.skip_connections?.length || 0}
- Attention Layers: ${teacherArch.attention_layers?.length || 0}

Student Requirements:
- Target Layers: ${target_layers}
- Compression Ratio: ${compressionRatio.toFixed(1)}x
- Must preserve: ${preserve_capabilities.join(', ')}
- Distillation Method: ${distillation_method}

Design a student architecture that:
1. Maintains critical skip connections
2. Preserves attention mechanisms at key positions
3. Optimizes for inference speed
4. Retains teacher's core capabilities

Return architecture specification and distillation strategy.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        student_architecture: {
                            type: "object",
                            properties: {
                                total_layers: { type: "number" },
                                total_parameters: { type: "number" },
                                skip_connections: { type: "array", items: { type: "number" } },
                                attention_layers: { type: "array", items: { type: "number" } },
                                layer_widths: { type: "array", items: { type: "number" } }
                            }
                        },
                        distillation_strategy: {
                            type: "object",
                            properties: {
                                temperature: { type: "number" },
                                loss_weights: { type: "object" },
                                training_phases: { type: "array", items: { type: "string" } }
                            }
                        },
                        expected_performance_retention: { type: "number" },
                        speedup_factor: { type: "number" }
                    }
                }
            });

            // Create distillation task
            const distillationTask = await base44.asServiceRole.entities.AgentTask.create({
                initiated_by: 'KnowledgeDistillation',
                task_type: 'learning',
                priority: 7,
                status: 'pending',
                assigned_agents: ['Arete', 'Wednesday'],
                required_resources: {
                    gpu_nodes: 2,
                    memory_gb: 64,
                    estimated_duration_hours: Math.ceil(target_layers / 10)
                },
                result: {
                    teacher_model_id,
                    student_design: studentDesign,
                    distillation_progress: 0,
                    performance_retention: 0
                }
            });

            // Store distillation configuration
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'system_state',
                content: {
                    distillation_task_id: distillationTask.id,
                    teacher_id: teacher_model_id,
                    student_config: studentDesign,
                    compression_ratio: compressionRatio,
                    start_time: Date.now()
                },
                source_agent: 'KnowledgeDistillation',
                tags: ['distillation', `teacher_${teacher_model_id}`, 'model_compression']
            });

            return Response.json({
                success: true,
                distillation_task_id: distillationTask.id,
                student_architecture: studentDesign.student_architecture,
                compression_ratio: compressionRatio,
                expected_performance_retention: studentDesign.expected_performance_retention,
                speedup_factor: studentDesign.speedup_factor,
                message: `Distillation initiated: ${compressionRatio.toFixed(1)}x compression`
            });
        }

        if (action === 'progressive_distillation') {
            // Multi-stage distillation: Teacher -> Intermediate -> Student
            const stages = config.stages || [
                { layers: 1000, name: 'intermediate_1' },
                { layers: 100, name: 'intermediate_2' },
                { layers: 12, name: 'final_student' }
            ];

            const distillationPipeline = [];

            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                const sourceModelId = i === 0 ? teacher_model_id : `stage_${i-1}`;

                const stageResult = await base44.functions.invoke('knowledgeDistillation', {
                    action: 'distill_knowledge',
                    teacher_model_id: sourceModelId,
                    config: {
                        target_layers: stage.layers,
                        distillation_method: 'progressive',
                        preserve_capabilities: config.preserve_capabilities || []
                    }
                });

                distillationPipeline.push({
                    stage: i + 1,
                    name: stage.name,
                    layers: stage.layers,
                    task_id: stageResult.distillation_task_id
                });
            }

            return Response.json({
                success: true,
                pipeline: distillationPipeline,
                total_stages: stages.length,
                message: 'Progressive distillation pipeline initiated'
            });
        }

        if (action === 'ensemble_distillation') {
            // Distill multiple teacher models into one student
            const { teacher_model_ids, target_layers } = config;

            const ensembleDesign = await base44.integrations.Core.InvokeLLM({
                prompt: `Design a student model that distills knowledge from ${teacher_model_ids.length} teacher models:

Teachers: ${teacher_model_ids.join(', ')}
Target Student Layers: ${target_layers}

Create an architecture that:
1. Captures complementary knowledge from all teachers
2. Resolves conflicts between different teacher predictions
3. Optimizes for inference efficiency
4. Maintains diversity of expertise

Return ensemble distillation strategy and student architecture.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        student_architecture: { type: "object" },
                        ensemble_strategy: {
                            type: "object",
                            properties: {
                                teacher_weights: { type: "array", items: { type: "number" } },
                                knowledge_fusion_method: { type: "string" },
                                conflict_resolution: { type: "string" }
                            }
                        },
                        expected_capabilities: { type: "array", items: { type: "string" } }
                    }
                }
            });

            return Response.json({
                success: true,
                ensemble_student: ensembleDesign,
                teacher_count: teacher_model_ids.length,
                message: 'Ensemble distillation strategy generated'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Knowledge distillation error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});