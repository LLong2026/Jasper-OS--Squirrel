import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Jasper OS Crypto Abstraction Layer — JIP-QRM-01 Phase 1 (HYBRID_V1)
// Classical slot: ECDSA P-256 (real Web Crypto).
// PQ slot: ML-DSA-65 represented by a deterministic HMAC-SHA256 construction
// (see cips/JIP-QRM-01.md §4 implementation note — drop-in target for native ML-DSA).

const enc = new TextEncoder();

function toB64(buf) {
  const u = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
  return btoa(bin);
}

function fromB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function keyId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function generateClassicalPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const priv = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const pub = await crypto.subtle.exportKey('spki', pair.publicKey);
  return { privB64: toB64(priv), pubB64: toB64(pub) };
}

async function generatePqSecret() {
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return toB64(raw);
}

async function classicalSign(privB64, data) {
  const key = await crypto.subtle.importKey('pkcs8', fromB64(privB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
  return toB64(sig);
}

async function classicalVerify(pubB64, sigB64, data) {
  const key = await crypto.subtle.importKey('spki', fromB64(pubB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64(sigB64), data);
}

async function pqSign(secretB64, data) {
  const key = await crypto.subtle.importKey('raw', fromB64(secretB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return toB64(sig);
}

async function pqVerify(secretB64, sigB64, data) {
  const key = await crypto.subtle.importKey('raw', fromB64(secretB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return await crypto.subtle.verify('HMAC', key, fromB64(sigB64), data);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const svc = base44.asServiceRole.entities.KeyRegistry;

    const requireAdmin = () => {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      return null;
    };

    if (action === 'generate_keypair') {
      const denied = requireAdmin();
      if (denied) return denied;
      const surface = body.surface || 'threadzero';
      const agentName = body.agent_name || null;
      const pairId = keyId('pair');
      const cls = await generateClassicalPair();
      const pq = await generatePqSecret();
      const now = Date.now();
      const clsRec = await svc.create({
        key_id: keyId('kr'), pair_id: pairId,
        key_type: 'ECDSA_P256_SIGNING', key_profile: 'classical',
        surface, agent_name: agentName,
        public_key: cls.pubB64, private_material: cls.privB64,
        status: 'active', created_at: now,
      });
      const pqRec = await svc.create({
        key_id: keyId('kr'), pair_id: pairId,
        key_type: 'MLDSA65_SIGNING', key_profile: 'pq',
        surface, agent_name: agentName,
        public_key: 'pq-sim-' + pairId, private_material: pq,
        status: 'active', created_at: now,
      });
      return Response.json({ pair_id: pairId, classical: clsRec.key_id, pq: pqRec.key_id, crypto_profile: 'HYBRID_V1' });
    }

    if (action === 'hybrid_sign') {
      const data = enc.encode(body.payload || '');
      const pairId = body.pair_id;
      const clsKey = pairId
        ? (await svc.filter({ pair_id: pairId, key_type: 'ECDSA_P256_SIGNING', status: 'active' }))[0]
        : (await svc.filter({ surface: body.surface, key_type: 'ECDSA_P256_SIGNING', status: 'active' }))[0];
      const pqKey = pairId
        ? (await svc.filter({ pair_id: pairId, key_type: 'MLDSA65_SIGNING', status: 'active' }))[0]
        : (await svc.filter({ surface: body.surface, key_type: 'MLDSA65_SIGNING', status: 'active' }))[0];
      if (!clsKey || !pqKey) return Response.json({ error: 'No active hybrid keypair for surface' }, { status: 400 });
      const sigClassical = await classicalSign(clsKey.private_material, data);
      const sigPq = await pqSign(pqKey.private_material, data);
      return Response.json({ sig_classical: sigClassical, sig_pq: sigPq, crypto_profile: 'HYBRID_V1', pair_id: clsKey.pair_id });
    }

    if (action === 'verify') {
      const data = enc.encode(body.payload || '');
      const pairId = body.pair_id;
      const clsKey = (await svc.filter({ pair_id: pairId, key_type: 'ECDSA_P256_SIGNING' }))[0];
      const pqKey = (await svc.filter({ pair_id: pairId, key_type: 'MLDSA65_SIGNING' }))[0];
      if (!clsKey || !pqKey) return Response.json({ error: 'Keypair not found' }, { status: 404 });
      const cv = await classicalVerify(clsKey.public_key, body.sig_classical, data);
      const pv = await pqVerify(pqKey.private_material, body.sig_pq, data);
      return Response.json({ valid: cv && pv, classical_valid: cv, pq_valid: pv, crypto_profile: 'HYBRID_V1' });
    }

    if (action === 'rotate') {
      const denied = requireAdmin();
      if (denied) return denied;
      const old = await svc.get(body.key_id);
      if (!old) return Response.json({ error: 'Key not found' }, { status: 404 });
      const cls = await generateClassicalPair();
      const pq = await generatePqSecret();
      const now = Date.now();
      const newPairId = keyId('pair');
      const clsRec = await svc.create({
        key_id: keyId('kr'), pair_id: newPairId,
        key_type: 'ECDSA_P256_SIGNING', key_profile: 'classical',
        surface: old.surface, agent_name: old.agent_name,
        public_key: cls.pubB64, private_material: cls.privB64,
        status: 'active', created_at: now, rotated_from: old.pair_id,
      });
      const pqRec = await svc.create({
        key_id: keyId('kr'), pair_id: newPairId,
        key_type: 'MLDSA65_SIGNING', key_profile: 'pq',
        surface: old.surface, agent_name: old.agent_name,
        public_key: 'pq-sim-' + newPairId, private_material: pq,
        status: 'active', created_at: now, rotated_from: old.pair_id,
      });
      const siblings = await svc.filter({ pair_id: old.pair_id });
      for (const s of siblings) {
        await svc.update(s.id, { status: 'deprecated', rotated_to: newPairId });
      }
      return Response.json({ pair_id: newPairId, classical: clsRec.key_id, pq: pqRec.key_id });
    }

    if (action === 'readiness') {
      const keys = await svc.list('-created_date', 500);
      const surfaces = ['threadzero', 'did', 'urib', 'agent_delegation'];
      const surfaceStatus = {};
      for (const s of surfaces) {
        const active = keys.filter((k) => k.surface === s && k.status === 'active');
        const hasClassical = active.some((k) => k.key_type === 'ECDSA_P256_SIGNING');
        const hasPq = active.some((k) => k.key_type === 'MLDSA65_SIGNING');
        surfaceStatus[s] = hasClassical && hasPq ? 'HYBRID_V1' : 'pending';
      }
      const pqKeys = keys.filter((k) => k.key_type === 'MLDSA65_SIGNING');
      const migratedAgents = new Set(
        keys.filter((k) => k.agent_name && k.key_type === 'MLDSA65_SIGNING' && k.status === 'active').map((k) => k.agent_name)
      );
      const totalAgents = new Set(keys.filter((k) => k.agent_name).map((k) => k.agent_name));
      const coverage = totalAgents.size === 0 ? 0 : Math.round((migratedAgents.size / totalAgents.size) * 100);
      return Response.json({
        surfaces: surfaceStatus,
        pq_keys_issued: pqKeys.length,
        agents_migrated: migratedAgents.size,
        agents_total: totalAgents.size,
        pq_coverage: coverage,
        crypto_profile: 'HYBRID_V1',
      });
    }

    if (action === 'list_keys') {
      const keys = await svc.list('-created_date', 200);
      return Response.json({ keys });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});