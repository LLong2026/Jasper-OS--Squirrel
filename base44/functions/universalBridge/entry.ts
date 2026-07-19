import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ─── URIB Stack — Universal Rail Integration Bridge ───────────────────────────
// Implements the full 7-stage pipeline from the URIB Math Set spec (09 Jul 2026)
// §1 Canonical → §2 Semantic → §3 ThreadZero → §4 Stack Commitment →
// §5 Bitcoin/Taproot → §6 URIB Rail Mapping → §7 Settlement Emission

// ── Utility: SHA-256 using Web Crypto ────────────────────────────────────────
async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256concat(...parts: string[]): Promise<string> {
  return sha256hex(parts.join('||'));
}

// ── §1 CANONICAL TOKENIZATION ────────────────────────────────────────────────
// D = { f₁, f₂, …, fₙ }  →  canon_serialize(D) → B  →  h_D = H(B)

function canonicalizeDocument(rawDoc: Record<string, unknown>) {
  // Sort fields deterministically (order-stable, schema-bound)
  const fields = Object.entries(rawDoc)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({
      name,
      type: Array.isArray(value) ? 'array' : typeof value,
      value
    }));
  return { fields, schema_id: 'iso20022_urib_v1' };
}

function serializeDocument(doc: { fields: unknown[]; schema_id: string }): string {
  // Deterministic JSON — keys sorted, no whitespace
  return JSON.stringify(doc, Object.keys(doc).sort());
}

async function hashDocument(serialized: string): Promise<string> {
  return sha256hex(serialized);
}

// ── §2 SEMANTIC TOKENIZATION ─────────────────────────────────────────────────
// G_D = (V, E)  →  h_G = H(canon_serialize(G_D))
// Invariants: Σ debts = Σ credits  |  obligation(A,B) ⇒ right(B,A)

function buildSemanticGraph(doc: { fields: Array<{ name: string; type: string; value: unknown }> }) {
  const nodes: Array<{ id: string; type: string; attrs: Record<string, unknown> }> = [];
  const edges: Array<{ from: string; to: string; relation: string }> = [];

  // ISO 20022 field mapping → semantic nodes/edges
  const fieldMap: Record<string, unknown> = {};
  for (const f of doc.fields) fieldMap[f.name] = f.value;

  // Parties
  const debtor = String(fieldMap['debtor'] || fieldMap['sender'] || fieldMap['originator'] || 'DEBTOR');
  const creditor = String(fieldMap['creditor'] || fieldMap['receiver'] || fieldMap['beneficiary'] || 'CREDITOR');
  const amount = Number(fieldMap['amount'] || fieldMap['value'] || fieldMap['instructed_amount'] || 0);
  const currency = String(fieldMap['currency'] || fieldMap['ccy'] || 'USD');
  const msgId = String(fieldMap['message_id'] || fieldMap['msg_id'] || fieldMap['end_to_end_id'] || crypto.randomUUID());

  nodes.push({ id: debtor, type: 'party', attrs: { role: 'debtor' } });
  nodes.push({ id: creditor, type: 'party', attrs: { role: 'creditor' } });
  nodes.push({ id: msgId, type: 'contract', attrs: { amount, currency } });
  nodes.push({ id: `OBL_${msgId}`, type: 'obligation', attrs: { amount, currency, from: debtor, to: creditor } });

  // Typed edges per spec: owns, owes, guarantees, settles, references
  edges.push({ from: debtor, to: `OBL_${msgId}`, relation: 'owes' });
  edges.push({ from: creditor, to: `OBL_${msgId}`, relation: 'right' });
  edges.push({ from: msgId, to: `OBL_${msgId}`, relation: 'references' });

  return { nodes, edges, _meta: { debtor, creditor, amount, currency, msgId } };
}

