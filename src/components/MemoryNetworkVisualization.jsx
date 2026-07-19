import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Link as LinkIcon, TrendingUp, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function MemoryNetworkVisualization({ rootMemoryId }) {
    const [network, setNetwork] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        if (!rootMemoryId) return;
        
        const loadNetwork = async () => {
            try {
                const response = await base44.functions.invoke('associativeMemoryEngine', {
                    action: 'get_memory_network',
                    root_memory_id: rootMemoryId,
                    depth: 2
                });
                setNetwork(response.data);
            } catch (error) {
                console.error('Failed to load memory network:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNetwork();
    }, [rootMemoryId]);

    if (loading) {
        return (
            <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 text-center text-slate-400">
                    Loading memory network...
                </CardContent>
            </Card>
        );
    }

    if (!network) {
        return (
            <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 text-center text-slate-400">
                    No memory network data available
                </CardContent>
            </Card>
        );
    }

    const getNodeColor = (node) => {
        if (node.confidence > 0.8) return 'bg-green-500';
        if (node.confidence > 0.5) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-100">
                    <Brain className="h-5 w-5 text-purple-400" />
                    Memory Association Network
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        {network.total_nodes} nodes
                    </div>
                    <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        {network.total_edges} connections
                    </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {network.nodes.map((node) => (
                        <div
                            key={node.id}
                            onClick={() => setSelectedNode(node)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedNode?.id === node.id
                                    ? 'bg-slate-700 border-purple-500'
                                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                            }`}
                            style={{ marginLeft: `${node.depth * 20}px` }}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`h-2 w-2 rounded-full ${getNodeColor(node)}`} />
                                        <Badge variant="outline" className="text-xs">
                                            {node.type}
                                        </Badge>
                                        <span className="text-xs text-slate-400">
                                            Depth: {node.depth}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        Source: {node.source}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            {node.access_count || 0} accesses
                                        </span>
                                        <span>
                                            Confidence: {((node.confidence || 0) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    {node.tags && node.tags.length > 0 && (
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                            {node.tags.slice(0, 3).map((tag, idx) => (
                                                <Badge key={idx} className="text-xs bg-purple-500/20 text-purple-400">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedNode && (
                    <div className="mt-4 p-3 bg-slate-700 rounded-lg border border-purple-500">
                        <div className="text-sm font-medium text-slate-200 mb-2">
                            Selected Memory Details
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                            <div>ID: {selectedNode.id}</div>
                            <div>Type: {selectedNode.type}</div>
                            <div>Source: {selectedNode.source}</div>
                            <div>Confidence: {((selectedNode.confidence || 0) * 100).toFixed(1)}%</div>
                            <div>Network Depth: {selectedNode.depth}</div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}