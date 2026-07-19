import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Circuit Breaker Pattern - Prevents cascade failures
 * Implements half-open, open, closed states for service resilience
 */

const circuitStates = new Map();

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { service_name, action = 'check' } = await req.json();

        if (action === 'check') {
            const state = getCircuitState(service_name);
            return Response.json({
                service: service_name,
                state: state.status,
                failure_count: state.failures,
                last_failure: state.lastFailure,
                next_retry: state.nextRetry
            });
        } else if (action === 'record_success') {
            recordSuccess(service_name);
            return Response.json({ success: true });
        } else if (action === 'record_failure') {
            const shouldBlock = recordFailure(service_name);
            return Response.json({ 
                success: true, 
                circuit_open: shouldBlock 
            });
        } else if (action === 'reset') {
            resetCircuit(service_name);
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Unknown action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

function getCircuitState(serviceName) {
    if (!circuitStates.has(serviceName)) {
        circuitStates.set(serviceName, {
            status: 'closed',
            failures: 0,
            lastFailure: null,
            nextRetry: null,
            successStreak: 0
        });
    }
    return circuitStates.get(serviceName);
}

function recordSuccess(serviceName) {
    const state = getCircuitState(serviceName);
    state.successStreak++;
    
    // After 5 consecutive successes, close the circuit
    if (state.successStreak >= 5 && state.status === 'half-open') {
        state.status = 'closed';
        state.failures = 0;
        state.lastFailure = null;
        state.nextRetry = null;
    }
}

function recordFailure(serviceName) {
    const state = getCircuitState(serviceName);
    state.failures++;
    state.lastFailure = Date.now();
    state.successStreak = 0;

    // Open circuit after 5 failures
    if (state.failures >= 5 && state.status === 'closed') {
        state.status = 'open';
        state.nextRetry = Date.now() + (60 * 1000); // 1 minute cooldown
        return true;
    }

    // Check if we should try half-open
    if (state.status === 'open' && Date.now() >= state.nextRetry) {
        state.status = 'half-open';
        return false; // Allow one test request
    }

    return state.status === 'open';
}

function resetCircuit(serviceName) {
    circuitStates.set(serviceName, {
        status: 'closed',
        failures: 0,
        lastFailure: null,
        nextRetry: null,
        successStreak: 0
    });
}