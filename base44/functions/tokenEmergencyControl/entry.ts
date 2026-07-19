import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Token Emergency Control
 * Circuit breakers, emergency pause, and rollback mechanisms
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'trigger_circuit_breaker') {
            const { token_id, reason, trigger_type = 'MANUAL' } = payload;

            // Set emergency pause
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'emergency_state',
                content: {
                    token_id,
                    state: 'PAUSED',
                    reason,
                    trigger_type,
                    triggered_by: user.email,
                    triggered_at: Date.now(),
                    auto_resume_at: null
                },
                source_agent: 'TokenEmergencyControl',
                confidence_score: 1.0,
                tags: ['tokenomics', 'emergency', token_id, 'PAUSED']
            });

            // Stop all automated operations
            await base44.functions.invoke('tokenPolicyEngine', {
                action: 'pause_automation',
                payload: { token_id }
            });

            // Notify all stakeholders
            await base44.integrations.Core.SendEmail({
                to: user.email,
                subject: `EMERGENCY: Token ${token_id} Circuit Breaker Activated`,
                body: `Circuit breaker activated for token ${token_id}\n\nReason: ${reason}\nTrigger: ${trigger_type}\nTime: ${new Date().toISOString()}\n\nAll automated operations have been halted.`
            });

            return Response.json({
                success: true,
                state: 'PAUSED',
                message: 'Circuit breaker activated. All operations halted.',
                triggered_at: Date.now()
            });
        }

        if (action === 'resume_operations') {
            const { token_id, confirmation_code } = payload;

            // Verify confirmation
            if (!confirmation_code || confirmation_code !== `RESUME-${token_id.substring(0, 8).toUpperCase()}`) {
                return Response.json({
                    error: 'Invalid confirmation code',
                    required_format: `RESUME-${token_id.substring(0, 8).toUpperCase()}`
                }, { status: 400 });
            }

            // Check if paused
            const emergencyStates = await base44.asServiceRole.entities.GlobalMemory.filter({
                tags: { $contains: token_id },
                memory_type: 'emergency_state'
            }, '-created_date', 1);

            if (emergencyStates.length === 0 || emergencyStates[0].content.state !== 'PAUSED') {
                return Response.json({
                    error: 'Token is not in paused state'
                }, { status: 400 });
            }

            // Resume operations
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'emergency_state',
                content: {
                    token_id,
                    state: 'ACTIVE',
                    resumed_by: user.email,
                    resumed_at: Date.now(),
                    previous_pause: emergencyStates[0].content
                },
                source_agent: 'TokenEmergencyControl',
                confidence_score: 1.0,
                tags: ['tokenomics', 'emergency', token_id, 'RESUMED']
            });

            // Restart automated operations
            await base44.functions.invoke('tokenPolicyEngine', {
                action: 'resume_automation',
                payload: { token_id }
            });

            return Response.json({
                success: true,
                state: 'ACTIVE',
                message: 'Operations resumed',
                resumed_at: Date.now()
            });
        }

        if (action === 'rollback_to_checkpoint') {
            const { token_id, checkpoint_timestamp } = payload;

            // Find checkpoint state
            const checkpoints = await base44.asServiceRole.entities.GlobalMemory.filter({
                tags: { $contains: token_id },
                memory_type: 'token_state'
            }, '-created_date', 100);

            const targetCheckpoint = checkpoints.find(c => 
                c.created_date && new Date(c.created_date).getTime() <= checkpoint_timestamp
            );

            if (!targetCheckpoint) {
                return Response.json({
                    error: 'Checkpoint not found',
                    available_checkpoints: checkpoints.slice(0, 10).map(c => ({
                        timestamp: new Date(c.created_date).getTime(),
                        state: c.content
                    }))
                }, { status: 404 });
            }

            // Restore state
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'token_state',
                content: {
                    ...targetCheckpoint.content,
                    restored_from: checkpoint_timestamp,
                    restored_at: Date.now(),
                    restored_by: user.email
                },
                source_agent: 'TokenEmergencyControl',
                confidence_score: 1.0,
                tags: ['tokenomics', 'state', token_id, 'ROLLBACK']
            });

            // Log rollback in audit trail
            await base44.functions.invoke('tokenAuditAnchoring', {
                action: 'log_action',
                payload: {
                    token_id,
                    action_type: 'ROLLBACK',
                    params: { checkpoint_timestamp },
                    result: { success: true, restored_state: targetCheckpoint.content },
                    approved_by: user.email,
                    timestamp: Date.now()
                }
            });

            return Response.json({
                success: true,
                message: 'State rolled back to checkpoint',
                checkpoint_timestamp,
                restored_state: targetCheckpoint.content
            });
        }

        if (action === 'check_anomalies') {
            const { token_id } = payload;

            const anomalies = await detectAnomalies(token_id, base44);

            // Auto-trigger circuit breaker if critical anomaly detected
            if (anomalies.some(a => a.severity === 'CRITICAL')) {
                await base44.functions.invoke('tokenEmergencyControl', {
                    action: 'trigger_circuit_breaker',
                    payload: {
                        token_id,
                        reason: `Critical anomaly detected: ${anomalies.find(a => a.severity === 'CRITICAL').description}`,
                        trigger_type: 'AUTOMATIC'
                    }
                });
            }

            return Response.json({
                success: true,
                anomalies,
                circuit_breaker_triggered: anomalies.some(a => a.severity === 'CRITICAL')
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Token Emergency Control error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function detectAnomalies(token_id, base44) {
    const anomalies = [];

    // Check recent state changes
    const recentStates = await base44.asServiceRole.entities.GlobalMemory.filter({
        tags: { $contains: token_id },
        memory_type: 'token_state'
    }, '-created_date', 10);

    if (recentStates.length >= 2) {
        const current = recentStates[0].content;
        const previous = recentStates[1].content;

        // Check for unexpected supply change
        const supplyChange = Math.abs(current.circulating_supply - previous.circulating_supply);
        const supplyChangePercent = (supplyChange / previous.circulating_supply) * 100;

        if (supplyChangePercent > 10) {
            anomalies.push({
                type: 'SUPPLY_SPIKE',
                severity: supplyChangePercent > 50 ? 'CRITICAL' : 'HIGH',
                description: `Supply changed by ${supplyChangePercent.toFixed(2)}% in short period`,
                current_supply: current.circulating_supply,
                previous_supply: previous.circulating_supply
            });
        }

        // Check for excessive minting
        const mintRate = (current.minted - previous.minted) / (current.circulating_supply || 1);
        if (mintRate > 0.05) {
            anomalies.push({
                type: 'EXCESSIVE_MINTING',
                severity: 'HIGH',
                description: 'Mint rate exceeds 5% of circulating supply',
                mint_rate: mintRate
            });
        }

        // Check for burn anomalies
        const burnRate = (current.burned - previous.burned) / (current.circulating_supply || 1);
        if (burnRate > 0.1) {
            anomalies.push({
                type: 'EXCESSIVE_BURNING',
                severity: 'MEDIUM',
                description: 'Burn rate exceeds 10% of circulating supply',
                burn_rate: burnRate
            });
        }
    }

    // Check recent actions for suspicious patterns
    const recentActions = await base44.asServiceRole.entities.GlobalMemory.filter({
        tags: { $contains: token_id },
        memory_type: 'audit_log'
    }, '-created_date', 50);

    const mintActions = recentActions.filter(a => a.content.action_type === 'mint');
    if (mintActions.length > 20) {
        anomalies.push({
            type: 'HIGH_FREQUENCY_MINTING',
            severity: 'MEDIUM',
            description: 'Unusually high number of mint operations',
            count: mintActions.length
        });
    }

    return anomalies;
}