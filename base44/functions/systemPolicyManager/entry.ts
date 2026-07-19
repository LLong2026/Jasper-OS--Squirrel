import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// SYSTEM POLICY MANAGER - Dynamic system-wide optimization
// Adjusts resource allocation and agent selection based on trends

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { action } = await req.json();

        if (action === 'optimize') {
            return await optimizeSystemPolicies(base44);
        }

        if (action === 'predict_load') {
            return await predictFutureLoad(base44);
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function optimizeSystemPolicies(base44) {
    // Get system performance data
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({});
    const resources = await base44.asServiceRole.entities.ResourcePool.filter({});
    const tasks = await base44.asServiceRole.entities.AgentTask.filter({});
    const recentTasks = tasks.slice(0, 100);

    // Analyze trends
    const trends = analyzePerformanceTrends(agents, recentTasks);
    const loadPrediction = predictLoad(recentTasks);
    
    const policyUpdates = [];

    // 1. Resource Allocation Policy
    const resourceStrategy = determineResourceStrategy(resources, loadPrediction, trends);
    await updateSystemPolicy(base44, 'resource_allocation', 'resource_allocation', resourceStrategy);
    policyUpdates.push({ policy: 'resource_allocation', strategy: resourceStrategy });

    // 2. Agent Selection Policy
    const selectionCriteria = determineSelectionCriteria(agents, trends);
    await updateSystemPolicy(base44, 'agent_selection', 'agent_selection', selectionCriteria);
    policyUpdates.push({ policy: 'agent_selection', criteria: selectionCriteria });

    // 3. Load Balancing Policy
    const balancingStrategy = determineLoadBalancing(trends, loadPrediction);
    await updateSystemPolicy(base44, 'load_balancing', 'load_balancing', balancingStrategy);
    policyUpdates.push({ policy: 'load_balancing', strategy: balancingStrategy });

    // 4. Priority Adjustment Policy
    const priorityStrategy = determinePriorityStrategy(trends);
    await updateSystemPolicy(base44, 'priority_adjustment', 'priority_adjustment', priorityStrategy);
    policyUpdates.push({ policy: 'priority_adjustment', strategy: priorityStrategy });

    return Response.json({
        success: true,
        policies_updated: policyUpdates,
        trends,
        load_prediction: loadPrediction
    });
}

async function predictFutureLoad(base44) {
    const tasks = await base44.asServiceRole.entities.AgentTask.filter({});
    const recentTasks = tasks.slice(0, 100);
    
    const prediction = predictLoad(recentTasks);
    
    return Response.json({
        success: true,
        prediction
    });
}

function analyzePerformanceTrends(agents, tasks) {
    const avgSuccess = agents.reduce((sum, a) => sum + a.success_rate, 0) / (agents.length || 1);
    const avgTime = agents.reduce((sum, a) => sum + a.avg_execution_time_ms, 0) / (agents.length || 1);
    
    const completedLast20 = tasks.slice(0, 20).filter(t => t.status === 'completed').length;
    const completionRate = completedLast20 / 20;

    return {
        avg_success_rate: avgSuccess,
        avg_execution_time: avgTime,
        recent_completion_rate: completionRate,
        trend: completionRate > 0.8 ? 'improving' : completionRate > 0.5 ? 'stable' : 'degrading'
    };
}

function predictLoad(recentTasks) {
    const tasksPerHour = recentTasks.length;
    const pendingCount = recentTasks.filter(t => t.status === 'pending').length;
    
    return {
        expected_tasks_next_hour: Math.round(tasksPerHour * 1.2),
        current_queue_depth: pendingCount,
        load_level: pendingCount > 50 ? 'high' : pendingCount > 20 ? 'medium' : 'low'
    };
}

function determineResourceStrategy(resources, loadPrediction, trends) {
    if (loadPrediction.load_level === 'high') {
        return {
            mode: 'aggressive_allocation',
            reserve_percentage: 10,
            auto_scale: true,
            priority_boost: 2
        };
    } else if (trends.trend === 'degrading') {
        return {
            mode: 'conservative_allocation',
            reserve_percentage: 30,
            auto_scale: false,
            priority_boost: 1
        };
    } else {
        return {
            mode: 'balanced_allocation',
            reserve_percentage: 20,
            auto_scale: true,
            priority_boost: 1
        };
    }
}

function determineSelectionCriteria(agents, trends) {
    if (trends.avg_success_rate < 70) {
        return {
            min_success_rate: 75,
            prioritize: 'reliability',
            allow_new_agents: false
        };
    } else if (trends.avg_execution_time > 5000) {
        return {
            min_success_rate: 60,
            prioritize: 'speed',
            allow_new_agents: true
        };
    } else {
        return {
            min_success_rate: 70,
            prioritize: 'balanced',
            allow_new_agents: true
        };
    }
}

function determineLoadBalancing(trends, loadPrediction) {
    if (loadPrediction.load_level === 'high') {
        return {
            strategy: 'distribute_evenly',
            max_tasks_per_agent: 5,
            enable_collaboration: true
        };
    } else {
        return {
            strategy: 'optimal_match',
            max_tasks_per_agent: 10,
            enable_collaboration: false
        };
    }
}

function determinePriorityStrategy(trends) {
    if (trends.trend === 'degrading') {
        return {
            boost_critical: true,
            defer_low_priority: true,
            emergency_mode: true
        };
    } else {
        return {
            boost_critical: false,
            defer_low_priority: false,
            emergency_mode: false
        };
    }
}

async function updateSystemPolicy(base44, policyName, category, strategy) {
    const policies = await base44.asServiceRole.entities.SystemPolicy.filter({ policy_name: policyName });
    
    const policyData = {
        policy_name: policyName,
        policy_category: category,
        current_strategy: strategy,
        performance_metrics: {},
        predicted_load: {}
    };

    if (policies.length > 0) {
        await base44.asServiceRole.entities.SystemPolicy.update(policies[0].id, policyData);
    } else {
        await base44.asServiceRole.entities.SystemPolicy.create(policyData);
    }
}