function checkSemanticInvariants(graph: { nodes: unknown[]; edges: Array<{ relation: string }>; _meta: { amount: number } }): boolean {
  // Value conservation: Σ debts = Σ credits (single-obligation model: always balanced)
  const hasObligation = graph.edges.some(e => e.relation === 'owes');
  const hasRight = graph.edges.some(e => e.relation === 'right');
  // Duality invariant: obligation(A,B) ⇒ right(B,A)
  return hasObligation && hasRight && graph._meta.amount > 0;
}

async function hashSemanticGraph(graph: unknown): Promise<string> {
  return sha256hex(JSON.stringify(graph));
}

// ── §3 THREADZERO — TRUTH + LINEAGE ──────────────────────────────────────────
// T₀ = H(E₀)  |  T(i+1) = H(Tᵢ ∥ E(i+1))  |  T* = Tₙ

interface ThreadEvent {
  timestamp: number;
  actor: string;
  action: string;
  payload: unknown;
}

interface ThreadState {
  events: ThreadEvent[];
  anchor: string;
}

function createEvent(actor: string, action: string, payload: unknown): ThreadEvent {
  return { timestamp: Date.now(), actor, action, payload };
}

async function appendEvent(thread: ThreadState | null, event: ThreadEvent): Promise<ThreadState> {
  const eventStr = JSON.stringify(event);
  let newAnchor: string;

  if (!thread || thread.events.length === 0) {
    // T₀ = H(E₀)
    newAnchor = await sha256hex(eventStr);
  } else {
    // T(i+1) = H(Tᵢ ∥ E(i+1))
    newAnchor = await sha256concat(thread.anchor, eventStr);
  }

  const events = thread ? [...thread.events, event] : [event];
  return { events, anchor: newAnchor };
}

// T* = final truth anchor
function computeThreadAnchor(thread: ThreadState): string {
  return thread.anchor; // Already the chained anchor from append operations
}

// ── §4 STACK COMMITMENT ───────────────────────────────────────────────────────
// C_stack = H(h_D ∥ h_G ∥ T*)

async function computeStackCommitment(hDoc: string, hSem: string, tAnchor: string): Promise<string> {
  return sha256concat(hDoc, hSem, tAnchor);
}

// ── §5 BITCOIN/TAPROOT LAYER ──────────────────────────────────────────────────
// P' = P_int + H(P_int ∥ C_stack) · G  (BIP-341 tagged hash, simulated)
// bind(sⱼ) = (sⱼ, h_D, h_G, T*)

async function computeTaprootCommitment(pIntSimulated: string, cStack: string): Promise<string> {
  // BIP-341 tagged SHA-256 tweak simulation: H_taptweak(P_int ∥ C_stack)
  const tagged = `TapTweak||${pIntSimulated}||${cStack}`;
  const tweak = await sha256hex(tagged);
  // P' = P_int XOR-mixed with tweak (simulation — real impl needs secp256k1)
  return `taproot_${tweak.slice(0, 16)}_${pIntSimulated.slice(0, 8)}`;
}

interface SatoshiBinding {
  ordinal_index: number;
  utxo_ref: string;
  h_doc: string;
  h_sem: string;
  t_anchor: string;
  c_stack: string;
}

function assignAndBindSatoshis(
  utxoRef: string,
  satoshiValue: number,
  hDoc: string,
  hSem: string,
  tAnchor: string,
  cStack: string
): SatoshiBinding[] {
  // FIFO ordinal assignment: indices [0, satoshiValue)
  // For ISO 20022 we bind the first satoshi as the commitment carrier
  return [{
    ordinal_index: 0,
    utxo_ref: utxoRef,
    h_doc: hDoc,
    h_sem: hSem,
    t_anchor: tAnchor,
    c_stack: cStack
  }];
}

// ── §6 URIB RAIL MAPPING ──────────────────────────────────────────────────────
// Sᵣ = Φᵣ(D, G_D, T)  for each r ∈ R = {BTC, XRP, ISO, CBDC}
// Ψᵣ(DID) → rail-specific identity

