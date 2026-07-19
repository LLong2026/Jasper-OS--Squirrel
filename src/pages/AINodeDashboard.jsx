import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Network, 
    Cpu, 
    Activity, 
    Users, 
    Zap, 
    CheckCircle2, 
    AlertCircle,
    TrendingUp,
    GitBranch
} from 'lucide-react';

export default function AINodeDashboard() {
    const [nodes, setNodes] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [collaborations, setCollaborations] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = async () => {
        try {
            const [nodesData, tasksData, collabsData, resourcesData] = await Promise.all([
                base44.entities.Node.list(),
                base44.entities.AgentTask.list('-created_date', 20),
                base44.entities.AgentCollaboration.filter({ status: 'active' }),
                base44.entities.ResourcePool.list()
            ]);

            setNodes(nodesData);
            setTasks(tasksData);
            setCollaborations(collabsData);
            setResources(resourcesData);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const triggerAutonomousScheduler = async () => {
        try {
            const result = await base44.functions.invoke('autonomousScheduler', { trigger: 'manual' });
            console.log('Scheduler result:', result);
            setTimeout(loadDashboardData, 1000);
        } catch (error) {
            console.error('Error triggering scheduler:', error);
            alert('Scheduler error: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="h-full bg-slate-900 flex items-center justify-center">
                <div className="text-slate-400">Loading autonomous systems...</div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-900 p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Network className="h-8 w-8 text-blue-400" />
                        <div>
                            <h1 className="text-3xl font-bold text-white">Autonomous AI Network</h1>
                            <p className="text-sm text-slate-400">Self-managing distributed intelligence</p>
                        </div>
                    </div>
                    <Button onClick={triggerAutonomousScheduler} className="bg-blue-600 hover:bg-blue-700">
                        <Zap className="h-4 w-4 mr-2" />
                        Run Scheduler
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard
                        icon={Network}
                        label="Active Nodes"
                        value={nodes.filter(n => n.status === 'active').length}
                        total={nodes.length}
                        color="text-blue-400"
                    />
                    <MetricCard
                        icon={Activity}
                        label="Running Tasks"
                        value={tasks.filter(t => t.status === 'in_progress').length}
                        total={tasks.length}
                        color="text-green-400"
                    />
                    <MetricCard
                        icon={Users}
                        label="Collaborations"
                        value={collaborations.length}
                        color="text-purple-400"
                    />
                    <MetricCard
                        icon={TrendingUp}
                        label="Avg Performance"
                        value={`${Math.round(collaborations.reduce((acc, c) => acc + (c.performance_score || 0), 0) / (collaborations.length || 1) * 10)}%`}
                        color="text-emerald-400"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Cpu className="h-5 w-5 text-blue-400" />
                                Node Network
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {nodes.slice(0, 5).map(node => (
                                    <div key={node.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2 w-2 rounded-full ${
                                                node.status === 'active' ? 'bg-green-400' : 
                                                node.status === 'degraded' ? 'bg-yellow-400' : 
                                                'bg-red-400'
                                            }`} />
                                            <div>
                                                <div className="text-sm font-medium text-white">{node.node_id}</div>
                                                <div className="text-xs text-slate-400">{node.node_type}</div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {node.capabilities?.length || 0} caps
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <GitBranch className="h-5 w-5 text-purple-400" />
                                Active Collaborations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {collaborations.slice(0, 5).map(collab => (
                                    <div key={collab.id} className="p-3 bg-slate-700/50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-medium text-white">{collab.purpose}</div>
                                            <Badge variant="outline" className="text-xs">
                                                Score: {(collab.performance_score || 0).toFixed(1)}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {collab.agents.map(agent => (
                                                <Badge key={agent} className="text-xs bg-purple-500/20 text-purple-300">
                                                    {agent}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2">
                                            {collab.tasks_completed || 0} tasks completed
                                        </div>
                                    </div>
                                ))}
                                {collaborations.length === 0 && (
                                    <div className="text-center text-slate-500 py-8">
                                        No active collaborations
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Autonomous Task Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {tasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {task.status === 'completed' ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                                        ) : task.status === 'failed' ? (
                                            <AlertCircle className="h-4 w-4 text-red-400" />
                                        ) : (
                                            <Activity className="h-4 w-4 text-blue-400 animate-pulse" />
                                        )}
                                        <div>
                                            <div className="text-sm text-white">{task.task_type}</div>
                                            <div className="text-xs text-slate-400">
                                                Initiated by {task.initiated_by}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className={`text-xs ${
                                            task.priority >= 7 ? 'bg-red-500/20 text-red-300' :
                                            task.priority >= 5 ? 'bg-yellow-500/20 text-yellow-300' :
                                            'bg-blue-500/20 text-blue-300'
                                        }`}>
                                            P{task.priority}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                            {task.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Resource Pools</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {resources.map(resource => (
                                <div key={resource.id} className="p-4 bg-slate-700/50 rounded-lg">
                                    <div className="text-sm font-medium text-white mb-2">{resource.resource_type}</div>
                                    <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                                        <div 
                                            className="bg-blue-400 h-2 rounded-full transition-all"
                                            style={{ width: `${(resource.allocated / resource.total_capacity) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Used: {resource.allocated}</span>
                                        <span>Total: {resource.total_capacity}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, total, color }) {
    return (
        <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <span className="text-sm text-slate-400">{label}</span>
                </div>
                <div className={`text-3xl font-bold ${color}`}>
                    {value}
                    {total && <span className="text-lg text-slate-500">/{total}</span>}
                </div>
            </CardContent>
        </Card>
    );
}