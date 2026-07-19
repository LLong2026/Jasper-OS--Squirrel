import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, CheckCircle2, Terminal } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SystemStatus() {
    const [secret, setSecret] = useState('');
    const [lastResult, setLastResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const triggerHeartbeat = async () => {
        setLoading(true);
        try {
            const result = await base44.functions.invoke('autonomousHeartbeat', { secret });
            setLastResult(result);
        } catch (error) {
            setLastResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const triggerHealthCheck = async () => {
        setLoading(true);
        try {
            const result = await base44.functions.invoke('performanceTrigger', { secret });
            setLastResult(result);
        } catch (error) {
            setLastResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">System Status</h1>
                    <p className="text-slate-400">Autonomous evolution and self-healing control</p>
                </div>

                <Card className="bg-slate-800 border-slate-700 mb-6">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Terminal className="h-5 w-5" />
                            Manual Triggers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">
                                Heartbeat Secret (set HEARTBEAT_SECRET in environment)
                            </label>
                            <Input
                                type="password"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                placeholder="Enter secret..."
                                className="bg-slate-900 border-slate-700"
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button 
                                onClick={triggerHeartbeat}
                                disabled={!secret || loading}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Activity className="mr-2 h-4 w-4" />
                                Trigger Heartbeat
                            </Button>
                            <Button 
                                onClick={triggerHealthCheck}
                                disabled={!secret || loading}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                <AlertCircle className="mr-2 h-4 w-4" />
                                Health Check
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {lastResult && (
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                {lastResult.error ? (
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                )}
                                Last Result
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-slate-900 rounded p-4 text-xs text-slate-300 overflow-auto max-h-96">
                                {JSON.stringify(lastResult, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}

                <Card className="bg-slate-800 border-slate-700 mt-6">
                    <CardHeader>
                        <CardTitle className="text-white">Setup Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-300">
                        <div>
                            <h4 className="font-semibold text-white mb-2">1. Set Environment Variable</h4>
                            <p className="text-slate-400">In your dashboard settings, add:</p>
                            <code className="block bg-slate-900 rounded p-2 mt-1 text-xs">
                                HEARTBEAT_SECRET=your-secret-key-here
                            </code>
                        </div>

                        <div>
                            <h4 className="font-semibold text-white mb-2">2. Configure External Cron (Recommended)</h4>
                            <p className="text-slate-400">Use a service like cron-job.org to call autonomousHeartbeat every 5 minutes:</p>
                            <code className="block bg-slate-900 rounded p-2 mt-1 text-xs">
                                POST https://your-app-url/functions/autonomousHeartbeat
                                <br/>
                                Body: {JSON.stringify({ secret: "your-secret" })}
                            </code>
                        </div>

                        <div>
                            <h4 className="font-semibold text-white mb-2">What Runs Automatically:</h4>
                            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-2">
                                <li>Emergent pattern detection (every heartbeat)</li>
                                <li>Agent fitness evaluation (every 10 min)</li>
                                <li>Cross-agent learning aggregation (every heartbeat)</li>
                                <li>Hive mind synchronization (every heartbeat)</li>
                                <li>Autonomous optimization (every 30 min)</li>
                                <li>Memory decay (unused memories fade)</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}