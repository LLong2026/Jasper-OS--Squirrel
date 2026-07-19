import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * IoT Device Controller
 * Interacts with and controls IoT devices
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'control_device') {
            const { device_id, command, parameters } = payload;

            const device = await base44.asServiceRole.entities.IoTDevice.filter({ device_id })[0];
            
            if (!device) {
                return Response.json({ error: 'Device not found' }, { status: 404 });
            }

            // Execute command based on device protocol
            let result;
            if (device.protocol === 'http') {
                result = await controlViaHTTP(device, command, parameters);
            } else if (device.protocol === 'mqtt') {
                result = await controlViaMQTT(device, command, parameters);
            } else {
                return Response.json({
                    error: `Protocol ${device.protocol} not yet supported`
                }, { status: 400 });
            }

            // Update device state
            await base44.asServiceRole.entities.IoTDevice.update(device.id, {
                current_state: result.new_state,
                last_seen: Date.now()
            });

            return Response.json({
                success: true,
                device_id,
                command_executed: command,
                result
            });
        }

        if (action === 'get_device_state') {
            const { device_id } = payload;

            const device = await base44.asServiceRole.entities.IoTDevice.filter({ device_id })[0];
            
            if (!device) {
                return Response.json({ error: 'Device not found' }, { status: 404 });
            }

            // Query current state
            let state;
            if (device.protocol === 'http') {
                state = await queryStateHTTP(device);
            }

            // Update stored state
            await base44.asServiceRole.entities.IoTDevice.update(device.id, {
                current_state: state,
                last_seen: Date.now()
            });

            return Response.json({
                success: true,
                device_id,
                state
            });
        }

        if (action === 'smart_control') {
            // Use reasoning to determine how to control device
            const { device_id, natural_language_command } = payload;

            const device = await base44.asServiceRole.entities.IoTDevice.filter({ device_id })[0];
            
            if (!device) {
                return Response.json({ error: 'Device not found' }, { status: 404 });
            }

            // Use reasoning to translate natural language to device command
            const reasoning = await base44.functions.invoke('reasoningEngine', {
                action: 'multi_hop_reasoning',
                agent_name: 'Wednesday',
                payload: {
                    query: `How do I execute this command on the device?
                    
Device: ${device.device_name} (${device.device_type})
Capabilities: ${device.capabilities.join(', ')}
Current State: ${JSON.stringify(device.current_state)}
Command: ${natural_language_command}

What specific API call or command should be executed?`,
                    max_hops: 3
                }
            });

            // Parse the reasoned command
            const commandPlan = await base44.integrations.Core.InvokeLLM({
                prompt: `Based on this reasoning, generate the exact API call:

${reasoning.data.final_conclusion}

Device API: ${device.api_endpoint}
Protocol: ${device.protocol}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        method: { type: "string" },
                        endpoint: { type: "string" },
                        payload: { type: "object", additionalProperties: true },
                        expected_result: { type: "string" }
                    }
                }
            });

            // Execute the command
            const result = await base44.functions.invoke('iotController', {
                action: 'control_device',
                payload: {
                    device_id,
                    command: commandPlan.method,
                    parameters: commandPlan.payload
                }
            });

            return Response.json({
                success: true,
                natural_command: natural_language_command,
                reasoning_chain: reasoning.data.chain_id,
                executed_command: commandPlan,
                result: result.data
            });
        }

        if (action === 'create_automation') {
            const { trigger, conditions, actions } = payload;

            // Store automation rule
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'system_state',
                content: {
                    automation_type: 'iot_automation',
                    trigger,
                    conditions,
                    actions,
                    created_at: Date.now(),
                    is_active: true
                },
                source_agent: 'Wednesday',
                tags: ['iot', 'automation']
            });

            return Response.json({
                success: true,
                message: 'IoT automation created'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('IoT controller error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function controlViaHTTP(device, command, parameters) {
    try {
        const url = `${device.api_endpoint}${command}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parameters),
            signal: AbortSignal.timeout(5000)
        });

        const result = await response.json();

        return {
            success: true,
            new_state: result,
            response_code: response.status
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function controlViaMQTT(device, command, parameters) {
    // MQTT control
    // In production, use MQTT client library
    return {
        success: false,
        error: 'MQTT not yet implemented'
    };
}

async function queryStateHTTP(device) {
    try {
        const response = await fetch(device.api_endpoint, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        return await response.json();
    } catch (error) {
        return { error: error.message, offline: true };
    }
}