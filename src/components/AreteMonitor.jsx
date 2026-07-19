import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Cpu, Zap, Brain, Shield, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AreteMonitor() {
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
        // Simulate real-time metrics
        const interval = setInterval(() => {
            setMetrics(prev => ({
                total_tasks: prev.total_tasks + Math.floor(Math.random() * 3),
                active_agents: 6,
                avg_response_time: 150 + Math.random() * 100,
                learning_cycles: prev.learning_cycles + (Math.random() > 0.9 ? 1 : 0),
                success_rate: 94 + Math.random() * 5,
                model_version: `v${Math.floor(prev.learning_cycles / 10)}`
            }));

            if (Math.random() > 0.7) {
                setRecentActivity(prev => [
                    {
                        id: Date.now(),
                        action: ['Task processed', 'Model trained', 'Agent deployed', 'Safety check passed'][Math.floor(Math.random() * 4)],
                        timestamp: Date.now()
                    },
                    ...prev.slice(0, 4)
                ]);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed bottom-20 right-4 w-80 bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                    <Brain className="h-4 w-4" />
                    ARETE Monitor
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <MetricCard
                        icon={Activity}
                        label="Tasks"
                        value={metrics.total_tasks}
                        color="text-green-400"
                    />
                    <MetricCard
                        icon={Cpu}
                        label="Agents"
                        value={metrics.active_agents}
                        color="text-blue-400"
                    />
                    <MetricCard
                        icon={Zap}
                        label="Avg Time"
                        value={`${Math.round(metrics.avg_response_time)}ms`}
                        color="text-yellow-400"
                    />
                    <MetricCard
                        icon={TrendingUp}
                        label="Success"
                        value={`${metrics.success_rate.toFixed(1)}%`}
                        color="text-emerald-400"
                    />
                </div>

                <div className="pt-2 border-t border-slate-700">
                    <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-400">Learning Cycles</span>
                        <span className="text-purple-400 font-mono">{metrics.learning_cycles}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Model Version</span>
                        <span className="text-cyan-400 font-mono">{metrics.model_version}</span>
                    </div>
                </div>

                {recentActivity.length > 0 && (
                    <div className="pt-2 border-t border-slate-700">
                        <div className="text-xs text-slate-400 mb-1">Recent Activity</div>
                        <div className="space-y-1 max-h-20 overflow-auto">
                            {recentActivity.map(activity => (
                                <div key={activity.id} className="text-xs text-slate-300 flex items-center gap-1">
                                    <div className="h-1 w-1 rounded-full bg-green-400" />
                                    {activity.action}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-slate-800/50 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
                <Icon className={`h-3 w-3 ${color}`} />
                <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
        </div>
    );
}