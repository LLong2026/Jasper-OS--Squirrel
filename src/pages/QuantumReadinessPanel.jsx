import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, ShieldCheck, KeyRound, RefreshCw, Plus, Zap, AlertCircle, Check, Loader2, Atom } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SURFACES = [
    { id: 'threadzero', label: 'ThreadZero Truth Chain' },
    { id: 'did', label: 'DID Identity Layer' },
    { id: 'urib', label: 'URIB Settlement Commitments' },
    { id: 'agent_delegation', label: 'Agent Delegation Chains' },
];

function ProfileBadge({ status }) {
    if (status === 'HYBRID_V1') {
        return (
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20">
                <ShieldCheck className="h-3 w-3 mr-1" /> HYBRID_V1
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-slate-700/40 text-slate-400 border-slate-600">
            <Shield className="h-3 w-3 mr-1" /> Pending
        </Badge>
    );
}

export default function QuantumReadinessPanel() {
    const [readiness, setReadiness] = useState(null);
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [notice, setNotice] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setNotice(null);
        try {
            const [r, k] = await Promise.all([
                base44.functions.invoke('quantumResilience', { action: 'readiness' }),
                base44.functions.invoke('quantumResilience', { action: 'list_keys' }),
            ]);
            setReadiness(r.data);
            setKeys(k.data.keys || []);
        } catch (e) {
            setNotice({ type: 'error', msg: e?.message || 'Failed to load readiness data.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const issueKey = async (surface) => {
        setBusy(surface);
        setNotice(null);
        try {
            await base44.functions.invoke('quantumResilience', { action: 'generate_keypair', surface });
            await refresh();
        } catch (e) {
            setNotice({ type: 'error', msg: e?.response?.data?.error || e?.message || 'Key generation failed (admin only).' });
        } finally { setBusy(null); }
    };

    const rotateKey = async (keyId) => {
        setBusy('rot_' + keyId);
        setNotice(null);
        try {
            await base44.functions.invoke('quantumResilience', { action: 'rotate', key_id: keyId });
            await refresh();
        } catch (e) {
            setNotice({ type: 'error', msg: e?.response?.data?.error || e?.message || 'Rotation failed.' });
        } finally { setBusy(null); }
    };

    const runHybridProbe = async () => {
        setBusy('probe');
        setNotice(null);
        try {
            const payload = 'quantum-resilience-probe-' + Date.now();
            const signRes = await base44.functions.invoke('quantumResilience', { action: 'hybrid_sign', surface: 'threadzero', payload });
            const v = await base44.functions.invoke('quantumResilience', {
                action: 'verify',
                pair_id: signRes.data.pair_id,
                payload,
                sig_classical: signRes.data.sig_classical,
                sig_pq: signRes.data.sig_pq,
            });
            if (v.data.valid) {
                setNotice({ type: 'success', msg: 'HYBRID_V1 dual-signature probe verified — both classical and PQ slots valid.' });
            } else {
                setNotice({ type: 'error', msg: 'Hybrid verification failed: ' + JSON.stringify(v.data) });
            }
        } catch (e) {
            setNotice({ type: 'error', msg: e?.response?.data?.error || e?.message || 'Probe failed — issue a hybrid key for threadzero first.' });
        } finally { setBusy(null); }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                                <Atom className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Quantum Readiness</h1>
                                <p className="text-sm text-slate-400">JIP-QRM-01 · Phase 1 · HYBRID_V1 migration</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={runHybridProbe} disabled={!!busy} variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700">
                            {busy === 'probe' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                            Run Hybrid Probe
                        </Button>
                        <Button onClick={refresh} disabled={loading} variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700">
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </div>

                {notice && (
                    <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${notice.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                        {notice.type === 'error' ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <Check className="h-4 w-4 mt-0.5 shrink-0" />}
                        <span>{notice.msg}</span>
                    </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard icon={KeyRound} label="PQ Keys Issued" value={readiness?.pq_keys_issued ?? '—'} accent="text-violet-300" />
                    <MetricCard icon={ShieldCheck} label="Agents Migrated" value={readiness ? `${readiness.agents_migrated}/${readiness.agents_total}` : '—'} accent="text-emerald-300" />
                    <MetricCard icon={Atom} label="PQ Coverage" value={readiness ? `${readiness.pq_coverage}%` : '—'} accent="text-blue-300" />
                    <MetricCard icon={Shield} label="Crypto Profile" value={readiness?.crypto_profile ?? '—'} accent="text-amber-300" />
                </div>

                {/* Surface cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SURFACES.map((s) => {
                        const status = readiness?.surfaces?.[s.id] || 'pending';
                        return (
                            <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="font-semibold text-white text-sm">{s.label}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">surface: <code className="text-slate-400">{s.id}</code></p>
                                    </div>
                                    <ProfileBadge status={status} />
                                </div>
                                <div className="mt-4">
                                    {status === 'HYBRID_V1' ? (
                                        <Button onClick={() => issueKey(s.id)} disabled={!!busy} variant="outline" size="sm" className="bg-slate-700/40 border-slate-600 hover:bg-slate-700">
                                            <Plus className="h-4 w-4 mr-1" /> Issue New Hybrid Key
                                        </Button>
                                    ) : (
                                        <Button onClick={() => issueKey(s.id)} disabled={busy === s.id} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                            {busy === s.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                            Issue HYBRID_V1 Keypair
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Key Registry */}
                <div className="rounded-xl border border-slate-800 bg-slate-800/40 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-slate-400" />
                        <h3 className="font-semibold text-white text-sm">Key Registry</h3>
                        <span className="text-xs text-slate-500">({keys.length})</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-500 border-b border-slate-800">
                                <tr>
                                    <th className="text-left font-medium px-5 py-2">Surface</th>
                                    <th className="text-left font-medium px-3 py-2">Type</th>
                                    <th className="text-left font-medium px-3 py-2">Profile</th>
                                    <th className="text-left font-medium px-3 py-2">Agent</th>
                                    <th className="text-left font-medium px-3 py-2">Status</th>
                                    <th className="text-right font-medium px-5 py-2">Rotate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {keys.length === 0 && (
                                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No keys registered. Issue a HYBRID_V1 keypair above to begin migration.</td></tr>
                                )}
                                {keys.map((k) => (
                                    <tr key={k.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                                        <td className="px-5 py-2 text-slate-300"><code className="text-xs">{k.surface}</code></td>
                                        <td className="px-3 py-2 text-slate-300"><code className="text-xs text-cyan-300">{k.key_type}</code></td>
                                        <td className="px-3 py-2 text-slate-400">{k.key_profile}</td>
                                        <td className="px-3 py-2 text-slate-400">{k.agent_name || '—'}</td>
                                        <td className="px-3 py-2">
                                            {k.status === 'active' ? (
                                                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">active</Badge>
                                            ) : k.status === 'deprecated' ? (
                                                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/40">deprecated</Badge>
                                            ) : (
                                                <Badge className="bg-red-500/15 text-red-300 border-red-500/40">{k.status}</Badge>
                                            )}
                                        </td>
                                        <td className="px-5 py-2 text-right">
                                            <Button
                                                onClick={() => rotateKey(k.id)}
                                                disabled={busy === ('rot_' + k.id) || k.status !== 'active'}
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-300 hover:text-white"
                                            >
                                                {busy === ('rot_' + k.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                    PQ slot uses a deterministic HMAC-SHA256 construction representing ML-DSA-65 (see JIP-QRM-01 §4). Classical slot is real ECDSA P-256 via Web Crypto.
                </p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, accent }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Icon className={`h-3.5 w-3.5 ${accent}`} />
                <span>{label}</span>
            </div>
            <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
        </div>
    );
}

export { QuantumReadinessPanel };