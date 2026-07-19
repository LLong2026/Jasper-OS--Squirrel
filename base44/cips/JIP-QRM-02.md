# BASE44 MIGRATION DOCUMENT — JIP-QRM-02
### Jasper OS Quantum-Resilience Migration — Phase 2 (PQ_ONLY)
**Status:** Draft
**Author:** Leon C. Long II
**System:** Jasper OS / URIB / ThreadZero / DID Layer
**Version:** 2.0
**Effective:** Upon completion of Phase 1 HYBRID_V1 rollout

---

## 1. Objective
Transition Jasper OS from hybrid cryptography to **post-quantum-only (PQ_ONLY)** cryptographic primitives across all long-lived surfaces:

- ThreadZero Truth Chain
- DID Identity Layer
- URIB Settlement Commitments
- Agent Delegation Chains
- Jasper OS Runtime Crypto Layer

This phase removes classical cryptography from critical surfaces and enforces PQ-only verification.

---

## 2. Scope
Phase 2 applies to:

- All new ThreadZero blocks
- All new DID documents
- All new Verifiable Credentials
- All new URIB commitments
- All new agent delegation records
- All new agent identity keys
- All new settlement signatures

Classical cryptography remains available only for legacy verification, not for new issuance.

---

## 3. Crypto Profile Enforcement
Set all long-lived surfaces to:

```
PROFILE.PQ_ONLY
```

Classical signatures must not be generated for any new object.

Legacy objects remain verifiable but are marked:

```
crypto_profile: LEGACY_CLASSICAL
```

> **Implementation note (JIP-QRM-02):** A surface is classified `PQ_ONLY` when it
> has an active `MLDSA65_SIGNING` key and **no** active classical
> (`ECDSA_P256_SIGNING`) key. Revoking the classical half of a hybrid pair flips
> that surface from `HYBRID_V1` to `PQ_ONLY`. The runtime mode is derived
> globally: `PQ_ONLY` once every surface is PQ_ONLY, else `HYBRID_V1` while any
> surface still retains an active classical key.

---

## 4. PQ Algorithm Set (Mandatory)

### Signature Algorithm
```
ML-DSA-65 (mandatory)
```

### Key Encapsulation Mechanism
```
ML-KEM-768 (mandatory)
```

These algorithms replace ECDSA, Ed25519, and X25519 for all new cryptographic operations.

> **Implementation note:** As in Phase 1, the Deno runtime does not yet ship a
> native ML-DSA-65 implementation. The PQ slot remains a deterministic
> HMAC-SHA256 construction standing in for ML-DSA-65 — structurally identical
> to the production signature, so the PQ_ONLY enforcement, revocation, and
> verification flows are fully exercised. Phase 3 swaps in a native library.

---

## 5. Key Registry Enforcement
### New Requirements
- PQ keys must be the **only** active keys for all new agents.
- Classical keys must be marked as `revoked` or `legacy`.
- Registry must reject creation of classical keys unless explicitly flagged for backward compatibility.

### Key Metadata Additions
```
revocation_reason: "Quantum Migration"
revocation_date: <timestamp>
legacy_verification_supported: true|false
```

---

## 6. ThreadZero PQ-Only Blocks
ThreadZero block headers must remove classical signatures entirely.

### New Block Header Schema
```
sig_pq          (ML-DSA-65)
crypto_profile  (PQ_ONLY)
block_version   (2)
```

### Consensus Rule
A block is valid only if:

- `sig_pq` verifies
- `crypto_profile == PQ_ONLY`
- `block_version >= 2`

Classical signatures are no longer accepted for new blocks.

---

## 7. DID Identity PQ-Only Mode
All new DID documents must use PQ verification methods exclusively.

### Verification Method Schema
```
verificationMethod[]:
    - id: did:jasper:<agent>#ml-dsa
      type: ML-DSA-65
      controller: did:jasper:<agent>
      publicKeyMultibase: <base64>
```

### Rotation Behavior
- Classical keys must be fully revoked.
- PQ keys become the sole verification method.
- DID documents must include:

```
crypto_profile: PQ_ONLY
```

### Credential Behavior
All Verifiable Credentials must include:

```
proof.pq
```

Classical proofs are forbidden for new credentials.

---

## 8. URIB Settlement Commitments (PQ_ONLY)
All new URIB commitments must use PQ signatures exclusively.

### Commitment Schema
```
commitment_signature_pq
crypto_profile: PQ_ONLY
commitment_version: 2
```

### Rail Behavior
- PQ-aware rails verify PQ signatures.
- Classical rails must rely on legacy commitments only.
- Jasper OS runtime enforces PQ-only issuance.

---

## 9. Agent Delegation Chains (PQ_ONLY)
All new delegation records must use PQ signatures exclusively.

### Delegation Record Schema
```
delegation_sig_pq
crypto_profile: PQ_ONLY
delegation_version: 2
```

### Chain Rule
A delegation chain is valid only if **every hop** uses PQ signatures.

---

## 10. Runtime Enforcement
The Jasper OS runtime must:

- Reject classical signing attempts
- Reject classical key creation
- Reject classical DID verification for new objects
- Reject classical URIB commitments
- Reject classical agent delegation records

Runtime must expose:

```
runtime_crypto_mode: PQ_ONLY
```

---

## 11. Dashboard Integration
Update Quantum Readiness Panel:

### Panel Fields
```
ThreadZero: PQ_ONLY
DID Layer: PQ_ONLY
URIB: PQ_ONLY
Agents PQ-Only: <count>/<total>
Legacy Objects Remaining: <count>
PQ Coverage: <percentage>
```

---

## 12. Migration Timeline
### Phase 2 (PQ_ONLY)
- Enforce PQ-only issuance
- Revoke classical keys
- Remove classical signatures from new blocks
- Remove classical verification from new DIDs
- Remove classical commitments from new URIB records
- Enforce PQ-only delegation chains

### Phase 3 (Full Decommission)
- Remove classical verification entirely
- Archive legacy objects
- Switch Jasper OS to **PQ_NATIVE** mode

---

## 13. Acceptance Criteria
Phase 2 is complete when:

- All new cryptographic objects use PQ-only signatures
- All new DIDs use PQ-only verification methods
- All new URIB commitments use PQ-only signatures
- All new ThreadZero blocks use PQ-only signatures
- All new agent delegation chains use PQ-only signatures
- Runtime rejects classical cryptography for new issuance
- Dashboard reports **PQ_ONLY** across all surfaces