import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Clock, Link as LinkIcon, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function BlockchainTimeline({ assetId }) {
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [integrity, setIntegrity] = useState(null);

    useEffect(() => {
        if (assetId) {
            loadBlockchainHistory();
        }
    }, [assetId]);

    const loadBlockchainHistory = async () => {
        try {
            setLoading(true);
            
            const [historyResult, integrityResult] = await Promise.all([
                base44.functions.invoke('assetBlockchainAnchor', {
                    action: 'get_asset_history',
                    asset_id: assetId
                }),
                base44.functions.invoke('assetBlockchainAnchor', {
                    action: 'verify_asset_integrity',
                    asset_id: assetId
                })
            ]);

            setTimeline(historyResult.data?.timeline || []);
            setIntegrity(integrityResult.data);
        } catch (error) {
            console.error('Failed to load blockchain history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-8 text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-400">Loading blockchain history...</p>
                </CardContent>
            </Card>
        );
    }

    const getEventIcon = (event) => {
        if (event.type === 'covenant') return <Shield className="w-5 h-5" />;
        if (event.operation === 'create') return <FileText className="w-5 h-5" />;
        if (event.operation === 'transfer') return <LinkIcon className="w-5 h-5" />;
        return <Clock className="w-5 h-5" />;
    };

    const getEventColor = (event) => {
        if (event.type === 'covenant') return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        if (event.operation === 'transfer') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    };

    return (
        <div className="space-y-6">
            {/* Integrity Status */}
            {integrity && (
                <Card className={`border ${integrity.integrity_valid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            {integrity.integrity_valid ? (
                                <>
                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                    <div>
                                        <p className="font-semibold text-green-400">Blockchain Integrity Verified</p>
                                        <p className="text-sm text-slate-400">{integrity.blockchain_events} blockchain events recorded</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-6 h-6 text-red-400" />
                                    <div>
                                        <p className="font-semibold text-red-400">Integrity Issues Detected</p>
                                        <p className="text-sm text-slate-400">{integrity.discrepancies?.length} discrepancies found</p>
                                    </div>
                                </>
                            )}
                            <Button onClick={loadBlockchainHistory} variant="outline" size="sm" className="ml-auto">
                                Refresh
                            </Button>
                        </div>
                        {!integrity.integrity_valid && integrity.discrepancies && (
                            <div className="mt-3 space-y-1">
                                {integrity.discrepancies.map((d, i) => (
                                    <p key={i} className="text-sm text-red-300 pl-9">• {d}</p>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Timeline */}
            <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-100">
                        <Shield className="w-5 h-5 text-blue-400" />
                        Blockchain Transaction History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {timeline.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">No blockchain events recorded</p>
                    ) : (
                        <div className="space-y-4">
                            {timeline.map((event, idx) => (
                                <div key={idx} className="relative pl-8 pb-4 border-l-2 border-slate-700 last:border-0">
                                    <div className={`absolute -left-3 top-0 p-2 rounded-lg border ${getEventColor(event)}`}>
                                        {getEventIcon(event)}
                                    </div>
                                    
                                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="font-semibold text-slate-100 capitalize">
                                                    {event.type === 'covenant' ? event.covenant_type : event.operation}
                                                </h4>
                                                <p className="text-sm text-slate-400">
                                                    {new Date(event.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-slate-300 border-slate-600">
                                                {event.type}
                                            </Badge>
                                        </div>

                                        {event.type === 'anchor' && (
                                            <div className="space-y-2 mt-3">
                                                <div className="flex gap-2 text-sm">
                                                    <span className="text-slate-500">Actor:</span>
                                                    <span className="text-slate-300">{event.actor}</span>
                                                </div>
                                                {event.hash && (
                                                    <div className="flex gap-2 text-sm">
                                                        <span className="text-slate-500">Hash:</span>
                                                        <code className="text-blue-400 text-xs">{event.hash.substring(0, 16)}...</code>
                                                    </div>
                                                )}
                                                {event.data?.new_state && (
                                                    <div className="mt-2 p-2 bg-slate-800 rounded text-xs">
                                                        <pre className="text-slate-300 overflow-x-auto">
                                                            {JSON.stringify(event.data.new_state, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {event.type === 'covenant' && (
                                            <div className="space-y-2 mt-3">
                                                <div className="flex gap-2 text-sm">
                                                    <span className="text-slate-500">Status:</span>
                                                    <Badge className={event.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}>
                                                        {event.status}
                                                    </Badge>
                                                </div>
                                                {event.parties && (
                                                    <div className="flex gap-2 text-sm">
                                                        <span className="text-slate-500">Parties:</span>
                                                        <span className="text-slate-300">{event.parties.join(', ')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}