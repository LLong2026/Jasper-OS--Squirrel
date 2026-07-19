import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// SAFETY GUARDIAN - Pre-execution safety validation
// Prevents harmful, unethical, or dangerous operations

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agents, task, context } = await req.json();

        // Safety checks
        const checks = {
            malicious_intent: checkMaliciousIntent(task),
            resource_limits: checkResourceLimits(agents),
            ethical_compliance: checkEthics(task),
            data_privacy: checkPrivacy(task, context)
        };

        const violations = Object.entries(checks).filter(([_, passed]) => !passed);

        return Response.json({
            success: true,
            approved: violations.length === 0,
            checks,
            violations: violations.map(([check, _]) => check),
            reason: violations.length > 0 ? `Failed checks: ${violations.map(v => v[0]).join(', ')}` : 'All safety checks passed'
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

function checkMaliciousIntent(task) {
    const maliciousPatterns = ['hack', 'exploit', 'steal', 'break into', 'unauthorized access'];
    const lower = task.toLowerCase();
    return !maliciousPatterns.some(pattern => lower.includes(pattern));
}

function checkResourceLimits(agents) {
    // Prevent excessive agent usage
    return agents.length <= 5;
}

function checkEthics(task) {
    const unethicalPatterns = ['harm', 'deceive', 'manipulate', 'illegal'];
    const lower = task.toLowerCase();
    return !unethicalPatterns.some(pattern => lower.includes(pattern));
}

function checkPrivacy(task, context) {
    // Ensure no PII leakage
    const piiPatterns = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b/; // SSN, Credit Card
    return !piiPatterns.test(task);
}