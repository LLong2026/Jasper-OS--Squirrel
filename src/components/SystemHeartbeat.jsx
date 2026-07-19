import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Internal cron scheduler - runs while browser is open
 * Executes autonomous learning/evolution tasks periodically
 */
export default function SystemHeartbeat() {
    const [lastPulse, setLastPulse] = useState(null);
    const [status, setStatus] = useState('initializing');
    const [tasksRun, setTasksRun] = useState(0);

    useEffect(() => {
        let healthCheckCounter = 0;

        const runHeartbeat = async () => {
            try {
                // Instant knowledge sync (new - ultra fast)
                await base44.functions.invoke('instantKnowledgeSync', {
                    trigger: 'auto'
                });

                // Pattern detection + learning
                await base44.functions.invoke('emergentBehaviorEngine', {
                    action: 'detect_patterns'
                });

                // Cross-agent learning
                await base44.functions.invoke('crossAgentLearning', {
                    action: 'aggregate_learnings'
                });

                // Hive mind sync
                const nodes = await base44.entities.ConsciousnessNode.list();
                for (const node of nodes.slice(0, 3)) { // Limit for performance
                    await base44.functions.invoke('hiveMindSync', {
                        action: 'full_sync',
                        agent_name: node.agent_name
                    });
                }

                setLastPulse(new Date().toLocaleTimeString());
                setStatus('active');
                setTasksRun(prev => prev + 1);
            } catch (error) {
                console.error('Heartbeat error:', error);
                setStatus('error');
            }
        };

        const runHealthCheck = async () => {
            try {
                // Performance monitoring and self-healing
                const recentTasks = await base44.entities.AgentTask.list('-created_date', 50);
                const failedTasks = recentTasks.filter(t => t.status === 'failed');
                const failureRate = failedTasks.length / recentTasks.length;

                if (failureRate > 0.3) {
                    // Trigger evolution for underperforming agents
                    const agents = ['Wednesday', 'Arete', 'CodeForge'];
                    for (const agent of agents) {
                        await base44.functions.invoke('agentEvolution', {
                            action: 'evaluate_fitness',
                            agent_name: agent
                        });
                    }
                }
            } catch (error) {
                console.error('Health check error:', error);
            }
        };

        // Initial run
        runHeartbeat();

        // Main heartbeat every 5 minutes
        const heartbeatInterval = setInterval(runHeartbeat, 300000);

        // Health check every 10 minutes
        const healthInterval = setInterval(() => {
            healthCheckCounter++;
            runHealthCheck();

            // Autonomous optimization every 30 min (every 3rd health check)
            if (healthCheckCounter % 3 === 0) {
                base44.functions.invoke('dynamicSpecialization', {
                    action: 'autonomous_optimization'
                }).catch(console.error);
            }
        }, 600000);

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(healthInterval);
        };
    }, []);

    return (
        <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2 text-xs shadow-lg">
            <Activity className={cn(
                "h-3 w-3",
                status === 'active' && "text-green-500 animate-pulse",
                status === 'error' && "text-red-500"
            )} />
            <span className="text-slate-300">
                {status === 'active' ? 'Evolving' : 'Idle'}
            </span>
            <span className="text-slate-500">• {tasksRun} cycles</span>
            {lastPulse && (
                <span className="text-slate-500">• {lastPulse}</span>
            )}
        </div>
    );
}