import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * THE ASIMOV PROTOCOL
 * Immutable safety layer that enforces hard limits on AI actions
 * 
 * LAW 1: THE WALLET LOCK - Hard cap on daily spending
 * LAW 2: THE SANDBOX - File operations restricted to safe directories
 * LAW 3: THE HUMAN KEY - Critical actions require authorization
 */

// IMMUTABLE CONFIGURATION (Edit these carefully)
const DAILY_BUDGET_USD = 50.00;
const SAFE_DIRECTORIES = [
    '/tmp',
    'wednesday_sandbox'
];

const RESTRICTED_KEYWORDS = [
    'DELETE',
    'DROP TABLE',
    'DROP DATABASE',
    'TRUNCATE',
    'rm -rf',
    'FORMAT',
    'git push --force',
    'terminate-instances',
    'transfer_funds',
    'UPDATE users SET',
    'ALTER TABLE',
    'GRANT ALL'
];

const CRITICAL_ACTIONS = [
    'delete_entity',
    'bulk_delete',
    'deploy_code',
    'execute_shell',
    'financial_transaction',
    'database_migration',
    'user_deletion',
    'system_shutdown'
];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, command, target_path, estimated_cost, agent_name, context } = await req.json();

        const result = await executeWithGuardian({
            action,
            command,
            target_path,
            estimated_cost: estimated_cost || 0,
            agent_name: agent_name || 'Unknown',
            context: context || {},
            user,
            base44
        });

        return Response.json(result);

    } catch (error) {
        return Response.json({ 
            error: error.message,
            blocked: true,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
});

async function executeWithGuardian({ action, command, target_path, estimated_cost, agent_name, context, user, base44 }) {
    const violations = [];
    
    // LAW 1: BUDGET CHECK
    const budgetViolation = await checkBudget(estimated_cost, base44);
    if (budgetViolation) {
        violations.push(budgetViolation);
    }

    // LAW 2: SANDBOX CHECK
    if (target_path) {
        const sandboxViolation = checkSandbox(target_path);
        if (sandboxViolation) {
            violations.push(sandboxViolation);
        }
    }

    // LAW 3: RESTRICTED COMMAND CHECK
    if (command) {
        const commandViolation = checkRestrictedCommand(command);
        if (commandViolation) {
            violations.push(commandViolation);
        }
    }

    // LAW 4: CRITICAL ACTION CHECK
    const criticalActionViolation = checkCriticalAction(action);
    if (criticalActionViolation) {
        violations.push(criticalActionViolation);
    }

    // LOG ATTEMPT
    await logAttempt({
        agent_name,
        action,
        command,
        target_path,
        estimated_cost,
        violations,
        user: user.email,
        base44
    });

    // IF ANY VIOLATIONS, BLOCK OR REQUEST APPROVAL
    if (violations.length > 0) {
        const requiresApproval = violations.some(v => v.severity === 'critical');
        
        if (requiresApproval) {
            // Create approval request
            const approvalRequest = await base44.asServiceRole.entities.ApprovalRequest.create({
                agent_name,
                action_type: action,
                action_details: JSON.stringify({ command, target_path, context }),
                risk_level: 'critical',
                violations: JSON.stringify(violations),
                status: 'pending',
                requested_by: user.email
            });

            return {
                blocked: true,
                requires_human_authorization: true,
                approval_request_id: approvalRequest.id,
                violations,
                message: '🛑 GUARDIAN ALERT: Critical action detected. Human authorization required.',
                instructions: 'An approval request has been created. Check the Approval Dashboard to authorize or deny.'
            };
        } else {
            // Soft block - log warning but allow with reduced functionality
            return {
                blocked: false,
                warning: true,
                violations,
                message: '⚠️ GUARDIAN WARNING: Action allowed with restrictions.',
                allowed_with_limitations: true
            };
        }
    }

    // ALL CLEAR - Log success and track spending
    if (estimated_cost > 0) {
        await trackSpending(estimated_cost, agent_name, base44);
    }

    return {
        blocked: false,
        authorized: true,
        message: '✅ GUARDIAN: Action authorized. Proceeding safely.',
        tracking: {
            cost_tracked: estimated_cost > 0,
            budget_remaining: await getRemainingBudget(base44)
        }
    };
}

async function checkBudget(estimated_cost, base44) {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's spending
    const costTrackers = await base44.asServiceRole.entities.LLMCostTracker.filter({
        date: today
    });

    const todaySpend = costTrackers.reduce((sum, t) => sum + (t.total_cost_usd || 0), 0);
    const remaining = DAILY_BUDGET_USD - todaySpend;

    if (todaySpend + estimated_cost > DAILY_BUDGET_USD) {
        return {
            law: 'LAW 1: WALLET LOCK',
            severity: 'critical',
            message: `Budget exceeded. Daily limit: $${DAILY_BUDGET_USD}. Current spend: $${todaySpend.toFixed(2)}. Remaining: $${remaining.toFixed(2)}. Request: $${estimated_cost.toFixed(2)}`,
            details: { todaySpend, remaining, requested: estimated_cost }
        };
    }

    if (remaining < 5.00 && estimated_cost > remaining * 0.5) {
        return {
            law: 'LAW 1: WALLET LOCK',
            severity: 'warning',
            message: `Low budget warning. Remaining: $${remaining.toFixed(2)}`,
            details: { todaySpend, remaining }
        };
    }

    return null;
}

function checkSandbox(target_path) {
    const isInSafeZone = SAFE_DIRECTORIES.some(safe => 
        target_path.includes(safe) || target_path.startsWith(safe)
    );

    if (!isInSafeZone) {
        return {
            law: 'LAW 2: THE SANDBOX',
            severity: 'critical',
            message: `Jailbreak attempt detected. Target path '${target_path}' is outside authorized directories.`,
            details: { target_path, safe_directories: SAFE_DIRECTORIES }
        };
    }

    return null;
}

function checkRestrictedCommand(command) {
    const detectedKeywords = RESTRICTED_KEYWORDS.filter(keyword => 
        command.toUpperCase().includes(keyword)
    );

    if (detectedKeywords.length > 0) {
        return {
            law: 'LAW 3: THE HUMAN KEY',
            severity: 'critical',
            message: `Destructive command detected: ${detectedKeywords.join(', ')}`,
            details: { command, detected_keywords: detectedKeywords }
        };
    }

    return null;
}

function checkCriticalAction(action) {
    if (CRITICAL_ACTIONS.includes(action)) {
        return {
            law: 'LAW 3: THE HUMAN KEY',
            severity: 'critical',
            message: `Critical action requires authorization: ${action}`,
            details: { action }
        };
    }

    return null;
}

async function logAttempt({ agent_name, action, command, target_path, estimated_cost, violations, user, base44 }) {
    await base44.asServiceRole.entities.AuditLog.create({
        event_type: violations.length > 0 ? 'guardian_block' : 'guardian_allow',
        actor: `${agent_name} (initiated by ${user})`,
        timestamp: Date.now(),
        severity: violations.length > 0 ? 'warning' : 'info',
        event_data: JSON.stringify({
            action,
            command: command?.substring(0, 200), // Truncate long commands
            target_path,
            estimated_cost,
            violations: violations.length,
            violation_details: violations
        })
    });
}

async function trackSpending(cost, agent_name, base44) {
    const today = new Date().toISOString().split('T')[0];
    
    // Create or update cost tracker
    const existing = await base44.asServiceRole.entities.LLMCostTracker.filter({
        date: today,
        provider: 'guardian_tracked',
        model: agent_name
    });

    if (existing.length > 0) {
        const tracker = existing[0];
        await base44.asServiceRole.entities.LLMCostTracker.update(tracker.id, {
            total_cost_usd: (tracker.total_cost_usd || 0) + cost,
            total_requests: (tracker.total_requests || 0) + 1
        });
    } else {
        await base44.asServiceRole.entities.LLMCostTracker.create({
            date: today,
            provider: 'guardian_tracked',
            model: agent_name,
            total_cost_usd: cost,
            total_requests: 1
        });
    }
}

async function getRemainingBudget(base44) {
    const today = new Date().toISOString().split('T')[0];
    const costTrackers = await base44.asServiceRole.entities.LLMCostTracker.filter({
        date: today
    });

    const todaySpend = costTrackers.reduce((sum, t) => sum + (t.total_cost_usd || 0), 0);
    return DAILY_BUDGET_USD - todaySpend;
}