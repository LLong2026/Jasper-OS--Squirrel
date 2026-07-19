import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// COLLABORATION MANAGER - AI-driven agent team formation and optimization
// Proactively identifies collaboration opportunities and manages team effectiveness

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { action, task, collaboration_id } = await req.json();

        if (action === 'identify_opportunities') {
            return await identifyCollaborationOpportunities(base44, task);
        }

        if (action === 'form_team') {
            return await formDynamicTeam(base44, task);
        }

        if (action === 'delegate_tasks') {
            return await delegateTasksWithinCollaboration(base44, collaboration_id);
        }

        if (action === 'optimize_collaborations') {
            return await optimizeAllCollaborations(base44);
        }

        if (action === 'analyze_dynamics') {
            return await analyzeTeamDynamics(base44, collaboration_id);
        }

        if (action === 'predict_success') {
            return await predictCollaborationSuccess(base44, task);
        }

        if (action === 'suggest_composition') {
            return await suggestOptimalComposition(base44, task);
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function identifyCollaborationOpportunities(base44, task) {
    // Analyze task for collaboration needs
    const taskAnalysis = analyzeTaskComplexity(task);
    
    // Get all agent performance data
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({});
    
    // Check resource availability
    const resources = await base44.asServiceRole.entities.ResourcePool.filter({});
    const resourceAvailability = assessResourceAvailability(resources);

    // Identify complementary skill combinations
    const opportunities = [];

    if (taskAnalysis.requires_multiple_skills) {
        const skillCombinations = findComplementarySkills(agents, taskAnalysis);
        
        for (const combo of skillCombinations) {
            if (resourceAvailability.can_support_team) {
                opportunities.push({
                    agents: combo.agents,
                    reason: combo.reason,
                    expected_improvement: combo.score,
                    resource_feasible: true,
                    interdependencies: combo.interdependencies
                });
            }
        }
    }

    return Response.json({
        success: true,
        opportunities,
        task_analysis: taskAnalysis,
        recommendation: opportunities.length > 0 ? 'form_collaboration' : 'single_agent'
    });
}

async function formDynamicTeam(base44, task) {
    const taskAnalysis = analyzeTaskComplexity(task);
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({});
    
    // Select optimal team based on performance data and complementarity
    const team = selectOptimalTeam(agents, taskAnalysis);
    
    if (team.length < 2) {
        return Response.json({
            success: true,
            team_formed: false,
            reason: 'Single agent sufficient'
        });
    }

    // Create collaboration
    const collaboration = await base44.asServiceRole.entities.AgentCollaboration.create({
        collaboration_id: `collab_${Date.now()}`,
        agents: team.map(a => a.agent_name),
        purpose: taskAnalysis.description,
        formation_reason: 'complementary_skills',
        status: 'active',
        formed_at: Date.now(),
        performance_score: 0,
        tasks_completed: 0
    });

    // Update historical data
    await updateCollaborationHistory(base44, team.map(a => a.agent_name), taskAnalysis.skill_requirements);

    // Delegate initial tasks
    const delegation = await delegateTasksWithinCollaboration(base44, collaboration.id);

    return Response.json({
        success: true,
        team_formed: true,
        collaboration_id: collaboration.id,
        team_members: team.map(a => a.agent_name),
        delegation,
        expected_performance: calculateExpectedPerformance(team)
    });
}

async function delegateTasksWithinCollaboration(base44, collaborationId) {
    const collabs = await base44.asServiceRole.entities.AgentCollaboration.filter({ collaboration_id: collaborationId });
    
    if (collabs.length === 0) {
        return { error: 'Collaboration not found' };
    }

    const collab = collabs[0];
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({});
    
    // Get performance data for team members
    const teamPerformance = agents.filter(a => collab.agents.includes(a.agent_name));

    // Delegate based on individual strengths
    const delegations = teamPerformance.map(agent => ({
        agent: agent.agent_name,
        role: assignRole(agent, collab.formation_reason),
        responsibilities: assignResponsibilities(agent),
        resource_allocation: calculateResourceAllocation(agent, teamPerformance)
    }));

    return {
        collaboration_id: collaborationId,
        delegations,
        coordination_strategy: determineCoordinationStrategy(teamPerformance)
    };
}

async function optimizeAllCollaborations(base44) {
    const collaborations = await base44.asServiceRole.entities.AgentCollaboration.filter({ status: 'active' });
    const optimizations = [];

    for (const collab of collaborations) {
        const analysis = await analyzeCollaborationPerformance(base44, collab);
        
        if (analysis.performance_score < 5 && collab.tasks_completed > 3) {
            // Suggest dissolution
            await base44.asServiceRole.entities.AgentCollaboration.update(collab.id, {
                status: 'dissolved'
            });
            
            optimizations.push({
                collaboration_id: collab.collaboration_id,
                action: 'dissolved',
                reason: 'Underperformance - score below threshold',
                performance_score: analysis.performance_score
            });
        } else if (analysis.needs_rebalancing) {
            // Suggest improvements
            const improvements = suggestImprovements(analysis);
            
            optimizations.push({
                collaboration_id: collab.collaboration_id,
                action: 'improvement_suggested',
                improvements,
                current_score: analysis.performance_score
            });
        } else {
            optimizations.push({
                collaboration_id: collab.collaboration_id,
                action: 'maintained',
                performance_score: analysis.performance_score
            });
        }
    }

    return Response.json({
        success: true,
        collaborations_reviewed: collaborations.length,
        optimizations
    });
}

function analyzeTaskComplexity(task) {
    const text = typeof task === 'string' ? task : JSON.stringify(task);
    
    return {
        requires_multiple_skills: text.length > 200 || text.includes('and') || text.includes('both'),
        complexity_score: Math.min(text.length / 50, 10),
        description: text.substring(0, 100),
        skill_requirements: detectSkillRequirements(text)
    };
}

function detectSkillRequirements(text) {
    const skills = [];
    const lower = text.toLowerCase();
    
    if (lower.includes('code') || lower.includes('program')) skills.push('coding');
    if (lower.includes('data') || lower.includes('analyze')) skills.push('analysis');
    if (lower.includes('design') || lower.includes('visual')) skills.push('visual');
    if (lower.includes('web') || lower.includes('fetch')) skills.push('web');
    if (lower.includes('security') || lower.includes('quantum')) skills.push('security');
    
    return skills;
}

function findComplementarySkills(agents, taskAnalysis) {
    const combinations = [];
    const requiredSkills = taskAnalysis.skill_requirements;
    
    // Find agents with different specialties that cover required skills
    for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
            const agent1 = agents[i];
            const agent2 = agents[j];
            
            if (agent1.success_rate > 70 && agent2.success_rate > 70) {
                const complementarity = assessComplementarity(agent1, agent2, requiredSkills);
                
                if (complementarity.score > 0.6) {
                    combinations.push({
                        agents: [agent1.agent_name, agent2.agent_name],
                        reason: complementarity.reason,
                        score: complementarity.score,
                        interdependencies: complementarity.interdependencies
                    });
                }
            }
        }
    }
    
    return combinations.sort((a, b) => b.score - a.score).slice(0, 3);
}

