import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { anomaly } = await req.json();

        // Analyze anomaly and select appropriate playbook
        const analysis = await analyzeAnomaly(anomaly);
        const playbook = selectPlaybook(anomaly, analysis);

        // If playbook selected, trigger actuator
        if (playbook) {
            const healingResult = await base44.functions.invoke('aegisActuator', {
                playbook,
                anomaly,
                analysis
            });

            return Response.json({
                success: true,
                anomaly_id: anomaly.id,
                analysis,
                playbook_selected: playbook.id,
                healing_initiated: true,
                healing_result: healingResult,
                proof: {
                    source: 'Aegis Analyzer',
                    model: 'Diagnostic Engine',
                    details: `Selected playbook ${playbook.id} for ${anomaly.anomaly_type}`
                }
            });
        }

        return Response.json({
            success: true,
            anomaly_id: anomaly.id,
            analysis,
            playbook_selected: null,
            healing_initiated: false,
            reason: 'No automated playbook available'
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function analyzeAnomaly(anomaly) {
    const patterns = {
        'high_latency': {
            root_cause: 'API performance degradation',
            confidence: 0.85,
            impact: 'User experience degraded',
            urgency: 'high'
        },
        'resource_exhaustion': {
            root_cause: 'Memory leak or CPU spike',
            confidence: 0.90,
            impact: 'Service instability risk',
            urgency: 'critical'
        },
        'quantum_vulnerability_detected': {
            root_cause: 'Quantum-vulnerable cryptography in use',
            confidence: 0.95,
            impact: 'Future security compromise',
            urgency: 'critical'
        },
        'traffic_anomaly': {
            root_cause: 'Potential DDoS or abuse',
            confidence: 0.75,
            impact: 'Resource consumption spike',
            urgency: 'high'
        }
    };

    return patterns[anomaly.anomaly_type] || {
        root_cause: 'Unknown',
        confidence: 0.5,
        impact: 'Unknown',
        urgency: 'medium'
    };
}

function selectPlaybook(anomaly, analysis) {
    const playbooks = {
        'high_latency': {
            id: 'PB-005',
            name: 'Cache Warming',
            actions: ['analyze_cache', 'warm_cache', 'verify_latency']
        },
        'resource_exhaustion': {
            id: 'PB-001',
            name: 'Service Restart',
            actions: ['backup_state', 'restart_service', 'verify_health']
        },
        'quantum_vulnerability_detected': {
            id: 'PQM-001',
            name: 'Post-Quantum Migration',
            actions: ['analyze_crypto', 'initiate_pqc_upgrade', 'rotate_keys_pq']
        },
        'traffic_anomaly': {
            id: 'PB-015',
            name: 'Rate Limiter Adjustment',
            actions: ['analyze_traffic', 'calculate_limits', 'apply_throttling']
        }
    };

    return playbooks[anomaly.anomaly_type] || null;
}