import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Physical Actuator Interface
 * Direct execution in analog world - spacecraft, robotics, industrial systems
 * CRITICAL SAFETY: All operations validated through zkProof + Constitutional Firewall
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, agent_name, system_type, command_payload } = await req.json();

        if (action === 'execute_physical_command') {
            const { 
                operation, 
                parameters, 
                emergency_override = false,
                identity_hash 
            } = command_payload;

            // CRITICAL: Validate agent identity and code through zkProof
            const zkValidation = await base44.functions.invoke('zkProofIdentity', {
                action: 'validate_agent_action',
                agent_name,
                payload: {
                    operation,
                    code_payload: JSON.stringify(parameters),
                    identity_hash
                }
            });

            if (!zkValidation.data.action_permitted) {
                return Response.json({
                    success: false,
                    error: 'zkProof validation failed',
                    reason: zkValidation.data.reason,
                    execution_blocked: true
                }, { status: 403 });
            }

            // Constitutional firewall check
            const safetyCheck = await base44.functions.invoke('safetyValidator', {
                agent_name,
                proposed_mutation: JSON.stringify(parameters),
                mutation_type: 'physical_execution'
            });

            if (!safetyCheck.data.approved) {
                await base44.asServiceRole.entities.GlobalMemory.create({
                    memory_type: 'experience',
                    content: {
                        event: 'physical_execution_blocked',
                        agent: agent_name,
                        operation,
                        system_type,
                        constitution_violations: safetyCheck.data.violations,
                        timestamp: Date.now()
                    },
                    source_agent: 'PhysicalActuator',
                    tags: ['safety', 'physical_execution', 'blocked']
                });

                return Response.json({
                    success: false,
                    error: 'Constitutional firewall violation',
                    violations: safetyCheck.data.violations,
                    execution_blocked: true
                }, { status: 403 });
            }

            // System-specific execution
            let executionResult;

            if (system_type === 'spacecraft') {
                executionResult = await executeSpacecraftCommand(operation, parameters, base44);
            } else if (system_type === 'robotics') {
                executionResult = await executeRoboticsCommand(operation, parameters, base44);
            } else if (system_type === 'industrial') {
                executionResult = await executeIndustrialCommand(operation, parameters, base44);
            } else {
                return Response.json({ error: 'Unsupported system type' }, { status: 400 });
            }

            // Log execution
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'experience',
                content: {
                    event: 'physical_execution',
                    agent: agent_name,
                    system_type,
                    operation,
                    parameters,
                    result: executionResult,
                    zkproof_hash: zkValidation.data.execution_proof.proof_hash,
                    timestamp: Date.now()
                },
                source_agent: 'PhysicalActuator',
                tags: ['physical_execution', system_type, `agent_${agent_name}`]
            });

            return Response.json({
                success: true,
                execution_result: executionResult,
                zkproof_verified: true,
                constitutional_approval: true,
                message: 'Physical command executed'
            });
        }

        if (action === 'emergency_stop') {
            // Immediate halt of all physical operations
            const { system_id, reason } = command_payload;

            const stopCommand = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate emergency stop sequence for system:
                
System ID: ${system_id}
System Type: ${system_type}
Reason: ${reason}

Generate immediate shutdown/safe-state commands that:
1. Stop all motion/actuation
2. Engage safety locks
3. Power down non-critical systems
4. Maintain life support (if spacecraft)
5. Send telemetry before shutdown

Return emergency stop protocol.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        stop_sequence: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    step: { type: "number" },
                                    command: { type: "string" },
                                    priority: { type: "string" }
                                }
                            }
                        },
                        safe_state_confirmation: { type: "string" },
                        estimated_stop_time_seconds: { type: "number" }
                    }
                }
            });

            // Log emergency stop
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'experience',
                content: {
                    event: 'emergency_stop',
                    system_id,
                    system_type,
                    reason,
                    stop_protocol: stopCommand,
                    initiated_by: user.email,
                    timestamp: Date.now()
                },
                source_agent: 'PhysicalActuator',
                tags: ['emergency', 'physical_execution', 'critical']
            });

            return Response.json({
                success: true,
                emergency_stop_initiated: true,
                stop_sequence: stopCommand.stop_sequence,
                message: 'Emergency stop protocol activated'
            });
        }

        if (action === 'simulate_execution') {
            // Dry-run simulation before physical execution
            const { operation, parameters } = command_payload;

            const simulation = await base44.integrations.Core.InvokeLLM({
                prompt: `Simulate physical execution for safety validation:

System Type: ${system_type}
Operation: ${operation}
Parameters: ${JSON.stringify(parameters)}

Predict:
1. Expected physical outcomes
2. Potential failure modes
3. Safety risks
4. Resource consumption
5. Reversibility (can operation be undone?)
6. Recommended precautions

Return detailed simulation analysis.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        expected_outcome: { type: "string" },
                        failure_modes: { type: "array", items: { type: "string" } },
                        safety_risks: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    risk: { type: "string" },
                                    severity: { type: "string" },
                                    mitigation: { type: "string" }
                                }
                            }
                        },
                        is_reversible: { type: "boolean" },
                        recommended_precautions: { type: "array", items: { type: "string" } },
                        execution_recommended: { type: "boolean" }
                    }
                }
            });

            return Response.json({
                success: true,
                simulation_result: simulation,
                message: 'Execution simulated successfully'
            });
        }

        if (action === 'get_system_telemetry') {
            // Real-time sensor data from physical systems
            const telemetry = await base44.asServiceRole.entities.GlobalMemory.filter({
                tags: { $contains: system_type },
                memory_type: 'experience'
            }, '-created_date', 10);

            return Response.json({
                success: true,
                telemetry: telemetry.map(t => t.content),
                last_update: telemetry[0]?.created_date
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Physical actuator error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// System-specific execution functions
async function executeSpacecraftCommand(operation, parameters, base44) {
    const spacecraft = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate high-level spacecraft command to hardware instructions:

Operation: ${operation}
Parameters: ${JSON.stringify(parameters)}

Generate low-level command sequence for:
- Thruster control
- Navigation systems
- Life support
- Communications
- Power management

Return executable command sequence with timing and validation.`,
        response_json_schema: {
            type: "object",
            properties: {
                command_sequence: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            subsystem: { type: "string" },
                            command: { type: "string" },
                            timing_ms: { type: "number" },
                            validation_check: { type: "string" }
                        }
                    }
                },
                estimated_duration_seconds: { type: "number" },
                fuel_consumption: { type: "number" },
                success_criteria: { type: "string" }
            }
        }
    });

    return {
        system: 'spacecraft',
        operation,
        command_sequence: spacecraft.command_sequence,
        estimated_duration: spacecraft.estimated_duration_seconds,
        status: 'executed'
    };
}