function assessComplementarity(agent1, agent2, requiredSkills) {
    // Check if agents have different strengths
    const timeDiff = Math.abs(agent1.avg_execution_time_ms - agent2.avg_execution_time_ms);
    const successAvg = (agent1.success_rate + agent2.success_rate) / 2;
    
    const score = (successAvg / 100) * 0.7 + (timeDiff > 1000 ? 0.3 : 0.1);
    
    return {
        score,
        reason: 'Complementary execution profiles and success rates',
        interdependencies: requiredSkills
    };
}

function selectOptimalTeam(agents, taskAnalysis) {
    const requiredSkills = taskAnalysis.skill_requirements;
    const candidates = agents
        .filter(a => a.success_rate > 65)
        .sort((a, b) => b.success_rate - a.success_rate);
    
    if (requiredSkills.length <= 1) {
        return candidates.slice(0, 1);
    }
    
    // Select diverse team
    const team = [];
    const usedProfiles = new Set();
    
    for (const agent of candidates) {
        const profile = `${Math.floor(agent.success_rate / 10)}_${Math.floor(agent.avg_execution_time_ms / 1000)}`;
        
        if (!usedProfiles.has(profile) && team.length < 3) {
            team.push(agent);
            usedProfiles.add(profile);
        }
    }
    
    return team;
}

function assessResourceAvailability(resources) {
    const totalAvailable = resources.reduce((sum, r) => sum + (r.available / r.total_capacity), 0) / resources.length;
    
    return {
        can_support_team: totalAvailable > 0.3,
        availability_score: totalAvailable
    };
}

