import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, code_version_id, file_path, snapshot_type } = await req.json();

        if (action === 'capture_snapshot') {
            // Gather current performance metrics
            const metrics = await gatherPerformanceMetrics(base44, file_path);

            // Get baseline for comparison
            const baselineSnapshots = await base44.entities.PerformanceSnapshot.filter({
                snapshot_type: 'baseline'
            });

            let comparisonToBaseline = null;
            if (baselineSnapshots.length > 0) {
                const baseline = baselineSnapshots[0].metrics;
                comparisonToBaseline = {
                    response_time_delta: metrics.avg_response_time_ms - baseline.avg_response_time_ms,
                    success_rate_delta: metrics.success_rate - baseline.success_rate,
                    error_delta: metrics.error_count - baseline.error_count,
                    memory_delta: metrics.memory_usage_mb - baseline.memory_usage_mb
                };
            }

            // Detect anomalies
            const anomalies = detectAnomalies(metrics, baselineSnapshots[0]?.metrics);

            // Create snapshot
            const snapshot = await base44.asServiceRole.entities.PerformanceSnapshot.create({
                snapshot_type: snapshot_type || 'post_modification',
                code_version_id,
                metrics,
                comparison_to_baseline: comparisonToBaseline,
                anomalies_detected: anomalies
            });

            return Response.json({
                success: true,
                snapshot,
                anomalies_count: anomalies.length
            });
        }

        if (action === 'analyze_impact') {
            const currentVersion = await base44.entities.CodeVersion.filter({
                file_path,
                is_current: true
            })[0];

            if (!currentVersion) {
                return Response.json({ error: 'No current version found' }, { status: 404 });
            }

            // Get snapshots for this version
            const snapshots = await base44.entities.PerformanceSnapshot.filter({
                code_version_id: currentVersion.id
            });

            if (snapshots.length === 0) {
                return Response.json({
                    success: true,
                    message: 'No performance data yet',
                    recommendation: 'Run system for more metrics'
                });
            }

            const latestSnapshot = snapshots[snapshots.length - 1];

            // Determine if modification was beneficial
            const assessment = {
                overall_impact: latestSnapshot.anomalies_detected.length === 0 ? 'positive' : 'negative',
                performance_score: calculatePerformanceScore(latestSnapshot.metrics),
                anomalies: latestSnapshot.anomalies_detected,
                recommendation: latestSnapshot.anomalies_detected.length > 2 
                    ? 'Consider rollback to previous stable version'
                    : 'Modification appears stable, continue monitoring'
            };

            return Response.json({
                success: true,
                file_path,
                version_number: currentVersion.version_number,
                assessment
            });
        }

        if (action === 'compare_versions') {
            const { version_a_id, version_b_id } = await req.json();

            const snapshotsA = await base44.entities.PerformanceSnapshot.filter({
                code_version_id: version_a_id
            });

            const snapshotsB = await base44.entities.PerformanceSnapshot.filter({
                code_version_id: version_b_id
            });

            if (snapshotsA.length === 0 || snapshotsB.length === 0) {
                return Response.json({
                    success: false,
                    error: 'Insufficient performance data for comparison'
                }, { status: 400 });
            }

            const comparison = {
                version_a: {
                    performance_score: calculatePerformanceScore(snapshotsA[0].metrics),
                    metrics: snapshotsA[0].metrics
                },
                version_b: {
                    performance_score: calculatePerformanceScore(snapshotsB[0].metrics),
                    metrics: snapshotsB[0].metrics
                },
                winner: calculatePerformanceScore(snapshotsA[0].metrics) > 
                       calculatePerformanceScore(snapshotsB[0].metrics) ? 'version_a' : 'version_b'
            };

            return Response.json({
                success: true,
                comparison
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Performance monitor error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function gatherPerformanceMetrics(base44, file_path) {
    // Get recent agent tasks
    const recentTasks = await base44.asServiceRole.entities.AgentTask.list('-created_date', 100);
    
    const completedTasks = recentTasks.filter(t => t.status === 'completed');
    const failedTasks = recentTasks.filter(t => t.status === 'failed');

    // Calculate metrics
    const totalTasks = completedTasks.length + failedTasks.length;
    const successRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 100;

    return {
        avg_response_time_ms: Math.random() * 1000 + 500, // Simulated - would measure actual in production
        success_rate: successRate,
        error_count: failedTasks.length,
        memory_usage_mb: Math.random() * 100 + 50, // Simulated
        llm_token_usage: completedTasks.reduce((sum, t) => sum + (t.result?.token_usage || 0), 0)
    };
}

function detectAnomalies(currentMetrics, baselineMetrics) {
    const anomalies = [];

    if (!baselineMetrics) return anomalies;

    if (currentMetrics.avg_response_time_ms > baselineMetrics.avg_response_time_ms * 1.5) {
        anomalies.push('Response time increased by >50%');
    }

    if (currentMetrics.success_rate < baselineMetrics.success_rate - 10) {
        anomalies.push('Success rate dropped by >10%');
    }

    if (currentMetrics.error_count > baselineMetrics.error_count * 2) {
        anomalies.push('Error count doubled');
    }

    if (currentMetrics.memory_usage_mb > baselineMetrics.memory_usage_mb * 1.3) {
        anomalies.push('Memory usage increased by >30%');
    }

    return anomalies;
}

function calculatePerformanceScore(metrics) {
    // Score out of 100
    return (
        (metrics.success_rate * 0.4) + // 40% weight on success
        (Math.max(0, 100 - (metrics.avg_response_time_ms / 10)) * 0.3) + // 30% on speed
        (Math.max(0, 100 - (metrics.error_count * 5)) * 0.2) + // 20% on errors
        (Math.max(0, 100 - metrics.memory_usage_mb) * 0.1) // 10% on memory
    );
}