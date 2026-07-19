# PQ_NATIVE Jasper OS Runtime Spec
### Jasper OS Runtime — Version 2 (PQ_NATIVE Mode)
**Status:** Implementation-Ready
**Author:** Leon C. Long II
**System:** Jasper OS / URIB / ThreadZero / DID Layer
**Version:** 3.0
**Depends on:** JIP-QRM-01 (HYBRID_V1), JIP-QRM-02 (PQ_ONLY), JIP-QRM-03 (PQ_NATIVE)

---

## 1. Runtime overview

**Name:** Jasper OS Runtime
**Mode:** `PQ_NATIVE`
**Version:** `3.0`
**Primary Role:** Deterministic agentic orchestration with post-quantum-only cryptography across identity, audit, and settlement surfaces.

---

## 2. Core runtime properties

- **Crypto mode:** `PQ_NATIVE`
- **Determinism:** All agent workflows must be reproducible from ThreadZero + URIB state.
- **Governance:** All agent actions must be traceable to DID identities and delegation chains.
- **Isolation:** Agents run in constrained enclaves with explicit capabilities.
- **Auditability:** Every state transition is committed to ThreadZero with PQ signatures.

---

## 3. Cryptographic layer (PQ_NATIVE)

**Exclusive algorithms:**

- **Signatures:** `ML-DSA-65`
- **Key exchange / KEM:** `ML-KEM-768`

**Runtime requirements:**

- Only ML-DSA-65 and ML-KEM-768 are available in the runtime crypto API.
- Classical and hybrid algorithms must not be loadable or callable.
- All runtime subsystems (identity, audit, settlement, delegation) must consume the same PQ primitives.

> **Implementation note:** The Deno runtime crypto layer (`quantumResilience`)
> currently exposes `pq_sign` / `pq_verify` (PQ_ONLY, block v2) and
> `pq_native_sign` / `pq_native_verify` (PQ_NATIVE, block v3) backed by a
> deterministic HMAC-SHA256 construction standing in for ML-DSA-65. A native
> ML-DSA-65 library lands in a future runtime upgrade; the enforcement,
> decommission, and verification flows are fully exercised today.

---

## 4. Identity and agent model

### 4.1 DID identity

- All agents, services, and rails are represented as DIDs:
  - `did:jasper:<agent-id>`
- DID documents must include:
  - `verificationMethod` with ML-DSA-65 keys only
  - `crypto_profile: PQ_NATIVE`
  - `did_version: 3`

### 4.2 Agent identity

- Each agent has:
  - **Agent DID**
  - **Agent PQ signing key (ML-DSA-65)**
  - **Agent PQ KEM key (ML-KEM-768)**
- Agents must authenticate via DID-based signatures on:
  - session tokens
  - delegation records
  - runtime capability grants

---

## 5. Delegation and governance

### 5.1 Delegation chains

- Delegation records must include:
  - `delegation_sig_pq` (ML-DSA-65)
  - `crypto_profile: PQ_NATIVE`
  - `delegation_version: 3`
- A delegation chain is valid only if:
  - every hop uses PQ signatures
  - every hop resolves to a PQ_NATIVE DID
  - every hop is committed to ThreadZero.

### 5.2 Governance tiers

- Runtime enforces governance tiers:
  - `TIER_0`: System / URIB / ThreadZero
  - `TIER_1`: Financial / identity-critical agents
  - `TIER_2`: Operational / workflow agents
  - `TIER_3`: Low-risk / utility agents
- Higher tiers require:
  - stricter delegation chains
  - explicit human-in-the-loop (HITL) gates
  - stronger audit requirements.

---

## 6. Audit and truth layer (ThreadZero)

### 6.1 Block structure

- Each block must include:
  - `sig_pq` (ML-DSA-65)
  - `crypto_profile: PQ_NATIVE`
  - `block_version: 3`
  - `state_root` (hash of runtime state)
  - `event_root` (hash of events)
  - `agent_root` (hash of agent identities / delegations)

### 6.2 Runtime commitments

- Every runtime action that changes state must:
  - emit a ThreadZero event
  - be included in the next block
  - be verifiable via PQ signatures only.

---

## 7. URIB settlement integration

### 7.1 URIB commitments

- All URIB commitments must include:
  - `commitment_signature_pq`
  - `crypto_profile: PQ_NATIVE`
  - `commitment_version: 3`
- Runtime must:
  - validate URIB commitments before applying financial state changes
  - ensure URIB invariants hold across rails.

### 7.2 Rails

- Supported rails (ACH, RTP, FedWire, SWIFT, blockchain) are modeled as:
  - PQ-native settlement surfaces
  - each with a DID and PQ keys
- Runtime must treat rails as agents with:
  - capabilities
  - governance tier
  - URIB invariant constraints.

---

## 8. Runtime execution model

### 8.1 Agent enclaves

- Agents run in **enclaves** with:
  - bounded capabilities
  - explicit resource limits
  - explicit rail access policies
  - explicit identity bindings.

### 8.2 Deterministic workflows

- All workflows must be:
  - reconstructable from ThreadZero + URIB + DID state
  - free of hidden side effects
  - governed by explicit policies.

### 8.3 Capability grants

- Capabilities are granted via:
  - PQ-signed delegation records
  - DID-bound policies
  - governance tier rules.

---

## 9. Runtime configuration

### 9.1 Global config

- `runtime_crypto_mode: PQ_NATIVE`
- `runtime_version: 3`
- `threadzero_profile: PQ_NATIVE`
- `did_profile: PQ_NATIVE`
- `urib_profile: PQ_NATIVE`

### 9.2 Policy config

- `max_delegation_depth`
- `allowed_rails_per_agent`
- `required_tier_for_financial_actions`
- `hitl_required_for_tier_0/1 actions`.

---

## 10. Observability and dashboards

- Quantum Readiness Panel must show:
  - `ThreadZero: PQ_NATIVE`
  - `DID Layer: PQ_NATIVE`
  - `URIB: PQ_NATIVE`
  - `Agents PQ-Native: <count>/<total>`
  - `Legacy Objects Archived: <count>`
  - `PQ-Native Coverage: <percentage>`

---

## 11. Acceptance

The runtime satisfies PQ_NATIVE when:

- `runtime_crypto_mode == PQ_NATIVE` and `runtime_version == 3`
- Every surface reports `PQ_NATIVE` on the Quantum Readiness Panel
- No classical/hybrid keys remain active or unarchived
- `pq_native_sign` / `pq_native_verify` round-trip with `block_version: 3`
- Legacy objects are sealed (`archived: true`, `legacy_verification_supported: false`)