function assignRole(agent, formationReason) {
    if (agent.success_rate > 85) return 'lead';
    if (agent.avg_execution_time_ms < 2000) return 'executor';
    return 'specialist';
}

function assignResponsibilities(agent) {
    const role = agent.success_rate > 80 ? 'primary_execution' : 'support';
    return [role, 'monitoring', 'reporting'];
}

function calculateResourceAllocation(agent, team) {
    const totalSuccessRate = team.reduce((sum, a) => sum + a.success_rate, 0);
    const agentShare = agent.success_rate / totalSuccessRate;
    
    return {
        compute_share: Math.round(agentShare * 100),
        priority: agent.success_rate > 80 ? 'high' : 'normal'
    };
}

function determineCoordinationStrategy(team) {
    if (team.length === 2) return 'pair_programming';
    if (team.length === 3) return 'pipeline';
    return 'parallel_execution';
}

async function analyzeCollaborationPerformance(base44, collab) {
    const tasks = await base44.asServiceRole.entities.AgentTask.filter({});
    
    // Find tasks involving this collaboration
    const collabTasks = tasks.filter(t => 
        t.assigned_agents && collab.agents.every(agent => t.assigned_agents.includes(agent))
    );
    
    const completedTasks = collabTasks.filter(t => t.status === 'completed');
    const avgScore = completedTasks.reduce((sum, t) => sum + (t.feedback_score || 5), 0) / (completedTasks.length || 1);
    
    return {
        performance_score: avgScore,
        tasks_analyzed: collabTasks.length,
        needs_rebalancing: avgScore < 7 && avgScore > 4,
        efficiency: completedTasks.length / collabTasks.length
    };
}

function suggestImprovements(analysis) {
    const suggestions = [];
    
    if (analysis.performance_score < 7) {
        suggestions.push({
            type: 'skill_development',
            description: 'Consider additional training or resource allocation'
        });
    }
    
    if (analysis.efficiency < 0.7) {
        suggestions.push({
            type: 'coordination_improvement',
            description: 'Implement better task handoff protocols'
        });
    }
    
    return suggestions;
}

function calculateExpectedPerformance(team) {
    const avgSuccess = team.reduce((sum, a) => sum + a.success_rate, 0) / team.length;
    return Math.min(avgSuccess * 1.15, 100); // 15% synergy bonus
}

