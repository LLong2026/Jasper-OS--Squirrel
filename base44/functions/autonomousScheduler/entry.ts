import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// AUTONOMOUS SCHEDULER - Background service for routine autonomous operations
// Runs periodically to monitor, optimize, and maintain system health

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { trigger = 'manual' } = await req.json();

        const results = {
            monitoring_tasks: [],
            optimization_tasks: [],
            healing_tasks: [],
            collaboration_updates: []
        };

        // 0. Initialize healing playbooks on first run
        const existingPlaybooks = await base44.asServiceRole.entities.KnowledgeBase.filter({
            source: 'mit_playbooks'
        });
        if (existingPlaybooks.length === 0) {
            await base44.functions.invoke('healingPlaybooks', {
                action: 'seed_playbooks'
            });
        }

        // 1. Monitor system health and initiate healing tasks
        const healthIssues = await monitorSystemHealth(base44);
        for (const issue of healthIssues) {
            const task = await initiateHealingTask(base44, issue);
            results.healing_tasks.push(task);
        }

        // 2. Optimize system policies
        const policyOptimization = await base44.functions.invoke('systemPolicyManager', {
            action: 'optimize'
        });
        results.policy_updates = policyOptimization.policies_updated;

        // 3. Optimize resource allocation based on usage patterns
        const optimizations = await optimizeResourceAllocation(base44);
        results.optimization_tasks = optimizations;

        // 4. Optimize collaborations with AI manager
        const collabOptimization = await base44.functions.invoke('collaborationManager', {
            action: 'optimize_collaborations'
        });
        results.collaboration_updates = collabOptimization.optimizations;

        // 5. Predict future load
        const loadPrediction = await base44.functions.invoke('systemPolicyManager', {
            action: 'predict_load'
        });
        results.load_prediction = loadPrediction.prediction;

        // 6. Run autonomous self-improvement cycle
        const selfImprovementResults = await runSelfImprovementCycle(base44);
        results.self_improvement = selfImprovementResults;

        // 7. Run meta-learning analysis
        const metaLearningResults = await runMetaLearning(base44);
        results.meta_learning = metaLearningResults;

        // 8. Run adversarial security testing
        const securityResults = await base44.functions.invoke('adversarialTesting', {
            action: 'spawn_red_team',
            payload: { test_intensity: 'moderate' }
        });
        results.security_testing = securityResults.data;

        // 9. Evaluate any active A/B tests
        const abTestResults = await evaluateActiveABTests(base44);
        results.ab_tests = abTestResults;

        // 10. Collaborative knowledge synthesis
        const synthesisResults = await runKnowledgeSynthesis(base44);
        results.knowledge_synthesis = synthesisResults;

        // 11. Clean up completed tasks older than 7 days
        await cleanupOldTasks(base44);

        return Response.json({
            success: true,
            trigger,
            timestamp: Date.now(),
            results
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function monitorSystemHealth(base44) {
    const issues = [];

    // Check for stale nodes
    const nodes = await base44.asServiceRole.entities.Node.filter({});
    const now = Date.now();
    
    for (const node of nodes) {
        if (node.last_heartbeat && now - node.last_heartbeat > 300000) { // 5 min
            issues.push({
                type: 'stale_node',
                severity: 8,
                details: { node_id: node.node_id },
                issue_type: 'node_health',
                affected_component: 'distributed_nodes'
            });
        }
    }

    // Check for failed tasks that need retry
    const failedTasks = await base44.asServiceRole.entities.AgentTask.filter({ status: 'failed' });
    for (const task of failedTasks.slice(0, 5)) {
        if (!task.self_corrections || task.self_corrections.length < 3) {
            issues.push({
                type: 'retriable_task',
                severity: 5,
                details: { task_id: task.task_id },
                issue_type: 'task_failure',
                affected_component: 'task_execution'
            });
        }
    }

    // Check LLM performance issues
    const llmPerf = await base44.asServiceRole.entities.LLMPerformance.filter({
        success_rate: { $lt: 80 }
    });
    for (const perf of llmPerf.slice(0, 3)) {
        issues.push({
            type: 'llm_degradation',
            severity: 7,
            details: { provider: perf.provider, model: perf.model, success_rate: perf.success_rate },
            issue_type: 'performance_degradation',
            affected_component: 'llm_orchestrator'
        });
    }

    // Check for resource exhaustion
    const resources = await base44.asServiceRole.entities.ResourcePool.filter({});
    for (const resource of resources) {
        const utilization = (resource.allocated / resource.total_capacity) * 100;
        if (utilization > 90) {
            issues.push({
                type: 'resource_exhaustion',
                severity: 9,
                details: { resource_type: resource.resource_type, utilization },
                issue_type: 'resource_exhaustion',
                affected_component: 'resource_management'
            });
        }
    }

    return issues;
}

async function initiateHealingTask(base44, issue) {
    // Use advanced healing playbooks
    const healing = await base44.functions.invoke('healingPlaybooks', {
        action: 'diagnose_and_heal',
        payload: {
            issue_type: issue.issue_type,
            issue_details: issue.details,
            affected_component: issue.affected_component
        }
    });

    return { 
        task_id: `heal_${Date.now()}`,
        issue_type: issue.type,
        healing_success: healing.data.success,
        diagnosis: healing.data.diagnosis?.final_conclusion
    };
}

async function optimizeResourceAllocation(base base44) {
    const pools = await base44.asServiceRole.entities.ResourcePool.filter({});
    const optimizations = [];

    for (const pool of pools) {
        // Release expired allocations
        if (pool.allocations) {
            const now = Date.now();
            const active = pool.allocations.filter(a => a.expires_at > now);
            const released = pool.allocations.length - active.length;

            if (released > 0) {
                const releasedAmount = pool.allocations
                    .filter(a => a.expires_at <= now)
                    .reduce((sum, a) => sum + a.amount, 0);

                await base44.asServiceRole.entities.ResourcePool.update(pool.id, {
                    allocations: active,
                    allocated: pool.allocated - releasedAmount,
                    available: pool.available + releasedAmount
                });

                optimizations.push({
                    resource_type: pool.resource_type,
                    released_amount: releasedAmount,
                    allocations_cleaned: released
                });
            }
        }
    }

    return optimizations;
}



async function runSelfImprovementCycle(base44) {
    const improvements = [];
    const allAgents = ['Wednesday', 'Arete', 'CodeForge', 'SystemArchitect'];
    
    for (const agentName of allAgents) {
        try {
            const analysis = await base44.functions.invoke('autonomousSelfImprovement', {
                action: 'analyze_performance',
                agent_name: agentName
            });
            
            if (!analysis.data.success) continue;
            
            const weaknesses = analysis.data.self_analysis?.identified_weaknesses || [];
            const criticalWeaknesses = weaknesses.filter(w => 
                w.severity === 'critical' || w.severity === 'high'
            );
            
            if (criticalWeaknesses.length > 0) {
                const proposal = await base44.functions.invoke('autonomousSelfImprovement', {
                    action: 'propose_improvement',
                    agent_name: agentName,
                    payload: {
                        weakness_analysis: { identified_weaknesses: criticalWeaknesses }
                    }
                });
                
                if (proposal.data.success) {
                    improvements.push({
                        agent: agentName,
                        weaknesses_found: criticalWeaknesses.length,
                        proposal_id: proposal.data.proposal_id,
                        proposal_type: proposal.data.proposal.proposal_type
                    });
                }
            }
        } catch (error) {
            console.error(`Self-improvement failed for ${agentName}:`, error);
        }
    }
    
    return improvements;
}

async function cleanupOldTasks(base44) {
    const tasks = await base44.asServiceRole.entities.AgentTask.filter({ status: 'completed' });
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const task of tasks) {
        if (task.created_date && new Date(task.created_date).getTime() < sevenDaysAgo) {
            await base44.asServiceRole.entities.AgentTask.delete(task.id);
        }
    }
}

async function runMetaLearning(base44) {
    const results = [];
    const agents = ['Wednesday', 'Arete', 'CodeForge', 'SystemArchitect'];
    
    for (const agent of agents) {
        try {
            const analysis = await base44.functions.invoke('metaLearning', {
                action: 'analyze_learning_effectiveness',
                agent_name: agent
            });
            
            if (analysis.data.success && analysis.data.learning_optimizations_available > 0) {
                const optimization = await base44.functions.invoke('metaLearning', {
                    action: 'optimize_learning_process',
                    agent_name: agent,
                    payload: { meta_analysis: analysis.data.meta_analysis }
                });
                
                results.push({
                    agent,
                    optimizations_applied: optimization.data.optimizations_applied
                });
            }
        } catch (error) {
            console.error(`Meta-learning failed for ${agent}:`, error);
        }
    }
    
    return results;
}

async function evaluateActiveABTests(base44) {
    const activeTests = await base44.asServiceRole.entities.GlobalMemory.filter({
        tags: { $contains: 'ab_test' }
    });
    
    const results = [];
    
    for (const test of activeTests) {
        const testConfig = test.content.test_config;
        const now = Date.now();
        
        // Only evaluate if test period has ended
        if (now >= testConfig.test_end) {
            try {
                const evaluation = await base44.functions.invoke('autonomousSelfImprovement', {
                    action: 'evaluate_ab_test',
                    agent_name: test.content.agent,
                    payload: { ab_test_id: test.content.ab_test_id }
                });
                
                results.push({
                    ab_test_id: test.content.ab_test_id,
                    decision: evaluation.data.decision
                });
            } catch (error) {
                console.error(`A/B test evaluation failed for ${test.content.ab_test_id}:`, error);
            }
        }
    }
    
    return results;
}

async function runKnowledgeSynthesis(base44) {
    const results = [];
    
    // Synthesize knowledge on key topics
    const topics = [
        'system_optimization',
        'failure_recovery',
        'performance_improvement',
        'agent_collaboration'
    ];
    
    for (const topic of topics) {
        try {
            const synthesis = await base44.functions.invoke('knowledgeSynthesis', {
                action: 'synthesize_knowledge',
                payload: {
                    topic,
                    participating_agents: ['Wednesday', 'Arete', 'SystemArchitect'],
                    source_types: ['experiences', 'documentation', 'reasoning']
                }
            });
            
            if (synthesis.data.success && synthesis.data.insights_synthesized > 0) {
                results.push({
                    topic,
                    insights_created: synthesis.data.insights_synthesized
                });
            }
        } catch (error) {
            console.error(`Knowledge synthesis failed for ${topic}:`, error);
        }
    }
    
    return results;
}