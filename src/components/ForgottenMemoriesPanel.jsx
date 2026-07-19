import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Lightbulb, Search, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ForgottenMemoriesPanel() {
    const [context, setContext] = useState('');
    const [forgottenMemories, setForgottenMemories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);

    const searchForgottenMemories = async () => {
        if (!context.trim()) return;
        
        setLoading(true);
        try {
            const response = await base44.functions.invoke('associativeMemoryEngine', {
                action: 'surface_forgotten',
                current_context: { query: context },
                time_threshold_days: 30
            });
            
            setForgottenMemories(response.data.forgotten_memories);
            setStats({
                total: response.data.total_forgotten,
                resurfaced: response.data.resurfaced
            });
        } catch (error) {
            console.error('Failed to surface forgotten memories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRediscover = async (memoryId) => {
        // Mark memory as rediscovered by increasing access count
        try {
            await base44.entities.GlobalMemory.update(memoryId, {
                access_count: 1,
                last_accessed: Date.now()
            });
            
            // Refresh the list
            searchForgottenMemories();
        } catch (error) {
            console.error('Failed to rediscover memory:', error);
        }
    };

    return (
        <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-100">
                    <Lightbulb className="h-5 w-5 text-yellow-400" />
                    Forgotten Memory Discovery
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter context to find relevant forgotten memories..."
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchForgottenMemories()}
                        className="bg-slate-700 border-slate-600 text-slate-100"
                    />
                    <Button 
                        onClick={searchForgottenMemories}
                        disabled={loading || !context.trim()}
                        className="bg-yellow-600 hover:bg-yellow-700"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                </div>

                {stats && (
                    <div className="flex gap-4 text-sm text-slate-400">
                        <div>Total forgotten: {stats.total}</div>
                        <div className="text-yellow-400">Resurfaced: {stats.resurfaced}</div>
                    </div>
                )}

                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {forgottenMemories.length > 0 ? (
                        forgottenMemories.map((memory) => (
                            <div
                                key={memory.id}
                                className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <Badge variant="outline" className="text-xs">
                                        {memory.memory_type}
                                    </Badge>
                                    <div className="flex items-center gap-2 text-xs text-yellow-400">
                                        <TrendingUp className="h-3 w-3" />
                                        {(memory.rediscovery_score * 100).toFixed(0)}% relevant
                                    </div>
                                </div>
                                
                                <div className="text-sm text-slate-300 mb-2">
                                    Source: {memory.source_agent}
                                </div>
                                
                                <div className="text-xs text-slate-400 mb-2">
                                    Last accessed: {memory.last_accessed 
                                        ? new Date(memory.last_accessed).toLocaleDateString()
                                        : 'Never'}
                                </div>

                                {memory.tags && memory.tags.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mb-2">
                                        {memory.tags.slice(0, 4).map((tag, idx) => (
                                            <Badge key={idx} className="text-xs bg-slate-600">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRediscover(memory.id)}
                                    className="w-full mt-2 text-yellow-400 border-yellow-600 hover:bg-yellow-600/20"
                                >
                                    Rediscover & Apply
                                </Button>
                            </div>
                        ))
                    ) : context && !loading ? (
                        <div className="text-center text-slate-500 py-8">
                            No forgotten memories relevant to this context
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-8">
                            Enter context to discover forgotten memories
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}