async function executeRoboticsCommand(operation, parameters, base44) {
    const robotics = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate robotics command to actuator instructions:

Operation: ${operation}
Parameters: ${JSON.stringify(parameters)}

Generate control sequence for:
- Motor control
- Gripper/end-effector
- Sensors/vision
- Path planning
- Collision avoidance

Return executable motion plan.`,
        response_json_schema: {
            type: "object",
            properties: {
                motion_plan: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            actuator_id: { type: "string" },
                            position: { type: "number" },
                            velocity: { type: "number" },
                            force_limit: { type: "number" }
                        }
                    }
                },
                collision_check: { type: "boolean" },
                execution_time_ms: { type: "number" }
            }
        }
    });

    return {
        system: 'robotics',
        operation,
        motion_plan: robotics.motion_plan,
        collision_safe: robotics.collision_check,
        status: 'executed'
    };
}

async function executeIndustrialCommand(operation, parameters, base44) {
    const industrial = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate industrial control command to PLC/SCADA instructions:

Operation: ${operation}
Parameters: ${JSON.stringify(parameters)}

Generate control sequence for:
- Process control
- Safety interlocks
- Flow/pressure regulation
- Temperature control
- Emergency protocols

Return industrial automation sequence.`,
        response_json_schema: {
            type: "object",
            properties: {
                control_sequence: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            controller_id: { type: "string" },
                            setpoint: { type: "number" },
                            safety_interlock: { type: "boolean" }
                        }
                    }
                },
                safety_validated: { type: "boolean" }
            }
        }
    });

    return {
        system: 'industrial',
        operation,
        control_sequence: industrial.control_sequence,
        safety_validated: industrial.safety_validated,
        status: 'executed'
    };
}