import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Coins, Loader2 } from 'lucide-react';
import DslEditor from '@/components/tokenomics/DslEditor';
import ValidatorsView from '@/components/tokenomics/ValidatorsView';
import ActionPanel from '@/components/tokenomics/ActionPanel';
import AuditTrailView from '@/components/tokenomics/AuditTrailView';

const DEFAULT_DSL = `token SMART {
  type: GOVERNANCE
  supply: cap=100000000
  mint_rules: requires_approval threshold=10000
  burn_rules: on_fee basis_points=200
  governance: staking_required
}

token FUEL {
  type: UTILITY
  supply: elastic
  mint_rules: dynamic_inflation
  burn_rules: on_swap
}

flow reward_flow {
  from: protocol_fees
  to: stakers
  amount_expr: fees*0.5
  schedule: realtime
}`;

export default function TokenStudio() {
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [projectId, setProjectId] = useState('ute_mvp_demo');
  const [compiling, setCompiling] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [errors, setErrors] = useState([]);
  const [validators, setValidators] = useState(null);
  const [manifest, setManifest] = useState(null);

  const [tokenState, setTokenState] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [trail, setTrail] = useState([]);
  const [trailLoading, setTrailLoading] = useState(false);

  const refreshState = useCallback(async (pid) => {
    const id = pid || projectId;
    if (!id) return;
    try {
      const stateRes = await base44.functions.invoke('tokenPolicyEngine', { action: 'get_token_state', payload: { token_id: id } });
      setTokenState(stateRes.success ? stateRes.state : null);
    } catch { setTokenState(null); }
    try {
      setTrailLoading(true);
      const auditRes = await base44.functions.invoke('tokenAuditAnchoring', { action: 'get_audit_trail', payload: { token_id: id } });
      setTrail(auditRes.audit_trail || []);
    } catch { setTrail([]); } finally { setTrailLoading(false); }
  }, [projectId]);

  useEffect(() => { refreshState(projectId); }, [projectId]);

  const handleCompile = async () => {
    setCompiling(true); setErrors([]); setWarnings([]);
    try {
      const res = await base44.functions.invoke('tokenDSLCompiler', {
        action: 'compile_token_spec',
        payload: { dsl_source: dsl, project_id: projectId, version: (manifest?.version || 0) + 1 },
      });
      if (res.success) {
        setValidators(res.validators);
        setManifest({ ...res.manifest, anchor_cid: res.anchor_cid, merkle_root: res.merkle_root });
        setWarnings(res.warnings || []);
        refreshState(projectId);
      } else {
        setErrors(res.errors || res.safety_violations || ['Compilation failed']);
      }
    } catch (e) {
      setErrors([e.message || 'Compilation error']);
    } finally { setCompiling(false); }
  };

  const handleScore = async (token, actionType, amount) => {
    setScoring(true); setScoreResult(null);
    try {
      const res = await base44.functions.invoke('tokenPolicyEngine', {
        action: 'score_action',
        payload: { token_id: projectId, action_type: actionType, context: { token_name: token, amount, current_supply: tokenState?.circulating_supply || 0 } },
      });
      setScoreResult(res);
    } catch (e) { setScoreResult({ decision: 'DENY', confidence: 0, explanation: [e.message], requires_approval: false }); }
    finally { setScoring(false); }
  };

  const handleExecute = async (token, actionType, amount) => {
    setExecuting(true); setExecResult(null);
    try {
      const res = await base44.functions.invoke('tokenPolicyEngine', {
        action: 'execute_action',
        payload: { token_id: projectId, action_type: actionType, params: { token_name: token, amount } },
      });
      setExecResult(res);
      refreshState(projectId);
    } catch (e) { setExecResult({ error: e.message }); }
    finally { setExecuting(false); }
  };

  const tokenNames = validators?.tokens ? Object.keys(validators.tokens) : [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-blue-500/20">
          <Coins className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Token Studio</h1>
          <p className="text-xs text-slate-400">Universal Tokenomics Engine — compile DSL, enforce policy, anchor audit trail</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 bg-slate-800/40 border-slate-700">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Coins className="h-3.5 w-3.5" /> DSL Spec
          </div>
          <DslEditor
            dsl={dsl} setDsl={setDsl}
            projectId={projectId} setProjectId={setProjectId}
            onCompile={handleCompile} compiling={compiling}
            warnings={warnings} errors={errors}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4 bg-slate-800/40 border-slate-700">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Coins className="h-3.5 w-3.5" /> Runtime Validators
            </div>
            <ValidatorsView validators={validators} manifest={manifest} />
          </Card>

          {tokenState && (
            <Card className="p-4 bg-slate-800/40 border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Token State</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold text-blue-300">{tokenState.circulating_supply?.toLocaleString()}</div><div className="text-[10px] text-slate-500 uppercase">circulating</div></div>
                <div><div className="text-lg font-bold text-emerald-300">{tokenState.minted?.toLocaleString()}</div><div className="text-[10px] text-slate-500 uppercase">minted</div></div>
                <div><div className="text-lg font-bold text-rose-300">{tokenState.burned?.toLocaleString()}</div><div className="text-[10px] text-slate-500 uppercase">burned</div></div>
              </div>
            </Card>
          )}

          <ActionPanel
            tokenNames={tokenNames}
            onScore={handleScore} onExecute={handleExecute}
            scoring={scoring} executing={executing}
            scoreResult={scoreResult} execResult={execResult}
          />

          <AuditTrailView trail={trail} loading={trailLoading} />
        </div>
      </div>
    </div>
  );
}