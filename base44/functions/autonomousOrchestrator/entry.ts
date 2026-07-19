import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// AUTONOMOUS ORCHESTRATOR - Agents initiate and manage their own tasks
// Enables self-directed operations, resource requests, and dynamic collaborations

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { 
            action, 
            agent_name, 
            task_proposal,
            resource_request,
            collaboration_request 
        } = await req.json();

        if (action === 'propose_task') {
            return await handleTaskProposal(base44, agent_name, task_proposal);
        }

        if (action === 'request_resources') {
            return await handleResourceRequest(base44, agent_name, resource_request);
        }

        if (action === 'form_collaboration') {
            return await handleCollaborationRequest(base44, agent_name, collaboration_request);
        }

        if (action === 'monitor_and_act') {
            return await monitorAndInitiateTasks(base44);
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function handleTaskProposal(base44, agentName, proposal) {
    // Evaluate if task should be approved autonomously
    const performanceData = await base44.asServiceRole.entities.AgentPerformance.filter({ agent_name: agentName });
    const agent = performanceData[0];

    // Auto-approve if agent has good track record
    const approved = !agent || agent.success_rate > 75;

    if (approved) {
        // Use collaboration manager to identify opportunities
        const collabAnalysis = await base44.functions.invoke('collaborationManager', {
            action: 'identify_opportunities',
            task: proposal
        });

        let collaborators = [];
        let collaborationId = null;

        if (collabAnalysis.recommendation === 'form_collaboration') {
            // Form dynamic team via collaboration manager
            const teamResult = await base44.functions.invoke('collaborationManager', {
                action: 'form_team',
                task: proposal
            });

            if (teamResult.team_formed) {
                collaborators = teamResult.team_members.filter(m => m !== agentName);
                collaborationId = teamResult.collaboration_id;
            }
        }

        const task = await base44.asServiceRole.entities.AgentTask.create({
            task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            initiated_by: agentName,
            task_type: proposal.task_type,
            priority: proposal.priority || 5,
            status: 'pending',
            assigned_agents: [agentName, ...collaborators],
            required_resources: proposal.resources || {}
        });

        // Allocate resources
        await allocateResources(base44, task.id, proposal.resources || {});

        return Response.json({
            success: true,
            approved: true,
            task_id: task.id,
            assigned_agents: task.assigned_agents,
            collaboration_id: collaborationId,
            message: collaborationId ? 'Task approved with team collaboration' : 'Task approved and resources allocated'
        });
    }

    return Response.json({
        success: true,
        approved: false,
        reason: 'Agent performance below threshold for autonomous task approval'
    });
}

async function handleResourceRequest(base44, agentName, request) {
    const { resource_type, amount, duration_ms } = request;

    // Check resource availability
    const pools = await base44.asServiceRole.entities.ResourcePool.filter({ resource_type });
    
    if (pools.length === 0) {
        return Response.json({ 
            success: false, 
            error: 'Resource type not available' 
        }, { status: 404 });
    }

    const pool = pools[0];
    
    if (pool.available >= amount) {
        // Allocate resource
        const allocation = {
            agent: agentName,
            amount,
            allocated_at: Date.now(),
            expires_at: Date.now() + duration_ms
        };

        const allocations = pool.allocations || [];
        allocations.push(allocation);

        await base44.asServiceRole.entities.ResourcePool.update(pool.id, {
            allocated: pool.allocated + amount,
            available: pool.available - amount,
            allocations
        });

        return Response.json({
            success: true,
            granted: true,
            resource_type,
            amount,
            expires_at: allocation.expires_at
        });
    }

    return Response.json({
        success: true,
        granted: false,
        reason: 'Insufficient resources available'
    });
}

async function handleCollaborationRequest(base44, agentName, request) {
    const { target_agents, purpose, reason } = request;

    // Check if proposed agents have complementary skills
    const performanceData = await base44.asServiceRole.entities.AgentPerformance.filter({});
    const compatibility = assessCollaborationCompatibility(agentName, target_agents, performanceData);

    if (compatibility.score > 0.7) {
        const collaboration = await base44.asServiceRole.entities.AgentCollaboration.create({
            collaboration_id: `collab_${Date.now()}`,
            agents: [agentName, ...target_agents],
            purpose,
            formation_reason: reason,
            status: 'active',
            formed_at: Date.now(),
            performance_score: 0,
            tasks_completed: 0
        });

        return Response.json({
            success: true,
            approved: true,
            collaboration_id: collaboration.id,
            compatibility_score: compatibility.score,
            agents: collaboration.agents
        });
    }

    return Response.json({
        success: true,
        approved: false,
        reason: 'Low collaboration compatibility',
        compatibility_score: compatibility.score
    });
}

async function monitorAndInitiateTasks(base44) {
    // Autonomous monitoring - agents detect issues and create tasks
    const issues = await detectSystemIssues(base44);
    const initiatedTasks = [];

    for (const issue of issues) {
        const bestAgent = await selectBestAgentForIssue(base44, issue);
        
        const task = await base44.asServiceRole.entities.AgentTask.create({
            task_id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            initiated_by: bestAgent,
            task_type: 'healing',
            priority: issue.severity,
            status: 'pending',
            assigned_agents: [bestAgent],
            required_resources: { compute: 100, memory: 512 }
        });

        initiatedTasks.push(task);
    }

    return Response.json({
        success: true,
        issues_detected: issues.length,
        tasks_initiated: initiatedTasks.length,
        tasks: initiatedTasks
    });
}

async function findOptimalCollaborators(base44, proposal) {
    const performanceData = await base44.asServiceRole.entities.AgentPerformance.filter({});
    
    // Select agents based on task requirements and their specialties
    const candidates = performanceData
        .filter(p => p.success_rate > 70)
        .sort((a, b) => b.success_rate - a.success_rate)
        .slice(0, 2)
        .map(p => p.agent_name);

    return candidates;
}

async function allocateResources(base44, taskId, resources) {
    for (const [resourceType, amount] of Object.entries(resources)) {
        const pools = await base44.asServiceRole.entities.ResourcePool.filter({ resource_type: resourceType });
        
        if (pools.length > 0 && pools[0].available >= amount) {
            await base44.asServiceRole.entities.ResourcePool.update(pools[0].id, {
                allocated: pools[0].allocated + amount,
                available: pools[0].available - amount
            });
        }
    }
}

function assessCollaborationCompatibility(initiator, targets, performanceData) {
    // Simulate compatibility assessment
    const score = 0.8 + Math.random() * 0.2;
    return { score, reason: 'Complementary specializations detected' };
}

async function detectSystemIssues(base44) {
    // Simulate system monitoring
    const shouldDetectIssue = Math.random() > 0.7;
    
    if (shouldDetectIssue) {
        return [{
            type: 'performance_degradation',
            severity: 7,
            description: 'Response time above threshold'
        }];
    }
    
    return [];
}

async function selectBestAgentForIssue(base44, issue) {
    const agents = ['AegisHealer', 'QuantumGuardian', 'DataOracle'];
    return agents[Math.floor(Math.random() * agents.length)];
}