import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function LearningSignalsLive() {
    const [signals, setSignals] = useState([]);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });

    useEffect(() => {
        const fetchSignals = async () => {
            try {
                const data = await base44.entities.LearningSignal.list('-created_date', 50);
                setSignals(data);
                
                const successCount = data.filter(s => s.success).length;
                setStats({
                    total: data.length,
                    success: successCount,
                    failed: data.length - successCount
                });
            } catch (error) {
                console.error('Failed to fetch learning signals:', error);
            }
        };

        fetchSignals();
        const interval = setInterval(fetchSignals, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-100">
                    <Brain className="h-5 w-5 text-blue-400" />
                    Live Learning Signals
                </CardTitle>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500/20 text-blue-400">
                            Total: {stats.total}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/20 text-green-400">
                            ✓ {stats.success}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-red-500/20 text-red-400">
                            ✗ {stats.failed}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                        {signals.map((signal) => {
                            let features = {};
                            try {
                                features = typeof signal.features === 'string' 
                                    ? JSON.parse(signal.features) 
                                    : signal.features || {};
                            } catch (e) {
                                console.error('Parse error:', e);
                            }

                            return (
                                <div 
                                    key={signal.id} 
                                    className="bg-slate-800/50 rounded-lg p-3 border border-slate-700"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {signal.success ? (
                                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-400" />
                                                )}
                                                <span className="text-sm font-medium text-slate-200">
                                                    {signal.agents_used?.[0] || 'Unknown Agent'}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {signal.task_type}
                                                </Badge>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {signal.execution_time_ms}ms
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <TrendingUp className="h-3 w-3" />
                                                    Quality: {signal.outcome_quality || 'N/A'}
                                                </span>
                                                {signal.user_feedback && (
                                                    <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                                        {signal.user_feedback}
                                                    </Badge>
                                                )}
                                            </div>

                                            {features.interaction_type && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {features.interaction_type}
                                                </div>
                                            )}
                                        </div>

                                        <span className="text-xs text-slate-500">
                                            {new Date(signal.created_date).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}