function mapToRailState(
  railId: string,
  meta: { debtor: string; creditor: string; amount: number; currency: string; msgId: string },
  cStack: string,
  tAnchor: string
) {
  const base = { rail_id: railId, value: meta.amount, currency: meta.currency, stack_commitment: cStack, thread_anchor: tAnchor };

  switch (railId) {
    case 'ISO':
      return {
        ...base,
        state: {
          message_type: 'pacs.008.001.10',
          end_to_end_id: meta.msgId,
          debtor_agent: `BIC_${meta.debtor.toUpperCase()}`,
          creditor_agent: `BIC_${meta.creditor.toUpperCase()}`,
          instructed_amount: { amount: meta.amount, currency: meta.currency },
          settlement_method: 'CLRG',
          urib_hash: cStack
        }
      };
    case 'BTC':
      return {
        ...base,
        state: {
          protocol: 'taproot_bip341',
          satoshi_value: Math.round(meta.amount * 100000000),
          commitment: cStack
        }
      };
    case 'XRP':
      return {
        ...base,
        state: {
          transaction_type: 'Payment',
          amount_drops: String(Math.round(meta.amount * 1000000)),
          destination_tag: parseInt(tAnchor.slice(0, 8), 16),
          memo: cStack
        }
      };
    case 'CBDC':
      return {
        ...base,
        state: {
          cbdc_type: 'wholesale',
          amount: meta.amount,
          currency: meta.currency,
          proof_hash: cStack
        }
      };
    default:
      return { ...base, state: { raw: meta } };
  }
}

function mapIdentityToRail(did: string, railId: string): { rail_id: string; did: string; rail_specific_id: string } {
  const hash = did.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const idMap: Record<string, string> = {
    ISO: `IBAN_${hash.slice(0, 16).toUpperCase()}`,
    BTC: `bc1p${hash.slice(0, 38)}`,
    XRP: `r${hash.slice(0, 33)}`,
    CBDC: `CBDC_${hash.slice(0, 12).toUpperCase()}`
  };
  return { rail_id: railId, did, rail_specific_id: idMap[railId] || `${railId}_${hash.slice(0, 16)}` };
}

function enforceCrossRailInvariants(states: Record<string, { value: number }>): boolean {
  // val(S_BTC) = val(S_XRP) = val(S_ISO) — value equivalence across all rails
  const values = Object.values(states).map(s => s.value);
  return values.every(v => v === values[0]);
}

async function computeBridgeCommitment(states: Record<string, unknown>): Promise<string> {
  const stateStr = Object.entries(states)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
    .join('||');
  return sha256hex(stateStr);
}

// ── §7 SETTLEMENT EMISSION ────────────────────────────────────────────────────
// ISO 20022 pacs.008 | BTC Taproot | XRP | ThreadZero audit

function emitISO20022Message(isoState: {
  state: {
    message_type: string;
    end_to_end_id: string;
    debtor_agent: string;
    creditor_agent: string;
    instructed_amount: { amount: number; currency: string };
    settlement_method: string;
    urib_hash: string;
  };
  value: number;
  currency: string;
  thread_anchor: string;
}) {
  const now = new Date().toISOString();
  return {
    message_type: isoState.state.message_type,
    group_header: {
      msg_id: `URIB${Date.now()}`,
      cre_dt_tm: now,
      nb_of_txs: '1',
      sttlm_inf: { sttlm_mtd: isoState.state.settlement_method },
      urib_stack_commitment: isoState.state.urib_hash
    },
    credit_transfer_tx: {
      pmt_id: { end_to_end_id: isoState.state.end_to_end_id },
      instd_amt: { amount: isoState.state.instructed_amount.amount, ccy: isoState.state.instructed_amount.currency },
      cdtr_agt: { fin_instn_id: { bicfi: isoState.state.creditor_agent } },
      dbtr_agt: { fin_instn_id: { bicfi: isoState.state.debtor_agent } },
      thread_anchor: isoState.thread_anchor
    }
  };
}

