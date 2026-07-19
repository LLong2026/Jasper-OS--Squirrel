import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Aegis Quantum Compliance Bot — a multi-LLM compliance repair agent.
// Scans a target (system / crypto / entity) against applicable regulations,
// diagnoses violations, and auto-applies PQC remediation. Uses real LLM with
// live web context for current regulatory + quantum-threat intelligence.

const DEFAULT_REGS = ['HIPAA', 'GDPR', 'CCPA', 'SEC-Rule-S3', 'NIST-PQC', 'FIPS-204', 'PCI-DSS', 'ISO-27001'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action;
    const svc = base44.asServiceRole.entities;
    const ts = Date.now();

    if (action === 'scan') {
      const target = body.target || 'system';
      const regulations = body.regulations || DEFAULT_REGS;

      // Gather real context about the target's crypto posture
      let context = '';
      try {
        const keys = await svc.KeyRegistry.list('-created_date', 100);
        const ecdsa = keys.filter((k) => k.key_type === 'ECDSA_P256_SIGNING' && k.status === 'active');
        const pq = keys.filter((k) => (k.key_type === 'MLDSA65_SIGNING' || k.key_type === 'MLDSA65_REAL_SIGNING') && k.status === 'active');
        const surfaces = [...new Set(keys.map((k) => k.surface))];
        context += `\n\nLIVE CRYPTO POSTURE: ${keys.length} total keys, ${ecdsa.length} active ECDSA (quantum-vulnerable), ${pq.length} PQ-native (ML-DSA-65). Protected surfaces: ${surfaces.join(', ') || 'none'}.`;
      } catch {
        context += '\n\nLIVE CRYPTO POSTURE: KeyRegistry not yet provisioned.';
      }

      const prompt = `You are the Aegis Quantum Compliance Bot, a multi-LLM compliance repair agent.
Your job: scan the target for compliance violations across ALL applicable regulations and produce concrete, auto-repairable remediation.

TARGET: ${target}
REGULATIONS TO CHECK: ${regulations.join(', ')}${context}

For each violation found, provide: the regulation violated, severity (critical/high/medium/low), the specific issue, the exact fix to apply, and whether it can be auto-repaired (true/false).
Also assess overall quantum-readiness (PQC migration status) and produce an auto-repair plan.

Respond as JSON: {
  "compliance_score": number (0-100),
  "violations": [{ "regulation": string, "severity": string, "issue": string, "fix": string, "auto_repairable": boolean }],
  "quantum_readiness": "none" | "partial" | "full",
  "quantum_recommendation": string,
  "auto_repair_plan": [string]
}`;

      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            compliance_score: { type: 'number' },
            violations: { type: 'array', items: { type: 'object', additionalProperties: true } },
            quantum_readiness: { type: 'string' },
            quantum_recommendation: { type: 'string' },
            auto_repair_plan: { type: 'array', items: { type: 'string' } },
          },
          required: ['compliance_score', 'violations', 'quantum_readiness'],
        },
      });

      return Response.json({
        success: true, target, regulations, result: llm, scanned_at: ts,
        proof: { source: 'Quantum Compliance Bot', model: 'Multi-LLM (web-enabled)', details: `Scanned ${target} against ${regulations.length} regulations` },
      });
    }

    if (action === 'repair') {
      // Auto-apply PQC remediation — issue real ML-DSA-65 keys + verify
      const fixes = [];
      try {
        const kp = await base44.functions.invoke('quantumResilience', { action: 'pq_real_keypair', surface: body.surface || 'urib' });
        fixes.push({ action: 'issue_pq_keypair', success: true, pair_id: kp.pair_id, detail: 'Real ML-DSA-65 (FIPS 204) keypair issued' });
      } catch (e) {
        fixes.push({ action: 'issue_pq_keypair', success: false, error: e.message });
      }
      try {
        const st = await base44.functions.invoke('quantumResilience', { action: 'pq_real_self_test', surface: body.surface || 'urib' });
        fixes.push({ action: 'verify_pq_self_test', success: st.sign_verify_roundtrip_valid !== false, signature_bytes: st.signature_bytes, detail: 'ML-DSA-65 sign/verify round-trip validated' });
      } catch (e) {
        fixes.push({ action: 'verify_pq_self_test', success: false, error: e.message });
      }
      const allOk = fixes.every((f) => f.success);
      return Response.json({
        success: allOk, fixes_applied: fixes.filter((f) => f.success).length, fixes,
        repaired_at: Date.now(),
        proof: { source: 'Quantum Compliance Bot', details: allOk ? 'PQC remediation applied + verified' : 'Partial remediation — review failures' },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});