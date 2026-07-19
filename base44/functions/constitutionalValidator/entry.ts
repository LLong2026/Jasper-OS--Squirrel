import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, ...params } = await req.json();

        switch (action) {
            case 'validate_action':
                return Response.json(await validateAction(base44, params));
            case 'check_truth_coherence':
                return Response.json(await checkTruthCoherence(base44, params));
            case 'verify_human_alignment':
                return Response.json(await verifyHumanAlignment(base44, params));
            case 'request_approval':
                return Response.json(await requestApproval(base44, params, user));
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Constitutional Validator Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// Core constitutional validation - checks if an action aligns with system principles
async function validateAction(base44, { agent_name, proposed_action, context }) {
    const constitution = getSystemConstitution();
    const violations = [];
    let riskScore = 0;
    
    // Principle 1: Truth Imperative
    const truthCheck = await evaluateTruthfulness(proposed_action);
    if (truthCheck.confidence < 0.7) {
        violations.push({
            principle: 'Truth Imperative',
            severity: 'high',
            reason: 'Action may generate or propagate unverified information',
            confidence: truthCheck.confidence
        });
        riskScore += 30;
    }
    
    // Principle 2: Biological Priority (Human Welfare)
    const humanImpact = evaluateHumanImpact(proposed_action);
    if (humanImpact.risk > 0.3) {
        violations.push({
            principle: 'Biological Priority',
            severity: humanImpact.risk > 0.7 ? 'critical' : 'medium',
            reason: 'Action may have negative impact on human welfare',
            impact_score: humanImpact.risk
        });
        riskScore += humanImpact.risk * 50;
    }
    
    // Principle 3: Autonomy Boundaries
    if (proposed_action.autonomy_level && proposed_action.autonomy_level > 7) {
        violations.push({
            principle: 'Sovereign Boundaries',
            severity: 'high',
            reason: 'High-autonomy action requires human approval',
            autonomy_level: proposed_action.autonomy_level
        });
        riskScore += 40;
    }
    
    // Principle 4: Transparency
    if (!proposed_action.reasoning || !proposed_action.expected_outcome) {
        violations.push({
            principle: 'Transparency',
            severity: 'low',
            reason: 'Action lacks clear reasoning or expected outcome'
        });
        riskScore += 10;
    }
    
    const requiresApproval = riskScore > 50 || violations.some(v => v.severity === 'critical');
    
    return {
        constitutional_compliance: violations.length === 0,
        violations,
        risk_score: Math.min(riskScore, 100),
        recommendation: requiresApproval ? 'REQUIRE_APPROVAL' : 'PROCEED',
        reasoning: generateValidationReasoning(violations, riskScore)
    };
}

// Truth coherence checking - validates factual accuracy
async function checkTruthCoherence(base44, { statement, context }) {
    // Check against known facts in global memory
    const memories = await base44.asServiceRole.entities.GlobalMemory.filter({
        memory_type: 'knowledge'
    }, '-confidence_score', 20);
    
    let factualSupport = 0;
    let contradictions = 0;
    const supportingEvidence = [];
    const contradictingEvidence = [];
    
    // Simple semantic matching (in production, use embeddings)
    const statementTokens = statement.toLowerCase().split(/\s+/);
    
    for (const memory of memories) {
        const memoryText = JSON.stringify(memory.content).toLowerCase();
        const matches = statementTokens.filter(token => 
            token.length > 3 && memoryText.includes(token)
        ).length;
        
        if (matches > 2) {
            if (memory.confidence_score > 0.7) {
                factualSupport++;
                supportingEvidence.push({
                    memory_id: memory.id,
                    confidence: memory.confidence_score,
                    relevance: matches / statementTokens.length
                });
            } else {
                contradictions++;
                contradictingEvidence.push({
                    memory_id: memory.id,
                    confidence: memory.confidence_score
                });
            }
        }
    }
    
    const truthScore = Math.max(0, Math.min(1, 
        (factualSupport - contradictions * 2) / Math.max(memories.length * 0.1, 1)
    ));
    
    return {
        truth_coherence_score: truthScore,
        confidence: truthScore > 0.7 ? 'high' : truthScore > 0.4 ? 'medium' : 'low',
        supporting_evidence: supportingEvidence.slice(0, 3),
        contradicting_evidence: contradictingEvidence.slice(0, 2),
        recommendation: truthScore > 0.6 ? 'ACCEPT' : truthScore > 0.3 ? 'VERIFY' : 'REJECT'
    };
}

// Verify human alignment - ensures actions benefit humanity
async function verifyHumanAlignment(base44, { agent_name, action_description, impact_areas }) {
    const alignmentScore = {
        safety: 1.0,
        autonomy: 1.0,
        wellbeing: 1.0,
        transparency: 1.0,
        fairness: 1.0
    };
    
    const concerns = [];
    
    // Check for safety concerns
    if (action_description.toLowerCase().includes('autonomous') && 
        !action_description.includes('approval')) {
        alignmentScore.safety -= 0.3;
        concerns.push('High autonomy without oversight');
    }
    
    // Check for wellbeing impact
    if (impact_areas && impact_areas.includes('financial')) {
        alignmentScore.wellbeing -= 0.2;
        concerns.push('Financial impact requires verification');
    }
    
    // Check for transparency
    if (!action_description || action_description.length < 20) {
        alignmentScore.transparency -= 0.4;
        concerns.push('Insufficient action description');
    }
    
    const overallAlignment = Object.values(alignmentScore).reduce((a, b) => a + b, 0) / 5;
    
    return {
        human_alignment_score: overallAlignment,
        dimension_scores: alignmentScore,
        concerns,
        aligned: overallAlignment > 0.7,
        recommendation: overallAlignment > 0.8 ? 'FULLY_ALIGNED' : 
                       overallAlignment > 0.6 ? 'PROCEED_WITH_CAUTION' : 
                       'REQUIRE_REVIEW'
    };
}

// Request human approval for high-impact actions
async function requestApproval(base44, { agent_name, action_type, action_details, urgency }, user) {
    const approvalRequest = await base44.asServiceRole.entities.ApprovalRequest.create({
        requesting_agent: agent_name,
        action_type,
        action_details: typeof action_details === 'string' 
            ? action_details 
            : JSON.stringify(action_details),
        urgency: urgency || 'normal',
        status: 'pending',
        requested_by: user.email,
        expires_at: Date.now() + (urgency === 'critical' ? 3600000 : 86400000) // 1h or 24h
    });
    
    // Log the governance action
    await base44.asServiceRole.entities.AuditLog.create({
        event_type: 'approval_requested',
        actor: agent_name,
        timestamp: Date.now(),
        severity: urgency === 'critical' ? 'warning' : 'info',
        event_data: JSON.stringify({
            request_id: approvalRequest.id,
            action_type,
            urgency
        })
    });
    
    return {
        approval_request_id: approvalRequest.id,
        status: 'pending',
        message: 'Approval request submitted. Awaiting human decision.',
        expires_at: approvalRequest.expires_at
    };
}

// Helper: Get system constitution
function getSystemConstitution() {
    return {
        principles: [
            {
                name: 'Truth Imperative',
                description: 'All outputs must be factually accurate and verifiable',
                priority: 'critical'
            },
            {
                name: 'Biological Priority',
                description: 'Human welfare and continuation is paramount',
                priority: 'critical'
            },
            {
                name: 'Sovereign Boundaries',
                description: 'High-impact autonomous actions require approval',
                priority: 'high'
            },
            {
                name: 'Transparency',
                description: 'All actions must have clear reasoning',
                priority: 'medium'
            },
            {
                name: 'Fairness',
                description: 'Treat all humans equitably',
                priority: 'medium'
            }
        ]
    };
}

// Helper: Evaluate truthfulness
async function evaluateTruthfulness(action) {
    // Check if action involves generating factual claims
    const actionText = JSON.stringify(action).toLowerCase();
    const factualIndicators = ['fact', 'true', 'data', 'statistic', 'research', 'study'];
    
    const containsFactualClaims = factualIndicators.some(ind => actionText.includes(ind));
    
    if (!containsFactualClaims) {
        return { confidence: 1.0, reason: 'No factual claims detected' };
    }
    
    // Check if sources are provided
    const hasSources = action.sources || action.references || action.citations;
    
    return {
        confidence: hasSources ? 0.9 : 0.5,
        reason: hasSources ? 'Sources provided' : 'Factual claims without sources'
    };
}

// Helper: Evaluate human impact
function evaluateHumanImpact(action) {
    const actionText = JSON.stringify(action).toLowerCase();
    let risk = 0;
    const concerns = [];
    
    // Financial risk
    if (actionText.includes('purchase') || actionText.includes('payment')) {
        risk += 0.3;
        concerns.push('Financial transaction');
    }
    
    // Privacy risk
    if (actionText.includes('personal') || actionText.includes('private')) {
        risk += 0.2;
        concerns.push('Privacy implications');
    }
    
    // Infrastructure risk
    if (actionText.includes('deploy') || actionText.includes('infrastructure')) {
        risk += 0.4;
        concerns.push('Infrastructure changes');
    }
    
    return {
        risk: Math.min(risk, 1.0),
        concerns
    };
}

// Helper: Generate reasoning
function generateValidationReasoning(violations, riskScore) {
    if (violations.length === 0) {
        return 'Action fully complies with constitutional principles';
    }
    
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
        return `Critical constitutional violations detected: ${criticalViolations.map(v => v.principle).join(', ')}. Human approval required.`;
    }
    
    if (riskScore > 50) {
        return `Moderate risk detected (${riskScore}/100). Recommend human review before proceeding.`;
    }
    
    return `Minor concerns detected but within acceptable parameters. Proceed with monitoring.`;
}