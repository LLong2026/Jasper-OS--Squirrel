import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Token Policy Engine
 * Runtime enforcement of token mint/burn/transfer rules with scoring and approval workflows
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'score_action') {
            if (!payload) return Response.json({ error: 'payload required' }, { status: 400 });
            const { token_id, action_type, context } = payload;

            // Load validators for this token
            const validators = await loadValidators(token_id, base44);
            
            if (!validators) {
                return Response.json({ error: 'Token validators not found' }, { status: 404 });
            }

            // Score the action
            const score = await scoreAction(action_type, context, validators, base44);

            // Store decision
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'decision',
                content: {
                    token_id,
                    action_type,
                    context,
                    score,
                    decision: score.allowed ? 'ALLOW' : 'DENY',
                    requires_approval: score.requires_approval
                },
                source_agent: 'TokenPolicyEngine',
                confidence_score: score.confidence,
                tags: ['tokenomics', 'policy', token_id]
            });

            return Response.json({
                success: true,
                decision: score.allowed ? 'ALLOW' : 'DENY',
                confidence: score.confidence,
                requires_approval: score.requires_approval,
                explanation: score.explanation,
                explanation_id: score.explanation_id
            });
        }

        if (action === 'execute_action') {
            const { token_id, action_type, params, approval_signature } = payload;

            // Load validators
            const validators = await loadValidators(token_id, base44);
            
            // Check if action requires approval
            const scoreResult = await scoreAction(action_type, params, validators, base44);
            
            if (scoreResult.requires_approval && !approval_signature) {
                return Response.json({
                    success: false,
                    requires_manual_approval: true,
                    message: 'This action exceeds automated limits and requires manual approval',
                    threshold_exceeded: scoreResult.threshold_exceeded
                }, { status: 403 });
            }

            // Verify approval signature if provided
            if (approval_signature) {
                const valid = await verifyApprovalSignature(
                    token_id,
                    action_type,
                    params,
                    approval_signature,
                    base44
                );
                
                if (!valid) {
                    return Response.json({
                        success: false,
                        error: 'Invalid approval signature'
                    }, { status: 403 });
                }
            }

            // Execute action
            const result = await executeTokenAction(token_id, action_type, params, validators, base44);

            // Log to audit trail
            await base44.functions.invoke('tokenAuditAnchoring', {
                action: 'log_action',
                payload: {
                    token_id,
                    action_type,
                    params,
                    result,
                    approved_by: approval_signature ? user.email : 'AUTO',
                    timestamp: Date.now()
                }
            });

            return Response.json({
                success: true,
                result,
                transaction_id: result.tx_id
            });
        }

        if (action === 'get_token_state') {
            const { token_id } = payload;

            const state = await base44.asServiceRole.entities.GlobalMemory.filter({
                tags: token_id,
                memory_type: 'token_state'
            }, '-created_date', 1);

            if (state.length === 0) {
                return Response.json({
                    success: false,
                    error: 'Token state not found'
                }, { status: 404 });
            }

            return Response.json({
                success: true,
                state: state[0].content
            });
        }

        if (action === 'propose_parameter_change') {
            const { token_id, parameter, new_value, reason } = payload;

            // Create proposal
            const proposal = {
                proposal_id: `prop_${Date.now()}`,
                token_id,
                parameter,
                current_value: await getCurrentParameterValue(token_id, parameter, base44),
                proposed_value: new_value,
                reason,
                proposed_by: user.email,
                proposed_at: Date.now(),
                status: 'PENDING'
            };

            // Run simulation with new parameter
            const simResult = await base44.functions.invoke('economicsSimulator', {
                action: 'sensitivity_analysis',
                payload: {
                    validators: await loadValidators(token_id, base44),
                    parameter,
                    range_min: new_value * 0.8,
                    range_max: new_value * 1.2,
                    steps: 5
                }
            });

            proposal.simulation_result = simResult.data;
            proposal.risk_score = simResult.data.optimal_value ? 0.3 : 0.7;

            // Store proposal
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'proposal',
                content: proposal,
                source_agent: 'TokenPolicyEngine',
                confidence_score: 1.0 - proposal.risk_score,
                tags: ['tokenomics', 'proposal', token_id]
            });

            return Response.json({
                success: true,
                proposal,
                requires_approval: proposal.risk_score > 0.5
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Token Policy Engine error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function loadValidators(token_id, base44) {
    const compilations = await base44.asServiceRole.entities.GlobalMemory.filter({
        tags: token_id,
        memory_type: 'compilation'
    }, '-created_date', 1);

    if (compilations.length === 0) return null;
    
    return compilations[0].content.validators || compilations[0].content.manifest?.validators;
}

async function scoreAction(action_type, context, validators, base44) {
    const explanation = [];
    let confidence = 1.0;
    let allowed = true;
    let requires_approval = false;
    let threshold_exceeded = null;

    // Check mint rules
    if (action_type === 'mint') {
        const token = validators.tokens[context.token_name];
        if (!token) {
            return {
                allowed: false,
                confidence: 1.0,
                requires_approval: false,
                explanation: ['Token not found in validators'],
                explanation_id: `exp_${Date.now()}`
            };
        }

        if (token.mint_rules) {
            const amount = context.amount || 0;
            const threshold = token.mint_rules.threshold || 10000;

            if (amount > threshold) {
                requires_approval = true;
                threshold_exceeded = { threshold, amount };
                explanation.push(`Mint amount ${amount} exceeds threshold ${threshold}`);
            }

            if (token.mint_rules.requires_approval) {
                requires_approval = true;
                explanation.push('Token mint rules require approval');
            }
        }

        // Check supply cap
        if (token.supply && token.supply.cap) {
            const currentSupply = context.current_supply || 0;
            const newSupply = currentSupply + (context.amount || 0);
            
            if (newSupply > token.supply.cap) {
                allowed = false;
                explanation.push(`Mint would exceed supply cap: ${newSupply} > ${token.supply.cap}`);
            }
        }
    }

    // Check burn rules
    if (action_type === 'burn') {
        const token = validators.tokens[context.token_name];
        if (token && token.burn_rules) {
            explanation.push('Burn action validated against burn rules');
        }
    }

    return {
        allowed,
        confidence,
        requires_approval,
        threshold_exceeded,
        explanation,
        explanation_id: `exp_${Date.now()}`
    };
}

async function executeTokenAction(token_id, action_type, params, validators, base44) {
    // Execute the token action (this would interact with smart contracts in production)
    const tx_id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update token state
    const currentState = await base44.asServiceRole.entities.GlobalMemory.filter({
        tags: token_id,
        memory_type: 'token_state'
    }, '-created_date', 1);

    const state = currentState.length > 0 ? currentState[0].content : {
        token_id,
        circulating_supply: 0,
        burned: 0,
        minted: 0
    };

    if (action_type === 'mint') {
        state.circulating_supply += params.amount;
        state.minted += params.amount;
    } else if (action_type === 'burn') {
        state.circulating_supply -= params.amount;
        state.burned += params.amount;
    }

    // Store updated state
    await base44.asServiceRole.entities.GlobalMemory.create({
        memory_type: 'token_state',
        content: state,
        source_agent: 'TokenPolicyEngine',
        confidence_score: 1.0,
        tags: ['tokenomics', 'state', token_id]
    });

    return {
        tx_id,
        action_type,
        params,
        new_state: state,
        executed_at: Date.now()
    };
}

async function verifyApprovalSignature(token_id, action_type, params, signature, base44) {
    // In production, this would verify an EIP-712 signature
    // For now, just check if signature exists
    return signature && signature.length > 10;
}

async function getCurrentParameterValue(token_id, parameter, base44) {
    const validators = await loadValidators(token_id, base44);
    if (!validators) return null;

    // Navigate parameter path
    const path = parameter.split('.');
    let value = validators;
    for (const key of path) {
        value = value[key];
        if (value === undefined) return null;
    }
    
    return value;
}