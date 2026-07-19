import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import AgentGenealogyTree from '@/components/AgentGenealogyTree';
import { Dna, GitBranch, Shield, TrendingUp, Brain, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function EvolutionDashboard() {
    const [selectedAgent, setSelectedAgent] = useState('Jasper');
    const [evolutionData, setEvolutionData] = useState({
        activeEvolutions: 0,
        improvements: [],
        skillGaps: [],
        fineTuningJobs: []
    });
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);

    const agents = ['Jasper', 'Arete', 'CodeForge', 'CreativeForge', 'SystemArchitect'];

    const runEvolutionCycle = async () => {
        setRunning(true);
        try {
            await base44.functions.invoke('evolutionOrchestrator', {});
            await loadEvolutionData();
        } catch (error) {
            console.error('Evolution cycle failed:', error);
        } finally {
            setRunning(false);
        }
    };

    const approveImprovement = async (improvementId) => {
        try {
            await base44.entities.ImprovementProposal.update(improvementId, { status: 'approved' });
            await loadEvolutionData();
        } catch (error) {
            console.error('Approval failed:', error);
        }
    };

    const rejectImprovement = async (improvementId) => {
        try {
            await base44.entities.ImprovementProposal.update(improvementId, { status: 'rejected' });
            await loadEvolutionData();
        } catch (error) {
            console.error('Rejection failed:', error);
        }
    };

    useEffect(() => {
        loadEvolutionData();
        const interval = setInterval(loadEvolutionData, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadEvolutionData = async () => {
        try {
            const [improvements, skillGaps, fineTuning] = await Promise.all([
                base44.entities.ImprovementProposal.list('-created_date', 50),
                base44.entities.SkillGap.list('-created_date', 20),
                base44.entities.FineTuningJob.list('-created_date', 10)
            ]);

            setEvolutionData({
                activeEvolutions: improvements.filter(i => i.status === 'implemented').length,
                improvements,
                skillGaps,
                fineTuningJobs: fineTuning
            });
            setLoading(false);
        } catch (error) {
            console.error('Failed to load evolution data:', error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Dna className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Evolution Dashboard</h1>
                                <p className="text-slate-400">Agent genealogy and evolutionary tracking</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={runEvolutionCycle}
                                disabled={running}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {running ? 'Running Cycle...' : 'Run Evolution Cycle'}
                            </Button>
                            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                                <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    {agents.map(agent => (
                                        <SelectItem key={agent} value={agent}>
                                            {agent}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Active Evolutions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-green-500" />
                                <span className="text-2xl font-bold text-white">{evolutionData.activeEvolutions}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Improvements deployed</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Skill Gaps Detected
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-yellow-500" />
                                <span className="text-2xl font-bold text-white">{evolutionData.skillGaps.length}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Learning opportunities</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Fine-Tuning Jobs
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-purple-500" />
                                <span className="text-2xl font-bold text-white">{evolutionData.fineTuningJobs.length}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Model adaptations</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Recent Improvements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {evolutionData.improvements.slice(0, 10).map((improvement) => (
                                    <div key={improvement.id} className="p-3 bg-slate-700/50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-slate-200">
                                                {improvement.agent_name}
                                            </span>
                                            <Badge className={
                                                improvement.status === 'implemented' ? 'bg-green-500/20 text-green-400' :
                                                improvement.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }>
                                                {improvement.status}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-400 mb-1">
                                            {improvement.proposal_type}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {improvement.identified_weakness?.substring(0, 100)}...
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">
                                            {new Date(improvement.created_date).toLocaleString()}
                                        </div>
                                        {improvement.status === 'proposed' && (
                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => approveImprovement(improvement.id)}
                                                    className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => rejectImprovement(improvement.id)}
                                                    className="h-7 px-3 text-xs border-red-600 text-red-400 hover:bg-red-600/20"
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {evolutionData.improvements.length === 0 && (
                                    <div className="text-center text-slate-500 py-8">
                                        No improvements yet. System is monitoring...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Identified Skill Gaps</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {evolutionData.skillGaps.map((gap) => (
                                    <div key={gap.id} className="p-3 bg-slate-700/50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-slate-200">
                                                {gap.agent_name}
                                            </span>
                                            <Badge className={
                                                gap.urgency === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                gap.urgency === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }>
                                                {gap.urgency}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-300 mb-1">
                                            Missing: {gap.missing_skill}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Method: {gap.acquisition_method || 'TBD'}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">
                                            {new Date(gap.created_date).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                                {evolutionData.skillGaps.length === 0 && (
                                    <div className="text-center text-slate-500 py-8">
                                        No skill gaps detected. All systems optimal.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <AgentGenealogyTree agentName={selectedAgent} />
            </div>
        </div>
    );
}