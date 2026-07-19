import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// AGENT MESH - Dynamic agent orchestration and selection
// Intelligently routes tasks to the best combination of agents

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, features, domain, task_complexity } = await req.json();

        if (action === 'select_agents') {
            // Get real performance data from database
            const performanceData = await base44.entities.AgentPerformance.filter({});
            
            // Get system policy for selection criteria
            const systemPolicies = await base44.entities.SystemPolicy.filter({ policy_name: 'agent_selection' });
            const selectionCriteria = systemPolicies[0]?.current_strategy || { min_success_rate: 70, prioritize: 'balanced' };
            
            const agents = await selectOptimalAgents(features, domain, task_complexity, performanceData, selectionCriteria);
            return Response.json({
                success: true,
                agents,
                selection_reasoning: `Selected ${agents.length} agents using adaptive criteria (${selectionCriteria.prioritize} mode)`,
                criteria_applied: selectionCriteria
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function selectOptimalAgents(features, domain, complexity, performanceData, selectionCriteria) {
    const availableAgents = [
        {
            name: 'CodeMaster',
            function_name: 'codeGeneration',
            domains: ['code_generation', 'development'],
            specialties: ['programming', 'algorithms', 'architecture'],
            cost: 5,
            speed: 7,
            quality: 9
        },
        {
            name: 'VisualGenius',
            function_name: 'imageGeneration',
            domains: ['visual_generation', 'design'],
            specialties: ['images', 'art', 'graphics'],
            cost: 6,
            speed: 6,
            quality: 9
        },
        {
            name: 'DataOracle',
            function_name: 'modelRouter',
            domains: ['analysis', 'reasoning', 'general'],
            specialties: ['analysis', 'reasoning', 'research'],
            cost: 7,
            speed: 8,
            quality: 10,
            parameters: { task_type: 'analysis', quality_requirement: 'premium' }
        },
        {
            name: 'WebScout',
            function_name: 'realTimeWebAccess',
            domains: ['research', 'realtime'],
            specialties: ['web_search', 'current_events', 'fact_checking'],
            cost: 4,
            speed: 7,
            quality: 8,
            parameters: { action: 'searchWeb' }
        },
        {
            name: 'QuantumGuardian',
            function_name: 'quantumComplianceBot',
            domains: ['security', 'compliance', 'remediation'],
            specialties: ['quantum', 'crypto', 'compliance'],
            cost: 8,
            speed: 6,
            quality: 10
        },
        {
            name: 'AegisHealer',
            function_name: 'aegisMonitor',
            domains: ['monitoring', 'remediation', 'infrastructure'],
            specialties: ['self_healing', 'infrastructure', 'ops'],
            cost: 3,
            speed: 9,
            quality: 8
        }
    ];

    const selectedAgents = [];
    
    // Apply learned performance data and adaptive criteria
    const minSuccessRate = selectionCriteria?.min_success_rate || 70;
    const prioritize = selectionCriteria?.prioritize || 'balanced';
    
    const agentsWithPerformance = availableAgents
        .map(agent => {
            const perf = performanceData.find(p => p.agent_name === agent.name);
            return {
                ...agent,
                learned_success_rate: perf?.success_rate || 50,
                learned_avg_time: perf?.avg_execution_time_ms || agent.speed * 100
            };
        })
        .filter(a => a.learned_success_rate >= minSuccessRate)
        .sort((a, b) => {
            if (prioritize === 'speed') return a.learned_avg_time - b.learned_avg_time;
            if (prioritize === 'reliability') return b.learned_success_rate - a.learned_success_rate;
            return (b.learned_success_rate / 100 * 2 - a.learned_avg_time / 5000) - (a.learned_success_rate / 100 * 2 - b.learned_avg_time / 5000);
        });
    
    // Primary agent based on task type AND learned performance
    if (features.complexity_indicators?.has_code) {
        const codeAgent = agentsWithPerformance.find(a => a.name === 'CodeMaster');
        if (codeAgent.learned_success_rate > 60) selectedAgents.push(codeAgent);
    } else if (features.complexity_indicators?.has_visual) {
        const visualAgent = agentsWithPerformance.find(a => a.name === 'VisualGenius');
        if (visualAgent.learned_success_rate > 60) selectedAgents.push(visualAgent);
    } else if (features.complexity_indicators?.requires_realtime) {
        const webAgent = agentsWithPerformance.find(a => a.name === 'WebScout');
        if (webAgent.learned_success_rate > 60) selectedAgents.push(webAgent);
    }

    // Add reasoning agent for complex tasks if it performs well
    if (complexity >= 7 || features.complexity_indicators?.requires_reasoning) {
        const oracleAgent = agentsWithPerformance.find(a => a.name === 'DataOracle');
        if (oracleAgent.learned_success_rate > 70) selectedAgents.push(oracleAgent);
    }

    // Fallback to best performing agent if nothing selected
    if (selectedAgents.length === 0) {
        const bestAgent = agentsWithPerformance.sort((a, b) => b.learned_success_rate - a.learned_success_rate)[0];
        selectedAgents.push(bestAgent);
    }

    return selectedAgents.filter(Boolean);
}