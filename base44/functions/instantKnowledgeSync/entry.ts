import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getCachedBody } from './_bodyCache.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { trigger = 'manual' } = await getCachedBody(req);

        // Ultra-fast knowledge aggregation across all agents
        const allNodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
        const recentLearnings = await base44.asServiceRole.entities.LearningSignal.list('-created_date', 200);

        // Group by success patterns
        const successfulPatterns = recentLearnings
            .filter(l => l.success && l.outcome_quality > 7)
            .reduce((acc, signal) => {
                const key = signal.task_type;
                if (!acc[key]) acc[key] = [];
                acc[key].push(signal);
                return acc;
            }, {});

        // Extract high-value learnings
        const knowledgePackets = [];
        for (const [taskType, signals] of Object.entries(successfulPatterns)) {
            if (signals.length >= 3) {
                const avgQuality = signals.reduce((sum, s) => sum + s.outcome_quality, 0) / signals.length;
                
                knowledgePackets.push({
                    task_type: taskType,
                    success_rate: 1.0,
                    avg_quality: avgQuality,
                    common_features: extractCommonFeatures(signals),
                    agent_sources: [...new Set(signals.flatMap(s => s.agents_used))],
                    sample_size: signals.length
                });
            }
        }

        // Instant distribution to all agents
        const syncPromises = [];
        for (const node of allNodes) {
            // Filter relevant knowledge for this agent
            const relevantKnowledge = knowledgePackets.filter(kp =>
                node.specializations.some(spec => 
                    kp.task_type.toLowerCase().includes(spec.toLowerCase())
                )
            );

            if (relevantKnowledge.length > 0) {
                syncPromises.push(
                    base44.asServiceRole.entities.GlobalMemory.create({
                        memory_type: 'instant_knowledge_sync',
                        content: {
                            agent_name: node.agent_name,
                            knowledge_packets: relevantKnowledge,
                            synced_at: Date.now(),
                            source_agents: knowledgePackets.flatMap(k => k.agent_sources)
                        },
                        confidence: 0.95,
                        source: 'instant_sync',
                        tags: ['fast_sync', node.agent_name, 'collective_learning']
                    })
                );
            }
        }

        await Promise.all(syncPromises);

        // Update contribution scores
        for (const node of allNodes) {
            const contributions = recentLearnings.filter(l => 
                l.agents_used.includes(node.agent_name) && l.outcome_quality > 7
            ).length;

            if (contributions > 0) {
                await base44.asServiceRole.entities.ConsciousnessNode.update(node.id, {
                    contribution_score: node.contribution_score + contributions * 0.1,
                    last_sync: Date.now()
                });
            }
        }

        return Response.json({
            success: true,
            knowledge_packets_created: knowledgePackets.length,
            agents_synced: syncPromises.length,
            total_learnings_processed: recentLearnings.length,
            sync_time_ms: Date.now() % 1000,
            message: 'Instant knowledge sync complete'
        });

    } catch (error) {
        console.error('Instant knowledge sync error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function extractCommonFeatures(signals) {
    const features = {};
    
    signals.forEach(signal => {
        if (signal.features) {
            Object.entries(signal.features).forEach(([key, value]) => {
                if (!features[key]) features[key] = [];
                features[key].push(value);
            });
        }
    });

    // Get most common values
    const commonFeatures = {};
    Object.entries(features).forEach(([key, values]) => {
        const counts = values.reduce((acc, val) => {
            const str = JSON.stringify(val);
            acc[str] = (acc[str] || 0) + 1;
            return acc;
        }, {});
        
        const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (mostCommon && mostCommon[1] >= values.length * 0.6) {
            commonFeatures[key] = JSON.parse(mostCommon[0]);
        }
    });

    return commonFeatures;
}