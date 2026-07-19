# PQ_NATIVE DID Governance Spec
### Jasper DID Governance — Version 3 (PQ_NATIVE Mode)
**Status:** Implementation-Ready
**Author:** Leon C. Long II
**System:** Jasper OS / DID Layer / ThreadZero / URIB
**Version:** 3
**Depends on:** JIP-QRM-01/02/03, JIP-QRM-RT-01 (PQ_NATIVE Runtime Spec), JIP-QRM-URIB-01 (URIB Settlement Schema v3)

---

## 1. Overview

**Name:** Jasper DID Governance
**Mode:** `PQ_NATIVE`
**Version:** `3`
**Role:** Govern creation, rotation, revocation, and use of DIDs and keys for all Jasper OS identities (agents, rails, services) under post-quantum-only cryptography.

---

## 2. Identity types

- **Agent DID:** `did:jasper:agent:<id>`
- **Rail DID:** `did:jasper:rail:<id>`
- **Service DID:** `did:jasper:svc:<id>`
- **System DID (ThreadZero / URIB):** `did:jasper:sys:<id>`

All DIDs must operate under:

```json
"crypto_profile": "PQ_NATIVE",
"did_version": 3
```

> **Implementation note:** The `AgentIdentity` entity stores `did`, `public_key`,
> `governance_profile`, `credentials`, and `trust_score`. The `agenticIdentityLayer`
> function mints `did:jasper:<agent>` records and stamps `truth_chain_anchor`
> ThreadZero hashes. PQ-native DID issuance/verification is exercised through the
> `quantumResilience` crypto layer (`pq_native_sign` / `pq_native_verify`,
> `surface: did`, `block_version: 3`). Full W3C DID-document emission lands in a
> future wiring step; the enforcement and decommission flows are live today.

---

## 3. Verification methods (PQ-only)

Each DID document must include **only** PQ verification methods.

```json
"verificationMethod": [
  {
    "id": "did:jasper:agent:<id>#ml-dsa",
    "type": "ML-DSA-65",
    "controller": "did:jasper:agent:<id>",
    "publicKeyMultibase": "<base64-ml-dsa-key>"
  }
]
```

Optional KEM method (for secure channels):

```json
{
  "id": "did:jasper:agent:<id>#ml-kem",
  "type": "ML-KEM-768",
  "controller": "did:jasper:agent:<id>",
  "publicKeyMultibase": "<base64-ml-kem-key>"
}
```

No Ed25519, X25519, ECDSA, or hybrid methods are allowed.

---

