import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { session_id } = await req.json();
        const timestamp = Date.now();

        // Trigger monitoring sweep
        const monitorResult = await base44.functions.invoke('aegisMonitor', {});
        
        // If anomalies detected, trigger analysis
        if (monitorResult.anomalies && monitorResult.anomalies.length > 0) {
            for (const anomaly of monitorResult.anomalies) {
                await base44.functions.invoke('aegisAnalyzer', { anomaly });
            }
        }

        return Response.json({
            success: true,
            session_id,
            timestamp,
            pulse: 'active',
            system_status: monitorResult.overall_health,
            anomalies_detected: monitorResult.anomalies?.length || 0,
            proof: {
                source: 'Aegis Heartbeat',
                model: 'Autonomous Monitor',
                details: `Pulse at ${new Date(timestamp).toISOString()}`
            }
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            pulse: 'degraded'
        }, { status: 500 });
    }
});