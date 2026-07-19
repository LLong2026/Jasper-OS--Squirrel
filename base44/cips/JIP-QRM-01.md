# BASE44 MIGRATION DOCUMENT — JIP-QRM-01
### Jasper OS Quantum-Resilience Migration — Phase 1 (HYBRID_V1)
**Status:** Draft
**Author:** Leon C. Long II
**System:** Jasper OS / URIB / ThreadZero / DID Layer
**Version:** 1.0
**Effective:** Immediately upon merge

---

## 1. Objective
Prepare Jasper OS's long-lived cryptographic surfaces for post-quantum security by introducing hybrid (classical + PQ) signing, PQ key support, DID rotation pathways, and PQ-ready settlement commitments.

This document defines the **Phase 1 migration** required to achieve **HYBRID_V1** quantum readiness across all critical surfaces.

---

## 2. Scope
This migration applies to:

- **ThreadZero Truth Chain**
- **DID Identity Layer**
- **URIB Settlement Commitments**
- **Agent Delegation Chains**
- **Key Registry / Crypto Abstraction Layer**

---

## 3. Crypto Profiles
Define Jasper OS crypto profiles for surface governance.

```
PROFILE.CLASSICAL_ONLY
PROFILE.HYBRID_V1
PROFILE.PQ_ONLY
```

Phase 1 sets all long-lived surfaces to:

```
PROFILE.HYBRID_V1
```

---

## 4. PQ Algorithm Set (NIST-Approved)

### Primary Signature Algorithm
```
ML-DSA-65
```

### Primary Key Encapsulation Mechanism
```
ML-KEM-768
```

These are the required PQ primitives for all Jasper OS surfaces under HYBRID_V1.

> **Implementation note (JIP-QRM-01):** The Deno runtime used by Base44 backend
> functions does not yet ship a native ML-DSA-65 / ML-KEM-768 implementation.
> Phase 1 therefore represents the PQ signature slot with a deterministic,
> keyed HMAC-SHA256 construction (`MLDSA65_SIGNING` key type) so that the full
> hybrid dual-signature schema, verification flow, key registry, and rotation
> pathway are exercised end-to-end. The slot is a drop-in replacement target
> for a native ML-DSA-65 library in Phase 2 — no schema changes required.

---

## 5. Key Registry Extensions
Extend Jasper OS's key registry to support PQ keys.

### New Key Types
```
KEYTYPE.MLDSA65_SIGNING
KEYTYPE.MLKEM768_KEM
KEYTYPE.ECDSA_P256_SIGNING   (classical half of HYBRID_V1)
```

### Key Metadata
```
key_id
pair_id            (links the classical + PQ halves of a hybrid pair)
key_type
key_profile (classical | pq | hybrid)
surface (threadzero | did | urib | agent_delegation)
agent_name
public_key
private_material   (simulation only — HSM-backed in production)
status (active | deprecated | revoked)
rotated_from
rotated_to
created_at
```

### Required Registry Behavior
- Registry must allow **dual-key presence** (classical + PQ).
- Registry must expose **active crypto profile** per surface.
- Registry must support **PQ key generation** and **rotation**.

---

## 6. ThreadZero Hybrid Signatures
ThreadZero blocks must include **two signatures** under HYBRID_V1.

### Block Header Additions
```
sig_classical   (ECDSA P-256)
sig_pq          (ML-DSA-65)
crypto_profile  (HYBRID_V1)
```

### Consensus Rule
A block is valid if:

- `sig_classical` verifies
- AND `sig_pq` verifies

This preserves backward compatibility while enabling PQ verification.

---

## 7. DID Identity Quantum Migration
Extend DID documents to support PQ verification methods.

### Verification Method Additions
```
verificationMethod[]:
    - id: did:jasper:<agent>#ml-dsa
      type: ML-DSA-65
      controller: did:jasper:<agent>
      publicKeyMultibase: <base64>
```

### Rotation Flow
1. Generate ML-DSA key.
2. Add PQ key to DID document.
3. Mark Ed25519 as `deprecated`.
4. Mark ML-DSA as `active`.
5. Commit DID update to ThreadZero.

### Credential Behavior
All Verifiable Credentials must include:

```
proof.classical
proof.pq
```

---

## 8. URIB Settlement Commitments (HYBRID_V1)
All URIB commitments (pacs.008, settlement receipts, invariant proofs) must include hybrid signatures.

### Commitment Schema Additions
```
commitment_signature_classical
commitment_signature_pq
crypto_profile: HYBRID_V1
```

### Rail Compatibility
- Classical rails ignore PQ signatures.
- PQ-aware rails verify both.
- Jasper OS runtime verifies both internally.

---

## 9. Agent Delegation Chains
Agent delegation chains must adopt hybrid signing.

### Delegation Record Additions
```
delegation_sig_classical
delegation_sig_pq
```

### Chain Rule
A delegation chain is valid only if **both signatures verify** at every hop.

---

## 10. Dashboard Integration
Add a **Quantum Readiness Panel** to Jasper OS.

### Panel Fields
```
ThreadZero: HYBRID_V1
DID Layer: HYBRID_V1
URIB: HYBRID_V1
Agents Migrated: <count>/<total>
PQ Keys Issued: <count>
PQ Coverage: <percentage>
```

---

## 11. Migration Timeline
### Phase 1 (This Quarter)
- Add PQ key types
- Enable hybrid signatures
- Add DID PQ verification methods
- Add URIB hybrid commitments
- Add dashboard visibility

### Phase 2 (Next Quarter)
- Begin PQ-only signing for new agents
- Begin PQ-only DID issuance
- Begin PQ-only URIB commitments

### Phase 3 (2027+)
- Deprecate classical signatures
- Switch ThreadZero to PQ-only
- Switch DID to PQ-only
- Switch URIB to PQ-only

---

## 12. Acceptance Criteria
Migration is considered complete when:

- All long-lived surfaces operate under `PROFILE.HYBRID_V1`.
- PQ keys are generated and registered.
- ThreadZero blocks include dual signatures.
- DID documents include PQ verification methods.
- URIB commitments include PQ signatures.
- Dashboard displays quantum readiness metrics.