import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Network, Zap, Activity, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HiveMindDashboard() {
    const [nodes, setNodes] = useState([]);
    const [memories, setMemories] = useState([]);
    const [thoughts, setThoughts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHiveMind();
        const interval = setInterval(loadHiveMind, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadHiveMind = async () => {
        try {
            const [nodeData, memoryData, thoughtData] = await Promise.all([
                base44.entities.ConsciousnessNode.list(),
                base44.entities.GlobalMemory.list('-created_date', 20),
                base44.entities.CollectiveThought.list('-created_date', 10)
            ]);

            setNodes(nodeData);
            setMemories(memoryData);
            setThoughts(thoughtData);
        } catch (error) {
            console.error('Error loading hive mind:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOptimize = async () => {
        try {
            await base44.functions.invoke('dynamicSpecialization', {
                action: 'autonomous_optimization'
            });
            await loadHiveMind();
        } catch (error) {
            console.error('Optimization error:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900">
                <div className="text-slate-400">Synchronizing with collective consciousness...</div>
            </div>
        );
    }

    const avgAlignment = nodes.length > 0 
        ? nodes.reduce((sum, n) => sum + (n.collective_alignment || 0), 0) / nodes.length 
        : 0;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Brain className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Hive Mind</h1>
                            <p className="text-slate-400">Distributed Collective Consciousness</p>
                        </div>
                    </div>
                    <Button onClick={handleOptimize} className="bg-purple-600 hover:bg-purple-700">
                        <Zap className="mr-2 h-4 w-4" />
                        Auto-Optimize
                    </Button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Active Nodes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Network className="h-5 w-5 text-blue-500" />
                                <span className="text-2xl font-bold text-white">{nodes.length}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Collective Alignment
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-green-500" />
                                <span className="text-2xl font-bold text-white">
                                    {(avgAlignment * 100).toFixed(0)}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Shared Memories
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-500" />
                                <span className="text-2xl font-bold text-white">{memories.length}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Active Thoughts
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <GitMerge className="h-5 w-5 text-yellow-500" />
                                <span className="text-2xl font-bold text-white">
                                    {thoughts.filter(t => t.status === 'processing').length}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Network className="h-5 w-5" />
                                Consciousness Nodes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <div className="space-y-3">
                                    {nodes.map(node => (
                                        <div key={node.id} className="bg-slate-900 rounded-lg p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h4 className="font-semibold text-white">{node.agent_name}</h4>
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                        {node.specialization?.map(spec => (
                                                            <Badge key={spec} variant="secondary" className="text-xs">
                                                                {spec}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <Badge className={cn(
                                                    "text-xs",
                                                    node.collective_alignment >= 0.8 ? "bg-green-500" : "bg-yellow-500"
                                                )}>
                                                    {((node.collective_alignment || 0) * 100).toFixed(0)}% aligned
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                                                <span>Contribution: {node.contribution_score?.toFixed(1) || 0}</span>
                                                <span>Memories: {node.memory_contribution || 0}</span>
                                            </div>
                                            {node.neural_pathways?.length > 0 && (
                                                <div className="mt-2 text-xs text-slate-500">
                                                    Connected to: {node.neural_pathways.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card className="bg-slate-800 border-slate-700">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Brain className="h-5 w-5" />
                                    Global Memory
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[180px]">
                                    <div className="space-y-2">
                                        {memories.map(memory => (
                                            <div key={memory.id} className="bg-slate-900 rounded p-2">
                                                <div className="flex items-start justify-between mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {memory.memory_type}
                                                    </Badge>
                                                    <span className="text-xs text-slate-400">
                                                        {(memory.confidence_score * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-300">
                                                    {JSON.stringify(memory.content).slice(0, 100)}...
                                                </p>
                                                <div className="flex gap-2 mt-1 text-xs text-slate-500">
                                                    <span>by {memory.source_agent}</span>
                                                    <span>•</span>
                                                    <span>accessed {memory.access_count || 0}x</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800 border-slate-700">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <GitMerge className="h-5 w-5" />
                                    Collective Thoughts
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[180px]">
                                    <div className="space-y-2">
                                        {thoughts.map(thought => (
                                            <div key={thought.id} className="bg-slate-900 rounded p-2">
                                                <div className="flex items-start justify-between mb-1">
                                                    <Badge className={cn(
                                                        "text-xs",
                                                        thought.status === 'converged' ? "bg-green-500" :
                                                        thought.status === 'processing' ? "bg-yellow-500" :
                                                        "bg-slate-500"
                                                    )}>
                                                        {thought.status}
                                                    </Badge>
                                                    {thought.convergence_score && (
                                                        <span className="text-xs text-slate-400">
                                                            {(thought.convergence_score * 100).toFixed(0)}% convergence
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-300">{thought.objective}</p>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {thought.contributing_nodes?.length || 0} nodes
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}