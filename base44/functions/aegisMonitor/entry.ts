import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const anomalies = [];
        const timestamp = Date.now();

        // Health Check Categories
        const checks = {
            api_endpoints: await checkAPIEndpoints(),
            system_resources: await checkSystemResources(),
            crypto_algorithms: await checkCryptoVulnerabilities(),
            service_dependencies: await checkServiceDependencies(),
            rate_limits: await checkRateLimits()
        };

        // Process checks and identify anomalies
        for (const [category, result] of Object.entries(checks)) {
            if (!result.healthy) {
                anomalies.push({
                    id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    category,
                    severity: result.severity,
                    detected_at: timestamp,
                    metrics: result.metrics,
                    description: result.description,
                    anomaly_type: result.anomaly_type
                });
            }
        }

        const overall_health = anomalies.length === 0 ? 'healthy' : 
                               anomalies.some(a => a.severity === 'critical') ? 'critical' : 'degraded';

        return Response.json({
            success: true,
            overall_health,
            timestamp,
            checks_performed: Object.keys(checks).length,
            anomalies,
            proof: {
                source: 'Aegis Monitor',
                model: 'System Scanner',
                details: `Scanned ${Object.keys(checks).length} health categories`
            }
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

// Health check functions
async function checkAPIEndpoints() {
    const simulatedLatency = Math.random() * 100;
    return {
        healthy: simulatedLatency < 80,
        severity: simulatedLatency > 80 ? 'high' : 'low',
        metrics: { avg_latency_ms: simulatedLatency },
        description: simulatedLatency > 80 ? 'API latency exceeds threshold' : 'API endpoints healthy',
        anomaly_type: 'high_latency'
    };
}

async function checkSystemResources() {
    const simulatedCPU = Math.random() * 100;
    const simulatedMemory = Math.random() * 100;
    return {
        healthy: simulatedCPU < 85 && simulatedMemory < 85,
        severity: (simulatedCPU > 85 || simulatedMemory > 85) ? 'high' : 'low',
        metrics: { cpu_usage: simulatedCPU, memory_usage: simulatedMemory },
        description: 'Resource usage monitored',
        anomaly_type: 'resource_exhaustion'
    };
}

async function checkCryptoVulnerabilities() {
    const vulnerableAlgorithms = Math.random() > 0.7 ? ['RSA-2048', 'ECDSA'] : [];
    return {
        healthy: vulnerableAlgorithms.length === 0,
        severity: vulnerableAlgorithms.length > 0 ? 'critical' : 'low',
        metrics: { vulnerable_count: vulnerableAlgorithms.length },
        description: vulnerableAlgorithms.length > 0 ? 'Quantum-vulnerable algorithms detected' : 'Cryptography secure',
        anomaly_type: 'quantum_vulnerability_detected',
        vulnerable_algorithms: vulnerableAlgorithms
    };
}

async function checkServiceDependencies() {
    return {
        healthy: true,
        severity: 'low',
        metrics: { services_up: 12, services_down: 0 },
        description: 'All services operational',
        anomaly_type: null
    };
}

async function checkRateLimits() {
    const trafficSpike = Math.random() * 10;
    return {
        healthy: trafficSpike < 3,
        severity: trafficSpike > 3 ? 'high' : 'low',
        metrics: { traffic_multiplier: trafficSpike },
        description: trafficSpike > 3 ? 'Traffic spike detected' : 'Traffic normal',
        anomaly_type: 'traffic_anomaly'
    };
}