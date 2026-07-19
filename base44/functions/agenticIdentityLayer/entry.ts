import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action;
    const now = Date.now();

    const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    if (action === 'mint_did') {
      const { agent_name, display_name, governance_profile } = body;
      if (!agent_name) return Response.json({ error: 'agent_name is required' }, { status: 400 });
      const did = `did:jasperv2:${rand(12)}`;
      const public_key = `pk_${rand(16)}`;
      const truth_chain_anchor = `T*${rand(8)}`;
      const identity = await base44.entities.AgentIdentity.create({
        did,
        agent_name,
        display_name: display_name || agent_name,
        public_key,
        governance_profile: governance_profile || { authority_level: 'standard', voting_weight: 1, scope: ['general'] },
        credentials: [],
        trust_score: 50,
        truth_chain_anchor,
        status: 'active'
      });
      const tier = (governance_profile && governance_profile.tier) || 'TIER_2';
      const did_document = {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://jasper.os/did/v3'],
        id: did,
        verificationMethod: [{
          id: `${did}#ml-dsa`,
          type: 'ML-DSA-65',
          controller: did,
          publicKeyMultibase: public_key
        }],
        authentication: [`${did}#ml-dsa`],
        assertionMethod: [`${did}#ml-dsa`],
        crypto_profile: 'PQ_NATIVE',
        did_version: 3,
        governance_tier: tier
      };
      return Response.json({ identity, did_document });
    }

    if (action === 'resolve') {
      const { did } = body;
      if (!did) return Response.json({ error: 'did is required' }, { status: 400 });
      const matches = await base44.entities.AgentIdentity.filter({ did });
      if (!matches || matches.length === 0) return Response.json({ error: 'Identity not found' }, { status: 404 });
      return Response.json({ identity: matches[0] });
    }

    if (action === 'issue_credential') {
      const { did, credential } = body;
      if (!did || !credential) return Response.json({ error: 'did and credential are required' }, { status: 400 });
      const matches = await base44.entities.AgentIdentity.filter({ did });
      if (!matches || matches.length === 0) return Response.json({ error: 'Identity not found' }, { status: 404 });
      const id = matches[0];
      const credentials = [...(id.credentials || []), { ...credential, issued_at: now, issuer: user.full_name || 'system' }];
      const trust_score = Math.min(100, (id.trust_score || 50) + 5);
      const updated = await base44.entities.AgentIdentity.update(id.id, { credentials, trust_score });
      return Response.json({ identity: updated });
    }

    if (action === 'update_trust') {
      const { did, delta } = body;
      if (!did || typeof delta !== 'number') return Response.json({ error: 'did and numeric delta are required' }, { status: 400 });
      const matches = await base44.entities.AgentIdentity.filter({ did });
      if (!matches || matches.length === 0) return Response.json({ error: 'Identity not found' }, { status: 404 });
      const id = matches[0];
      const trust_score = Math.max(0, Math.min(100, (id.trust_score || 50) + delta));
      const truth_chain_anchor = `T*${rand(8)}`;
      const updated = await base44.entities.AgentIdentity.update(id.id, { trust_score, truth_chain_anchor });
      return Response.json({ identity: updated });
    }

    if (action === 'list') {
      const identities = await base44.entities.AgentIdentity.list('-created_date', 100);
      return Response.json({ identities });
    }

    if (action === 'resolve_did_document') {
      const { did } = body;
      if (!did) return Response.json({ error: 'did is required' }, { status: 400 });
      const matches = await base44.entities.AgentIdentity.filter({ did });
      if (!matches || matches.length === 0) return Response.json({ error: 'Identity not found' }, { status: 404 });
      const id = matches[0];
      const tier = (id.governance_profile && id.governance_profile.tier) || 'TIER_2';
      const did_document = {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://jasper.os/did/v3'],
        id: id.did,
        verificationMethod: [{
          id: `${id.did}#ml-dsa`,
          type: 'ML-DSA-65',
          controller: id.did,
          publicKeyMultibase: id.public_key
        }],
        authentication: [`${id.did}#ml-dsa`],
        assertionMethod: [`${id.did}#ml-dsa`],
        crypto_profile: 'PQ_NATIVE',
        did_version: 3,
        governance_tier: tier,
        trust_score: id.trust_score,
        status: id.status
      };
      return Response.json({ did_document });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});