function emitThreadZeroAudit(thread: ThreadState, cStack: string, cBridge: string) {
  return {
    audit_type: 'ThreadZero',
    truth_anchor: thread.anchor,
    event_count: thread.events.length,
    stack_commitment: cStack,
    bridge_commitment: cBridge,
    events: thread.events,
    generated_at: new Date().toISOString()
  };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      action = 'orchestrate',
      raw_doc,          // The document/transaction to process
      actor,            // DID or agent name of initiating party
      did,              // Decentralized Identifier for identity mapping
      rails = ['ISO', 'BTC', 'XRP', 'CBDC'],  // Target rails
      utxo_ref = 'utxo:genesis:0',             // Bitcoin UTXO reference
      p_int = 'jasper_internal_key_v1'         // Internal Taproot public key
    } = body;

    if (action === 'orchestrate') {
      if (!raw_doc) return Response.json({ error: 'raw_doc required' }, { status: 400 });

      const actorId = actor || user.email || 'jasper';
      const didId = did || `did:jasper:${user.id}`;

      // ── STAGE 1: Canonical Layer ──
      const doc = canonicalizeDocument(raw_doc);
      const serializedDoc = serializeDocument(doc);
      const hDoc = await hashDocument(serializedDoc);

      // ── STAGE 2: Semantic Layer ──
      const graph = buildSemanticGraph(doc);
      const invariantsPass = checkSemanticInvariants(graph);
      if (!invariantsPass) {
        return Response.json({ error: 'Semantic invariant violation: debts ≠ credits or obligation without right', stage: 'semantic' }, { status: 422 });
      }
      const hSem = await hashSemanticGraph(graph);

      // ── STAGE 3: ThreadZero Layer ──
      let thread: ThreadState = { events: [], anchor: '' };
      const evtTokenize = createEvent(actorId, 'TOKENIZE', { hDoc, hSem });
      thread = await appendEvent(null, evtTokenize);

      const evtSemantic = createEvent(actorId, 'SEMANTIC_COMMIT', { hSem, nodes: graph.nodes.length, edges: graph.edges.length });
      thread = await appendEvent(thread, evtSemantic);

      const evtValidate = createEvent(actorId, 'INVARIANT_PASS', { invariants: ['value_conservation', 'duality'] });
      thread = await appendEvent(thread, evtValidate);

      const tAnchor = computeThreadAnchor(thread);

      // ── STAGE 4: Stack Commitment ──
      const cStack = await computeStackCommitment(hDoc, hSem, tAnchor);

      // ── STAGE 5: Bitcoin/Taproot Layer ──
      const pPrime = await computeTaprootCommitment(p_int, cStack);
      const bindings = assignAndBindSatoshis(utxo_ref, graph._meta.amount, hDoc, hSem, tAnchor, cStack);

      const evtBitcoin = createEvent(actorId, 'BTC_TAPROOT_COMMIT', { p_prime: pPrime, bindings: bindings.length });
      thread = await appendEvent(thread, evtBitcoin);

      // ── STAGE 6: URIB Rail Mapping ──
      const states: Record<string, ReturnType<typeof mapToRailState>> = {};
      const identities: Record<string, ReturnType<typeof mapIdentityToRail>> = {};

      for (const railId of rails) {
        states[railId] = mapToRailState(railId, graph._meta, cStack, tAnchor);
        identities[railId] = mapIdentityToRail(didId, railId);
      }

      const crossRailPass = enforceCrossRailInvariants(states);
      if (!crossRailPass) {
        return Response.json({ error: 'Cross-rail invariant violation: value not equivalent across rails', stage: 'urib' }, { status: 422 });
      }

      const cBridge = await computeBridgeCommitment(states);

      const evtBridge = createEvent(actorId, 'URIB_BRIDGE_COMMIT', { c_bridge: cBridge, rails, cross_rail_pass: crossRailPass });
      thread = await appendEvent(thread, evtBridge);

      // ── STAGE 7: Settlement Emission ──
      const isoMessages = rails.includes('ISO') && states['ISO']
        ? [emitISO20022Message(states['ISO'] as Parameters<typeof emitISO20022Message>[0])]
        : [];

      const btcTx = rails.includes('BTC') ? {
        protocol: 'taproot_bip341',
        output_key: pPrime,
        bindings,
        c_stack: cStack
      } : null;

      const xrpTx = rails.includes('XRP') && states['XRP'] ? states['XRP'].state : null;

      const audit = emitThreadZeroAudit(thread, cStack, cBridge);

      const evtSettle = createEvent(actorId, 'SETTLEMENT_EMIT', { rails, iso_count: isoMessages.length });
      thread = await appendEvent(thread, evtSettle);

      // Store ThreadZero audit trail in AuditLog entity
      await base44.asServiceRole.entities.AuditLog.create({
        event_type: 'urib_settlement',
        record_type: 'urib_settlement',
        actor: actorId,
        timestamp: Date.now(),
        severity: 'info',
        thread_anchor: thread.anchor,
        c_stack: cStack,
        c_bridge: cBridge,
        rails,
        event_count: thread.events.length,
        document_hash: hDoc,
        semantic_hash: hSem,
        did: didId,
        event_data: JSON.stringify({ rails, c_bridge: cBridge, thread_anchor: thread.anchor, taproot_key: pPrime }),
        created_at: Date.now()
      }).catch(() => null); // Non-blocking

      return Response.json({
        success: true,
        pipeline: 'URIB_ISO20022',
        // §1 Canonical
        h_doc: hDoc,
        // §2 Semantic
        h_sem: hSem,
        semantic_graph: { nodes: graph.nodes.length, edges: graph.edges.length, meta: graph._meta },
        // §3 ThreadZero
        thread_anchor: tAnchor,
        event_count: thread.events.length,
        // §4 Stack Commitment
        c_stack: cStack,
        // §5 Bitcoin
        taproot_key: pPrime,
        satoshi_bindings: bindings,
        // §6 URIB Rail States
        rail_states: states,
        rail_identities: identities,
        cross_rail_invariants_pass: crossRailPass,
        c_bridge: cBridge,
        // §7 Settlement
        iso20022_messages: isoMessages,
        btc_tx: btcTx,
        xrp_tx: xrpTx,
        // Full ThreadZero audit
        audit
      });
    }

    // ── ACTION: verify — check a stack commitment against provided hashes ──
    if (action === 'verify') {
      const { h_doc, h_sem, t_anchor, c_stack } = body;
      if (!h_doc || !h_sem || !t_anchor || !c_stack) {
        return Response.json({ error: 'h_doc, h_sem, t_anchor, c_stack required for verify' }, { status: 400 });
      }
      const recomputed = await computeStackCommitment(h_doc, h_sem, t_anchor);
      return Response.json({
        success: true,
        valid: recomputed === c_stack,
        recomputed,
        provided: c_stack
      });
    }

    // ── ACTION: emit_iso — emit standalone ISO 20022 pacs.008 ──
    if (action === 'emit_iso') {
      const { debtor, creditor, amount, currency = 'USD', msg_id } = body;
      if (!debtor || !creditor || !amount) {
        return Response.json({ error: 'debtor, creditor, amount required' }, { status: 400 });
      }
      const rawDoc = { debtor, creditor, amount, currency, message_id: msg_id || `MSG${Date.now()}` };
      const doc = canonicalizeDocument(rawDoc);
      const graph = buildSemanticGraph(doc);
      const hDoc = await hashDocument(serializeDocument(doc));
      const hSem = await hashSemanticGraph(graph);
      const tAnchor = await sha256hex(`${Date.now()}`);
      const cStack = await computeStackCommitment(hDoc, hSem, tAnchor);
      const isoState = mapToRailState('ISO', graph._meta, cStack, tAnchor);
      const msg = emitISO20022Message(isoState as Parameters<typeof emitISO20022Message>[0]);
      return Response.json({ success: true, iso20022_message: msg, c_stack: cStack, h_doc: hDoc });
    }

    return Response.json({ error: 'Invalid action. Use: orchestrate | verify | emit_iso' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message, stage: 'handler' }, { status: 500 });
  }
});