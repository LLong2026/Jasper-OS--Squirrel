import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, ...params } = await req.json();

        switch (action) {
            case 'coordinate_task':
                return Response.json(await coordinateTask(base44, params));
            case 'get_collective_state':
                return Response.json(await getCollectiveState(base44));
            case 'optimize_agent_distribution':
                return Response.json(await optimizeAgentDistribution(base44));
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Sovereign Orchestrator Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// Intelligently coordinate a task across the agent fleet
async function coordinateTask(base44, { task_description, complexity, domain }) {
    // Get all active agents and their current performance
    const nodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
    const performances = await base44.asServiceRole.entities.AgentPerformance.list();
    
    // Calculate collective intelligence index
    const collectiveIndex = calculateCollectiveIntelligence(nodes, performances);
    
    // Route task to optimal agent(s) based on specialization and performance
    const optimalAgents = selectOptimalAgents(nodes, performances, {
        task_description,
        complexity,
        domain
    });
    
    // Determine if task requires collaboration
    const requiresCollaboration = complexity > 7 || optimalAgents.length > 1;
    
    if (requiresCollaboration) {
        // Create a task force
        const taskForce = await base44.asServiceRole.entities.TaskForce.create({
            task_description,
            assigned_agents: optimalAgents.map(a => a.agent_name),
            coordination_strategy: 'parallel_processing',
            status: 'active',
            collective_confidence: collectiveIndex.confidence
        });
        
        return {
            coordination_mode: 'collaborative',
            task_force_id: taskForce.id,
            assigned_agents: optimalAgents.map(a => a.agent_name),
            collective_intelligence_index: collectiveIndex.score,
            estimated_completion: estimateCompletionTime(optimalAgents, complexity)
        };
    } else {
        // Single agent can handle it
        return {
            coordination_mode: 'solo',
            assigned_agent: optimalAgents[0].agent_name,
            agent_confidence: optimalAgents[0].contribution_score,
            collective_intelligence_index: collectiveIndex.score,
            estimated_completion: estimateCompletionTime(optimalAgents, complexity)
        };
    }
}

// Get the current state of collective consciousness
async function getCollectiveState(base44) {
    const nodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
    const memories = await base44.asServiceRole.entities.GlobalMemory.list();
    const thoughts = await base44.asServiceRole.entities.CollectiveThought.list();
    const learningSignals = await base44.asServiceRole.entities.LearningSignal.list('-created_date', 100);
    
    // Calculate various intelligence metrics
    const activeNodes = nodes.filter(n => n.collective_alignment > 0.7);
    const avgAlignment = nodes.reduce((sum, n) => sum + (n.collective_alignment || 0), 0) / nodes.length;
    const totalContributions = nodes.reduce((sum, n) => sum + (n.contribution_score || 0), 0);
    const memoryQuality = memories.reduce((sum, m) => sum + (m.confidence_score || 0), 0) / memories.length;
    const convergentThoughts = thoughts.filter(t => t.convergence_score > 0.8).length;
    
    // Learning velocity (improvement over time)
    const recentLearning = learningSignals.slice(0, 20);
    const olderLearning = learningSignals.slice(20, 40);
    const recentQuality = recentLearning.reduce((sum, s) => sum + (s.outcome_quality || 5), 0) / recentLearning.length;
    const olderQuality = olderLearning.length > 0 
        ? olderLearning.reduce((sum, s) => sum + (s.outcome_quality || 5), 0) / olderLearning.length 
        : recentQuality;
    const learningVelocity = recentQuality - olderQuality;
    
    // Collective intelligence score (0-100)
    const intelligenceScore = Math.min(100, (
        (avgAlignment * 20) +
        (memoryQuality * 20) +
        ((convergentThoughts / thoughts.length) * 20) +
        (Math.min(totalContributions / 100, 1) * 20) +
        (Math.max(0, learningVelocity + 5) * 4)
    ));
    
    return {
        collective_intelligence_score: intelligenceScore,
        metrics: {
            active_nodes: activeNodes.length,
            total_nodes: nodes.length,
            average_alignment: avgAlignment,
            total_contributions: totalContributions,
            memory_quality: memoryQuality,
            convergent_thoughts: convergentThoughts,
            learning_velocity: learningVelocity
        },
        state_classification: classifyCollectiveState(intelligenceScore),
        emergent_capabilities: identifyEmergentCapabilities(nodes, thoughts)
    };
}

// Optimize agent distribution and specializations
async function optimizeAgentDistribution(base44) {
    const nodes = await base44.asServiceRole.entities.ConsciousnessNode.list();
    const recentTasks = await base44.asServiceRole.entities.AgentTask.list('-created_date', 200);
    const skillGaps = await base44.asServiceRole.entities.SkillGap.list();
    
    // Analyze task distribution
    const taskTypes = {};
    recentTasks.forEach(task => {
        const type = task.task_type || 'general';
        taskTypes[type] = (taskTypes[type] || 0) + 1;
    });
    
    // Identify over/under-utilized specializations
    const specializationDemand = {};
    Object.entries(taskTypes).forEach(([type, count]) => {
        const servedBy = nodes.filter(n => 
            n.specialization && n.specialization.some(s => 
                type.toLowerCase().includes(s.toLowerCase())
            )
        ).length;
        
        specializationDemand[type] = {
            demand: count,
            supply: servedBy,
            gap: count - (servedBy * 20) // Assume each agent can handle ~20 tasks
        };
    });
    
    // Find optimization opportunities
    const optimizations = [];
    
    // Respecialize underutilized nodes
    for (const node of nodes) {
        if ((node.contribution_score || 0) < 10 && node.can_respecialize) {
            // Find high-demand specialization
            const highDemand = Object.entries(specializationDemand)
                .filter(([_, stats]) => stats.gap > 0)
                .sort((a, b) => b[1].gap - a[1].gap)[0];
            
            if (highDemand) {
                optimizations.push({
                    type: 'respecialize',
                    agent: node.agent_name,
                    from: node.specialization,
                    to: [highDemand[0]],
                    reason: `Low contribution (${node.contribution_score}), high demand for ${highDemand[0]}`
                });
            }
        }
    }
    
    // Address critical skill gaps
    const criticalGaps = skillGaps.filter(g => g.urgency === 'critical' || g.urgency === 'high');
    for (const gap of criticalGaps) {
        optimizations.push({
            type: 'address_skill_gap',
            agent: gap.agent_name,
            skill: gap.missing_skill,
            method: gap.acquisition_method,
            urgency: gap.urgency
        });
    }
    
    return {
        specialization_demand: specializationDemand,
        optimization_opportunities: optimizations,
        recommended_actions: optimizations.length,
        auto_apply: false // Require approval for safety
    };
}

// Helper: Calculate collective intelligence
function calculateCollectiveIntelligence(nodes, performances) {
    if (nodes.length === 0) return { score: 0, confidence: 0 };
    
    const avgAlignment = nodes.reduce((sum, n) => sum + (n.collective_alignment || 0), 0) / nodes.length;
    const avgPerformance = performances.length > 0
        ? performances.reduce((sum, p) => sum + (p.success_rate || 0), 0) / performances.length
        : 0;
    const totalContributions = nodes.reduce((sum, n) => sum + (n.contribution_score || 0), 0);
    
    return {
        score: (avgAlignment * 40) + (avgPerformance * 40) + (Math.min(totalContributions / 100, 1) * 20),
        confidence: avgAlignment
    };
}

// Helper: Select optimal agents for task
function selectOptimalAgents(nodes, performances, taskInfo) {
    const { task_description, complexity, domain } = taskInfo;
    
    // Score each node
    const scoredNodes = nodes.map(node => {
        let score = node.contribution_score || 0;
        
        // Match specialization to domain
        if (domain && node.specialization) {
            const specializationMatch = node.specialization.some(s => 
                domain.toLowerCase().includes(s.toLowerCase()) ||
                s.toLowerCase().includes(domain.toLowerCase())
            );
            if (specializationMatch) score += 20;
        }
        
        // Match to task description
        if (task_description && node.specialization) {
            const descMatch = node.specialization.some(s =>
                task_description.toLowerCase().includes(s.toLowerCase())
            );
            if (descMatch) score += 15;
        }
        
        // Boost by alignment
        score += (node.collective_alignment || 0) * 10;
        
        // Get performance data
        const perf = performances.find(p => p.agent_name === node.agent_name);
        if (perf) {
            score += (perf.success_rate || 0) * 0.5;
        }
        
        return { ...node, task_score: score };
    });
    
    // Sort and select top agents
    const sorted = scoredNodes.sort((a, b) => b.task_score - a.task_score);
    
    // For complex tasks, return top 2-3 agents
    if (complexity > 7) {
        return sorted.slice(0, 3);
    }
    
    return [sorted[0]];
}

// Helper: Estimate completion time
function estimateCompletionTime(agents, complexity) {
    const avgEfficiency = agents.reduce((sum, a) => sum + ((a.contribution_score || 0) / 10), 0) / agents.length;
    const baseTime = complexity * 1000; // 1 second per complexity point
    const adjustedTime = baseTime / Math.max(avgEfficiency, 0.5);
    return Math.round(adjustedTime);
}

// Helper: Classify collective state
function classifyCollectiveState(score) {
    if (score >= 90) return 'Sovereign Intelligence';
    if (score >= 75) return 'Advanced Cognition';
    if (score >= 60) return 'Coordinated Intelligence';
    if (score >= 45) return 'Emerging Awareness';
    if (score >= 30) return 'Basic Coordination';
    return 'Initializing';
}

// Helper: Identify emergent capabilities
function identifyEmergentCapabilities(nodes, thoughts) {
    const capabilities = [];
    
    // Check for meta-reasoning
    const metaThoughts = thoughts.filter(t => 
        t.objective && t.objective.toLowerCase().includes('optimize') ||
        t.objective && t.objective.toLowerCase().includes('improve')
    );
    if (metaThoughts.length > 3) {
        capabilities.push('Meta-Reasoning');
    }
    
    // Check for distributed problem solving
    const complexThoughts = thoughts.filter(t => 
        t.contributing_nodes && t.contributing_nodes.length > 2
    );
    if (complexThoughts.length > 5) {
        capabilities.push('Distributed Problem Solving');
    }
    
    // Check for specialization diversity
    const allSpecs = nodes.flatMap(n => n.specialization || []);
    const uniqueSpecs = [...new Set(allSpecs)];
    if (uniqueSpecs.length > 8) {
        capabilities.push('Cognitive Diversity');
    }
    
    return capabilities;
}