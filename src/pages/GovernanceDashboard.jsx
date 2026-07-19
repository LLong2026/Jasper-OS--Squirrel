import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function GovernanceDashboard() {
    const [approvalRequests, setApprovalRequests] = useState([]);
    const [constitution, setConstitution] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const requests = await base44.entities.ApprovalRequest.filter({
                status: 'pending'
            }, '-created_date', 20);
            setApprovalRequests(requests);

            const constResponse = await base44.functions.invoke('constitutionalValidator', {
                action: 'validate_action',
                agent_name: 'System',
                proposed_action: { type: 'test' },
                context: {}
            });

            setLoading(false);
        } catch (error) {
            console.error('Failed to load governance data:', error);
            setLoading(false);
        }
    };

    const handleApproval = async (requestId, approved) => {
        try {
            await base44.entities.ApprovalRequest.update(requestId, {
                status: approved ? 'approved' : 'rejected',
                resolved_at: Date.now()
            });
            loadData();
        } catch (error) {
            console.error('Failed to update approval:', error);
        }
    };

    const getUrgencyColor = (urgency) => {
        switch (urgency) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'normal': return 'bg-yellow-500';
            default: return 'bg-blue-500';
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-8">
                    <Shield className="h-8 w-8 text-green-400" />
                    <h1 className="text-3xl font-bold text-white">Constitutional Governance</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="h-5 w-5 text-green-400" />
                                <span className="text-sm text-slate-400">Truth Imperative</span>
                            </div>
                            <div className="text-2xl font-bold text-white">Active</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="h-5 w-5 text-blue-400" />
                                <span className="text-sm text-slate-400">Human Priority</span>
                            </div>
                            <div className="text-2xl font-bold text-white">Protected</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Clock className="h-5 w-5 text-yellow-400" />
                                <span className="text-sm text-slate-400">Pending Approvals</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{approvalRequests.length}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Pending Approval Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {approvalRequests.length > 0 ? (
                            <div className="space-y-3">
                                {approvalRequests.map((request) => (
                                    <div
                                        key={request.id}
                                        className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className={getUrgencyColor(request.urgency)}>
                                                        {request.urgency}
                                                    </Badge>
                                                    <span className="text-sm text-slate-400">
                                                        {request.action_type}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-300 mb-2">
                                                    Agent: {request.requesting_agent}
                                                </div>
                                                <div className="text-sm text-slate-400">
                                                    {request.action_details}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleApproval(request.id, true)}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleApproval(request.id, false)}
                                                className="border-red-600 text-red-400 hover:bg-red-600/20"
                                            >
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-8">
                                No pending approval requests
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Constitutional Principles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { name: 'Truth Imperative', desc: 'All outputs must be factually accurate', status: 'active' },
                                { name: 'Biological Priority', desc: 'Human welfare is paramount', status: 'active' },
                                { name: 'Sovereign Boundaries', desc: 'High-impact actions require approval', status: 'active' },
                                { name: 'Transparency', desc: 'Clear reasoning for all actions', status: 'active' }
                            ].map((principle, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                    <div>
                                        <div className="text-sm font-medium text-slate-200">{principle.name}</div>
                                        <div className="text-xs text-slate-400">{principle.desc}</div>
                                    </div>
                                    <Badge className="bg-green-500/20 text-green-400">
                                        {principle.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}