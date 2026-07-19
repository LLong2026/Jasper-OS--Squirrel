import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Cpu, Zap, Brain, Shield, TrendingUp, Network } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LearningSignalsLive from '@/components/LearningSignalsLive';

export default function AreteMonitorPage() {
    const [metrics, setMetrics] = useState({
        total_tasks: 0,
        active_agents: 6,
        avg_response_time: 0,
        learning_cycles: 0,
        success_rate: 0,
        model_version: 'v0'
    });

    const [recentActivity, setRecentActivity] = useState([]);

    useEffect(() => {
        const fetchRealMetrics = async () => {
            try {
                // Get real learning signals
                const learningSignals = await base44.entities.LearningSignal.list('-created_date', 1000);
                
                // Get agent performance data
                const agentPerf = await base44.entities.AgentPerformance.list();
                
                // Get active agents
                const nodes = await base44.entities.ConsciousnessNode.list();
                
                // Get recent tasks
                const tasks = await base44.entities.AgentTask.list('-created_date', 100);
                
                // Calculate metrics
                const totalTasks = tasks.length;
                const activeAgents = nodes.filter(n => n.is_active).length;
                const avgResponseTime = tasks.length > 0 
                    ? tasks.reduce((acc, t) => acc + (t.execution_time_ms || 0), 0) / tasks.length 
                    : 0;
                const learningCycles = learningSignals.length;
                const successRate = agentPerf.length > 0
                    ? agentPerf.reduce((acc, p) => acc + (p.success_rate || 0), 0) / agentPerf.length
                    : 0;
                
                setMetrics({
                    total_tasks: totalTasks,
                    active_agents: activeAgents,
                    avg_response_time: avgResponseTime,
                    learning_cycles: learningCycles,
                    success_rate: successRate,
                    model_version: `v${Math.floor(learningCycles / 100)}`
                });

                // Get recent audit logs for activity
                const auditLogs = await base44.entities.AuditLog.list('-created_date', 10);
                setRecentActivity(auditLogs.map(log => ({
                    id: log.id,
                    action: log.event_type,
                    timestamp: log.timestamp
                })));
                
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
            }
        };

        fetchRealMetrics();
        const interval = setInterval(fetchRealMetrics, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full bg-slate-900 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-8">
                    <Brain className="h-8 w-8 text-blue-400" />
                    <h1 className="text-3xl font-bold text-white">ARETE Monitor</h1>
                    <span className="text-sm text-slate-400">Recursive Self-Learning System</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        icon={Activity}
                        label="Total Tasks"
                        value={metrics.total_tasks}
                        color="text-green-400"
                        bgColor="bg-green-500/10"
                    />
                    <MetricCard
                        icon={Cpu}
                        label="Active Agents"
                        value={metrics.active_agents}
                        color="text-blue-400"
                        bgColor="bg-blue-500/10"
                    />
                    <MetricCard
                        icon={Zap}
                        label="Avg Response Time"
                        value={`${Math.round(metrics.avg_response_time)}ms`}
                        color="text-yellow-400"
                        bgColor="bg-yellow-500/10"
                    />
                    <MetricCard
                        icon={TrendingUp}
                        label="Success Rate"
                        value={`${metrics.success_rate.toFixed(1)}%`}
                        color="text-emerald-400"
                        bgColor="bg-emerald-500/10"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-400" />
                                Learning Metrics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Learning Cycles</span>
                                <span className="text-purple-400 font-mono font-bold text-xl">{metrics.learning_cycles}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Model Version</span>
                                <span className="text-cyan-400 font-mono font-bold text-xl">{metrics.model_version}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <Network className="h-5 w-5 text-blue-400" />
                                Agent Fleet
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {['CodeMaster', 'VisualGenius', 'DataOracle', 'WebScout', 'QuantumGuardian', 'AegisHealer'].map((agent, idx) => (
                                    <div key={agent} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                                        <span className="text-slate-300 text-sm">{agent}</span>
                                        <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentActivity.length > 0 ? (
                            <div className="space-y-2">
                                {recentActivity.map(activity => (
                                    <div key={activity.id} className="flex items-center gap-3 p-2 bg-slate-700/30 rounded">
                                        <div className="h-2 w-2 rounded-full bg-green-400" />
                                        <span className="text-slate-300 text-sm">{activity.action}</span>
                                        <span className="text-slate-500 text-xs ml-auto font-mono">
                                            {new Date(activity.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-8">
                                Waiting for activity...
                            </div>
                        )}
                    </CardContent>
                </Card>

                <LearningSignalsLive />
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color, bgColor }) {
    return (
        <Card className={`bg-slate-800 border-slate-700 ${bgColor}`}>
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                    <Icon className={`h-6 w-6 ${color}`} />
                    <span className="text-sm text-slate-400">{label}</span>
                </div>
                <div className={`text-3xl font-mono font-bold ${color}`}>{value}</div>
            </CardContent>
        </Card>
    );
}