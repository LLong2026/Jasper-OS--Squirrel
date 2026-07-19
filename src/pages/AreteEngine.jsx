import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, Play, Loader2, Sparkles, RefreshCw, Cpu } from 'lucide-react';
import MonitorWidget from '@/components/arete/MonitorWidget';
import LoopVisualization from '@/components/arete/LoopVisualization';
import OptimizationProposals from '@/components/arete/OptimizationProposals';
import PatternsFeed from '@/components/arete/PatternsFeed';
import AgentFleet from '@/components/arete/AgentFleet';

const DEFAULT_EVENT = { task: 'Analyze the latest system telemetry and recommend infrastructure optimizations for the agent fleet', domain: 'devops' };

export default function AreteEngine() {
  const [status, setStatus] = useState(null);
  const [eventInput, setEventInput] = useState(JSON.stringify(DEFAULT_EVENT, null, 2));
  const [loopRunning, setLoopRunning] = useState(false);
  const [loopResult, setLoopResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [fleet, setFleet] = useState(null);
  const [error, setError] = useState(null);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('areteRecursiveEngine', { action: 'get_agent_fleet' });
      setFleet(res.data?.fleet);
    } catch (e) {}
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('areteRecursiveEngine', { action: 'get_status' });
      setStatus(res.data);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { fetchStatus(); fetchFleet(); const i = setInterval(fetchStatus, 15000); return () => clearInterval(i); }, [fetchStatus, fetchFleet]);

  const runLoop = async () => {
    setLoopRunning(true); setError(null); setLoopResult(null);
    try {
      const event = JSON.parse(eventInput);
      const res = await base44.functions.invoke('areteRecursiveEngine', { action: 'run_loop', event, domain: event.domain || 'general' });
      setLoopResult(res.data);
      fetchStatus();
    } catch (e) { setError(e.message); }
    setLoopRunning(false);
  };

  const generateProposals = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('areteRecursiveEngine', { action: 'generate_proposals' });
      fetchStatus();
    } catch (e) { setError(e.message); }
    setGenerating(false);
  };

  const approveProposal = async (id) => {
    try { await base44.functions.invoke('areteRecursiveEngine', { action: 'approve_and_execute', proposal_id: id }); fetchStatus(); }
    catch (e) { setError(e.message); }
  };

  const rejectProposal = async (id) => {
    try { await base44.functions.invoke('areteRecursiveEngine', { action: 'reject_proposal', proposal_id: id }); fetchStatus(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30">
              <Cpu className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Arete Recursive Engine</h1>
              <p className="text-xs text-slate-400">Ultimate Self-Learning AI — Full sequence-diagram loop with autonomous self-optimization</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} className="border-slate-700 text-slate-300">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Monitor Widget */}
      <MonitorWidget metrics={status?.metrics} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Loop Control */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" /> Recursive Learning Loop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={eventInput}
                onChange={(e) => setEventInput(e.target.value)}
                placeholder="Enter event JSON to process through the full recursive loop..."
                className="bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs min-h-[100px]"
              />
              <Button onClick={runLoop} disabled={loopRunning} className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500">
                {loopRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run Recursive Loop
              </Button>
              <LoopVisualization stages={loopResult?.stages} running={loopRunning} />
            </CardContent>
          </Card>

          {loopResult?.success && (
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Decision Output
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/30">
                    {loopResult.execution_time_ms?.toFixed(0)}ms
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/30">
                    Confidence: {((loopResult.confidence || 0) * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    Merkle: {loopResult.merkle_leaf?.substring(0, 12)}...
                  </Badge>
                  {loopResult.agents?.map(a => (
                    <Badge key={a} variant="outline" className="text-[10px] bg-slate-700/40 text-slate-300 border-slate-600">
                      {a}
                    </Badge>
                  ))}
                </div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950 rounded-lg p-3 border border-slate-800 max-h-[300px] overflow-y-auto">
                  {loopResult.decision}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Proposals & Patterns */}
        <div className="space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <OptimizationProposals
                proposals={status?.proposals}
                onGenerate={generateProposals}
                onApprove={approveProposal}
                onReject={rejectProposal}
                generating={generating}
              />
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <AgentFleet fleet={fleet} agentResults={loopResult?.agent_results} />
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <PatternsFeed patterns={status?.patterns} insights={status?.insights} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}