async function analyzeTeamDynamics(base44, collaborationId) {
    const collabs = await base44.asServiceRole.entities.AgentCollaboration.filter({ collaboration_id: collaborationId });
    
    if (collabs.length === 0) {
        return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const collab = collabs[0];
    
    // Get all tasks for this collaboration
    const tasks = await base44.asServiceRole.entities.AgentTask.filter({});
    const collabTasks = tasks.filter(t => 
        t.assigned_agents && collab.agents.every(agent => t.assigned_agents.includes(agent))
    );

    // Analyze communication patterns
    const communicationPatterns = analyzeCommunicationPatterns(collab.agents, collabTasks);
    
    // Detect task dependencies
    const dependencies = detectTaskDependencies(collabTasks);
    
    // Calculate efficiency metrics
    const handoffEfficiency = calculateHandoffEfficiency(collabTasks);
    const synergyScore = calculateSynergyScore(collab, collabTasks);
    const bottlenecks = identifyBottlenecks(collab.agents, collabTasks);

    // Store or update dynamics
    const dynamicsData = {
        collaboration_id: collaborationId,
        communication_patterns: communicationPatterns,
        task_dependencies: dependencies,
        handoff_efficiency: handoffEfficiency,
        conflict_incidents: 0,
        synergy_score: synergyScore,
        bottleneck_agents: bottlenecks
    };

    const existing = await base44.asServiceRole.entities.TeamDynamics.filter({ collaboration_id: collaborationId });
    if (existing.length > 0) {
        await base44.asServiceRole.entities.TeamDynamics.update(existing[0].id, dynamicsData);
    } else {
        await base44.asServiceRole.entities.TeamDynamics.create(dynamicsData);
    }

    return Response.json({
        success: true,
        dynamics: dynamicsData,
        insights: generateInsights(dynamicsData),
        recommendations: generateRecommendations(dynamicsData)
    });
}

async function predictCollaborationSuccess(base44, task) {
    const taskAnalysis = analyzeTaskComplexity(task);
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({});
    
    // Get optimal team
    const team = selectOptimalTeam(agents, taskAnalysis);
    
    if (team.length < 2) {
        return Response.json({
            success: true,
            prediction: {
                success_probability: team.length > 0 ? team[0].success_rate / 100 : 0.5,
                confidence: 'high',
                reason: 'Single agent task'
            }
        });
    }

    // Check historical data for this combination
    const combination = team.map(a => a.agent_name).sort().join(',');
    const history = await base44.asServiceRole.entities.CollaborationHistory.filter({ agent_combination: combination });

    let successProbability = 0.5;
    let confidence = 'low';
    let factors = [];

    if (history.length > 0) {
        const hist = history[0];
        successProbability = hist.success_rate / 100;
        confidence = hist.formation_count > 5 ? 'high' : 'medium';
        factors.push(`Historical success rate: ${hist.success_rate.toFixed(1)}%`);
        factors.push(`Based on ${hist.formation_count} previous collaborations`);
    } else {
        // Predict based on individual performance and complementarity
        const avgSuccess = team.reduce((sum, a) => sum + a.success_rate, 0) / team.length;
        const complementarity = assessTeamComplementarity(team);
        
        successProbability = (avgSuccess / 100) * 0.7 + complementarity.score * 0.3;
        confidence = 'medium';
        factors.push(`Predicted from individual performance: ${avgSuccess.toFixed(1)}%`);
        factors.push(`Complementarity score: ${complementarity.score.toFixed(2)}`);
    }

    // Adjust for task complexity
    const complexityFactor = Math.min(taskAnalysis.complexity_score / 10, 1);
    successProbability = successProbability * (1 - complexityFactor * 0.2);

    return Response.json({
        success: true,
        prediction: {
            success_probability: Math.round(successProbability * 100) / 100,
            confidence,
            team_members: team.map(a => a.agent_name),
            factors,
            risk_level: successProbability < 0.6 ? 'high' : successProbability < 0.8 ? 'medium' : 'low'
        }
    });
}

async function suggestOptimalComposition(base44, task) {
    const taskAnalysis = analyzeTaskComplexity(task);
    const agents = await base44.asServiceRole.entities.AgentPerformance.filter({});
    const allHistory = await base44.asServiceRole.entities.CollaborationHistory.filter({});

    // Find best historical combinations for this task type
    const relevantHistory = allHistory.filter(h => 
        h.task_types_handled?.some(t => taskAnalysis.skill_requirements.includes(t))
    ).sort((a, b) => b.success_rate - a.success_rate);

    const suggestions = [];

    // Suggest top 3 compositions
    for (const hist of relevantHistory.slice(0, 3)) {
        const agentNames = hist.agent_combination.split(',');
        const teamAgents = agents.filter(a => agentNames.includes(a.agent_name));
        
        if (teamAgents.length === agentNames.length) {
            suggestions.push({
                team: agentNames,
                confidence: hist.success_rate / 100,
                reason: `Proven track record: ${hist.success_rate.toFixed(1)}% success across ${hist.formation_count} collaborations`,
                expected_performance: hist.avg_performance_score,
                strategy: determineOptimalStrategy(hist)
            });
        }
    }

    // If no history, suggest based on complementarity
    if (suggestions.length === 0) {
        const team = selectOptimalTeam(agents, taskAnalysis);
        if (team.length > 1) {
            suggestions.push({
                team: team.map(a => a.agent_name),
                confidence: 0.65,
                reason: 'Suggested based on complementary skills and individual performance',
                expected_performance: calculateExpectedPerformance(team) / 10,
                strategy: 'parallel_execution'
            });
        }
    }

    return Response.json({
        success: true,
        suggestions,
        task_analysis: taskAnalysis
    });
}

function analyzeCommunicationPatterns(agents, tasks) {
    const patterns = {};
    
    for (const agent of agents) {
        patterns[agent] = {
            tasks_initiated: tasks.filter(t => t.initiated_by === agent).length,
            tasks_participated: tasks.filter(t => t.assigned_agents?.includes(agent)).length,
            interaction_frequency: Math.random() * 10 // Simulated
        };
    }
    
    return patterns;
}

function detectTaskDependencies(tasks) {
    const dependencies = [];
    
    // Analyze task sequences and timing
    for (let i = 0; i < tasks.length - 1; i++) {
        const task = tasks[i];
        const nextTask = tasks[i + 1];
        
        if (task.status === 'completed' && nextTask.status === 'in_progress') {
            dependencies.push({
                from_task: task.task_id,
                to_task: nextTask.task_id,
                dependency_type: 'sequential',
                agents_involved: [...new Set([...(task.assigned_agents || []), ...(nextTask.assigned_agents || [])])]
            });
        }
    }
    
    return dependencies;
}

function calculateHandoffEfficiency(tasks) {
    const completed = tasks.filter(t => t.status === 'completed');
    if (completed.length < 2) return 5;
    
    // Simulate efficiency based on completion patterns
    return 7 + Math.random() * 2;
}

function calculateSynergyScore(collab, tasks) {
    const avgPerformance = collab.performance_score || 5;
    const completionRate = tasks.filter(t => t.status === 'completed').length / (tasks.length || 1);
    
    return Math.min(avgPerformance * completionRate * 1.2, 10);
}

function identifyBottlenecks(agents, tasks) {
    const bottlenecks = [];
    
    for (const agent of agents) {
        const agentTasks = tasks.filter(t => t.assigned_agents?.includes(agent));
        const failedTasks = agentTasks.filter(t => t.status === 'failed');
        
        if (failedTasks.length / (agentTasks.length || 1) > 0.3) {
            bottlenecks.push(agent);
        }
    }
    
    return bottlenecks;
}

function generateInsights(dynamics) {
    const insights = [];
    
    if (dynamics.synergy_score > 7) {
        insights.push('Strong team synergy detected - collaboration is highly effective');
    } else if (dynamics.synergy_score < 5) {
        insights.push('Low synergy - team may benefit from restructuring');
    }
    
    if (dynamics.handoff_efficiency < 6) {
        insights.push('Task handoffs could be improved - consider clearer protocols');
    }
    
    if (dynamics.bottleneck_agents.length > 0) {
        insights.push(`Bottleneck detected in agents: ${dynamics.bottleneck_agents.join(', ')}`);
    }
    
    return insights;
}

function generateRecommendations(dynamics) {
    const recommendations = [];
    
    if (dynamics.bottleneck_agents.length > 0) {
        recommendations.push({
            type: 'resource_allocation',
            description: 'Allocate additional resources to bottleneck agents',
            priority: 'high'
        });
    }
    
    if (dynamics.handoff_efficiency < 6) {
        recommendations.push({
            type: 'process_improvement',
            description: 'Implement structured handoff protocols',
            priority: 'medium'
        });
    }
    
    if (dynamics.synergy_score < 5) {
        recommendations.push({
            type: 'team_restructuring',
            description: 'Consider dissolving and reforming with better complementarity',
            priority: 'high'
        });
    }
    
    return recommendations;
}

function assessTeamComplementarity(team) {
    const successVariance = Math.max(...team.map(a => a.success_rate)) - Math.min(...team.map(a => a.success_rate));
    const timeVariance = Math.max(...team.map(a => a.avg_execution_time_ms)) - Math.min(...team.map(a => a.avg_execution_time_ms));
    
    // Higher variance = more complementarity
    const score = Math.min((successVariance / 50 + timeVariance / 5000) / 2, 1);
    
    return { score };
}

function determineOptimalStrategy(history) {
    if (history.avg_task_completion_time < 5000) return 'parallel_execution';
    if (history.formation_count > 10) return 'proven_pipeline';
    return 'adaptive_coordination';
}

async function updateCollaborationHistory(base44, agentNames, taskTypes) {
    const combination = agentNames.sort().join(',');
    const history = await base44.asServiceRole.entities.CollaborationHistory.filter({ agent_combination: combination });
    
    if (history.length > 0) {
        const hist = history[0];
        await base44.asServiceRole.entities.CollaborationHistory.update(hist.id, {
            formation_count: hist.formation_count + 1,
            task_types_handled: [...new Set([...(hist.task_types_handled || []), ...taskTypes])]
        });
    } else {
        await base44.asServiceRole.entities.CollaborationHistory.create({
            agent_combination: combination,
            formation_count: 1,
            success_count: 0,
            avg_performance_score: 0,
            avg_task_completion_time: 0,
            task_types_handled: taskTypes,
            success_rate: 0
        });
    }
}