## 4. DID document core fields

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://jasper.os/did/v3"
  ],
  "id": "did:jasper:agent:<id>",
  "verificationMethod": [ /* PQ methods only */ ],
  "authentication": [
    "did:jasper:agent:<id>#ml-dsa"
  ],
  "assertionMethod": [
    "did:jasper:agent:<id>#ml-dsa"
  ],
  "keyAgreement": [
    "did:jasper:agent:<id>#ml-kem"
  ],
  "service": [ /* optional */ ],
  "crypto_profile": "PQ_NATIVE",
  "did_version": 3,
  "governance_tier": "TIER_0|TIER_1|TIER_2|TIER_3"
}
```

---

## 5. Governance tiers

- **TIER_0:** System / URIB / ThreadZero
- **TIER_1:** Financial / identity-critical agents
- **TIER_2:** Operational agents
- **TIER_3:** Utility / low-risk agents

Higher tiers require:

- stricter delegation rules
- stronger audit requirements
- human-in-the-loop (HITL) for certain actions.

---

## 6. DID lifecycle

### 6.1 Creation

Rules:

- Only PQ keys may be generated.
- DID must be registered with:
  - `crypto_profile: PQ_NATIVE`
  - `did_version: 3`
  - `governance_tier` set explicitly.
- Creation must be committed to ThreadZero with PQ signatures.

### 6.2 Rotation

Rotation is PQ-to-PQ only.

```json
"rotation": {
  "previous_key_id": "<old-ml-dsa-key-id>",
  "new_key_id": "<new-ml-dsa-key-id>",
  "rotated_at": "<timestamp>",
  "rotation_reason": "KEY_COMPROMISE|KEY_EXPIRY|POLICY_CHANGE"
}
```

Rules:

- Classical keys must not exist.
- Rotation events must be committed to ThreadZero.
- Delegation chains must be updated to reference new keys.

> The `KeyRegistry` entity tracks `rotated_from` / `rotated_to` `pair_id` links;
> `quantumResilience` enforces PQ-only rotation once a surface is in PQ_NATIVE.

### 6.3 Revocation

Revocation marks a DID as non-usable.

```json
"revocation": {
  "revoked": true,
  "revocation_reason": "COMPROMISE|DECOMMISSION|POLICY",
  "revocation_date": "<timestamp>"
}
```

Rules:

- Revoked DIDs cannot be used for:
  - authentication
  - assertion
  - settlement
  - delegation.
- Revocation must be committed to ThreadZero.

> `KeyRegistry.status ∈ {active, deprecated, revoked}` and `revocation_reason` /
> `revocation_date` capture this lifecycle; `AgentIdentity.status ∈ {pending,
> active, suspended, revoked}` mirrors it at the identity layer.

---

## 7. Delegation governance

Delegation is expressed via PQ-signed records bound to DIDs.

### 7.1 Delegation record

```json
{
  "delegation_id": "DEL-<uuid>",
  "delegator_did": "did:jasper:agent:<id>",
  "delegatee_did": "did:jasper:agent:<id>",
  "capabilities": [
    "SETTLEMENT_EXECUTE",
    "IDENTITY_ASSERT",
    "RAIL_ACCESS:ACH"
  ],
  "governance_tier": "TIER_0|TIER_1|TIER_2|TIER_3",
  "delegation_version": 3,
  "crypto_profile": "PQ_NATIVE",
  "delegation_sig_pq": "<ML-DSA-65-signature>",
  "issued_at": "<timestamp>",
  "expires_at": "<timestamp>"
}
```

Rules:

- Only PQ signatures allowed.
- Delegation must be consistent with governance tier.
- Delegation must be committed to ThreadZero.

> `KeyRegistry.surface = "agent_delegation"` carries the PQ keys backing these
> records; `quantumResilience` (`surface: agent_delegation`) issues/verifies them.

---

## 8. Verifiable Credentials (VC) under PQ_NATIVE

All VCs must be PQ-only.

### 8.1 VC proof

```json
"proof": {
  "type": "ML-DSA-65",
  "created": "<timestamp>",
  "verificationMethod": "did:jasper:agent:<id>#ml-dsa",
  "proofPurpose": "assertionMethod",
  "crypto_profile": "PQ_NATIVE",
  "proof_version": 3,
  "jws": "<pq-signature>"
}
```

No classical or hybrid proofs allowed.

> `AgentIdentity.credentials[]` stores VC objects; PQ-native issuance stamps
> `proof_version: 3` / `crypto_profile: PQ_NATIVE`.

---

## 9. Policy rules

Key policies:

- **No classical keys** in any DID.
- **No hybrid keys** in any DID.
- All DID operations must be:
  - PQ-signed
  - committed to ThreadZero
  - consistent with governance tier.

Runtime must enforce:

- `did.crypto_profile == "PQ_NATIVE"`
- `did.did_version == 3`
- `verificationMethod[*].type ∈ { "ML-DSA-65", "ML-KEM-768" }`.

---

## 10. Example PQ_NATIVE DID document

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://jasper.os/did/v3"
  ],
  "id": "did:jasper:agent:alpha",
  "verificationMethod": [
    {
      "id": "did:jasper:agent:alpha#ml-dsa",
      "type": "ML-DSA-65",
      "controller": "did:jasper:agent:alpha",
      "publicKeyMultibase": "<base64-ml-dsa-key>"
    },
    {
      "id": "did:jasper:agent:alpha#ml-kem",
      "type": "ML-KEM-768",
      "controller": "did:jasper:agent:alpha",
      "publicKeyMultibase": "<base64-ml-kem-key>"
    }
  ],
  "authentication": [
    "did:jasper:agent:alpha#ml-dsa"
  ],
  "assertionMethod": [
    "did:jasper:agent:alpha#ml-dsa"
  ],
  "keyAgreement": [
    "did:jasper:agent:alpha#ml-kem"
  ],
  "crypto_profile": "PQ_NATIVE",
  "did_version": 3,
  "governance_tier": "TIER_1"
}
``