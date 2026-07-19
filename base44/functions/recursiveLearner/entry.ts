import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// RECURSIVE LEARNER - Real continuous learning from every interaction
// Stores outcomes in database and uses them to improve future decisions

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { event_id, features, agents_used, outcome, success, execution_time_ms } = await req.json();

        // 1. Store learning signal in database
        const learningSignal = await base44.entities.LearningSignal.create({
            event_id,
            task_type: features.task_type,
            agents_used: agents_used.map(a => a.name),
            success,
            execution_time_ms,
            features,
            outcome_quality: assessOutcomeQuality(outcome)
        });

        // 2. Update agent performance metrics
        for (const agent of agents_used) {
            await updateAgentPerformance(base44, agent.name, success, execution_time_ms, features.task_type);
        }

        // 3. Check if we should retrain (every 50 signals)
        const totalSignals = await base44.entities.LearningSignal.filter({});
        const shouldRetrain = totalSignals.length % 50 === 0;
        
        if (shouldRetrain) {
            await base44.functions.invoke('modelTrainer', {
                signal_count: totalSignals.length,
                trigger: 'auto_retrain'
            });
        }

        return Response.json({
            success: true,
            learned: true,
            signal_id: learningSignal.id,
            total_signals: totalSignals.length,
            retrain_triggered: shouldRetrain,
            event_id
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

function assessOutcomeQuality(outcome) {
    if (!outcome || typeof outcome !== 'string') return 5;
    const length = outcome.length;
    const hasCode = outcome.includes('```');
    const hasStructure = outcome.includes('\n\n');
    
    let score = 5;
    if (length > 200) score += 2;
    if (length > 500) score += 1;
    if (hasCode) score += 1;
    if (hasStructure) score += 1;
    
    return Math.min(score, 10);
}

async function updateAgentPerformance(base44, agentName, success, executionTime, taskType) {
    try {
        const existing = await base44.entities.AgentPerformance.filter({ agent_name: agentName });
        
        if (existing.length > 0) {
            const perf = existing[0];
            const newTotal = perf.total_tasks + 1;
            const newSuccessful = perf.successful_tasks + (success ? 1 : 0);
            const newSuccessRate = (newSuccessful / newTotal) * 100;
            const newAvgTime = ((perf.avg_execution_time_ms * perf.total_tasks) + executionTime) / newTotal;
            
            await base44.entities.AgentPerformance.update(perf.id, {
                total_tasks: newTotal,
                successful_tasks: newSuccessful,
                success_rate: newSuccessRate,
                avg_execution_time_ms: newAvgTime,
                last_updated: Date.now()
            });
        } else {
            await base44.entities.AgentPerformance.create({
                agent_name: agentName,
                total_tasks: 1,
                successful_tasks: success ? 1 : 0,
                success_rate: success ? 100 : 0,
                avg_execution_time_ms: executionTime,
                last_updated: Date.now()
            });
        }
    } catch (error) {
        console.error('Error updating agent performance:', error);
    }
}