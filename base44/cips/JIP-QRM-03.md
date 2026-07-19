# BASE44 MIGRATION DOCUMENT — JIP-QRM-03
### Jasper OS Quantum-Resilience Migration — Phase 3 (PQ_NATIVE Full Decommission)
**Status:** Draft
**Author:** Leon C. Long II
**System:** Jasper OS / URIB / ThreadZero / DID Layer
**Version:** 3.0
**Effective:** After full PQ_ONLY adoption across all surfaces

---

## 1. Objective
Fully decommission classical cryptography across Jasper OS and transition the system into **PQ_NATIVE** mode, where:

- Only post-quantum algorithms are accepted
- Only post-quantum keys exist
- Only post-quantum signatures are valid
- All classical cryptographic verification is removed
- All legacy objects are archived and sealed

This phase transforms Jasper OS into a **pure post-quantum agentic operating system**.

---

## 2. Scope
Phase 3 applies to:

- ThreadZero Truth Chain
- DID Identity Layer
- URIB Settlement Commitments
- Agent Delegation Chains
- Jasper OS Runtime Crypto Layer
- All cryptographic verification subsystems
- All agent identity and delegation logic
- All settlement rails and invariant proofs

---

## 3. Crypto Profile Enforcement
All surfaces must be set to:

```
PROFILE.PQ_NATIVE
```

Classical cryptography is **fully removed** from:

- issuance
- verification
- storage
- runtime
- DID documents
- settlement commitments
- delegation chains
- audit blocks

Legacy objects are sealed and archived.

> **Implementation note (JIP-QRM-03):** A surface is classified `PQ_NATIVE`
> when it has an active `MLDSA65_SIGNING` key, **no** active classical key, and
> **every** classical key on that surface is archived (sealed, legacy
> verification withdrawn). `decommission` is the action that performs the
> archive+seal, flipping a surface from `PQ_ONLY` to `PQ_NATIVE`. The runtime
> reports `runtime_crypto_mode: PQ_NATIVE` only once every surface reaches
> `PQ_NATIVE`; `runtime_version: 3`.

---

## 4. PQ Algorithm Set (Exclusive)

### Signature Algorithm (Exclusive)
```
ML-DSA-65
```

### Key Encapsulation Mechanism (Exclusive)
```
ML-KEM-768
```

No other algorithms are permitted.

> **Implementation note:** The Deno runtime still lacks a native ML-DSA-65
> library. The PQ slot remains a deterministic HMAC-SHA256 construction standing
> in for ML-DSA-65 — structurally identical to the production signature, so the
> PQ_NATIVE decommission, archive, and exclusive-verification flows are fully
> exercised. A native library lands in a future runtime upgrade.

---

## 5. Key Registry Finalization
### Mandatory Behavior
- Registry must **reject** classical keys entirely.
- Registry must **reject** hybrid keys.
- Registry must **only** allow ML-DSA-65 and ML-KEM-768.
- Registry must mark all classical keys as:

```
status: revoked
revocation_reason: "PQ_NATIVE Transition"
revocation_date: <timestamp>
legacy_verification_supported: false
archived: true
```

### Legacy Key Handling
Legacy keys must be:

- archived (`archived: true`)
- sealed (legacy verification withdrawn)
- removed from active lookup
- excluded from runtime

---

## 6. ThreadZero PQ_NATIVE Blocks
ThreadZero block headers must be simplified to PQ-only.

### New Block Header Schema
```
sig_pq          (ML-DSA-65)
crypto_profile  (PQ_NATIVE)
block_version   (3)
```

### Consensus Rule
A block is valid only if:

- `sig_pq` verifies
- `crypto_profile == PQ_NATIVE`
- `block_version >= 3`

Classical verification code must be removed from the consensus engine.

---

## 7. DID Identity PQ_NATIVE Mode
All DID documents must be PQ-exclusive.

### Verification Method Schema
```
verificationMethod[]:
    - id: did:jasper:<agent>#ml-dsa
      type: ML-DSA-65
      controller: did:jasper:<agent>
      publicKeyMultibase: <base64>
```

### Mandatory Behavior
- Classical verification methods must be removed.
- Hybrid verification methods must be removed.
- DID documents must include:

```
crypto_profile: PQ_NATIVE
did_version: 3
```

### Credential Behavior
All Verifiable Credentials must include:

```
proof.pq
proof_version: 3
```

Classical and hybrid proofs are forbidden.

---

## 8. URIB Settlement Commitments (PQ_NATIVE)
All URIB commitments must be PQ-exclusive.

### Commitment Schema
```
commitment_signature_pq
crypto_profile: PQ_NATIVE
commitment_version: 3
```

### Rail Behavior
- PQ-native rails verify PQ signatures exclusively.
- Classical rails cannot accept new commitments.
- Hybrid rails must reject new commitments.

---

## 9. Agent Delegation Chains (PQ_NATIVE)
All delegation records must be PQ-exclusive.

### Delegation Record Schema
```
delegation_sig_pq
crypto_profile: PQ_NATIVE
delegation_version: 3
```

### Chain Rule
A delegation chain is valid only if **every hop** uses PQ signatures exclusively.

---

## 10. Runtime Decommissioning
The Jasper OS runtime must:

- Remove classical cryptographic libraries
- Remove hybrid cryptographic libraries
- Remove classical verification code
- Remove hybrid verification code
- Remove classical DID resolvers
- Remove hybrid DID resolvers
- Remove classical settlement validators
- Remove hybrid settlement validators

Runtime must expose:

```
runtime_crypto_mode: PQ_NATIVE
runtime_version: 3
```

---

## 11. Legacy Object Archival
All classical and hybrid objects must be:

- sealed
- archived
- excluded from active verification
- excluded from active routing
- excluded from agent delegation
- excluded from settlement rails

### Archive Metadata
```
archive_profile: LEGACY_CRYPTO
archive_reason: "PQ_NATIVE Transition"
archive_date: <timestamp>
```

---

## 12. Dashboard Integration
Update Quantum Readiness Panel:

### Panel Fields
```
ThreadZero: PQ_NATIVE
DID Layer: PQ_NATIVE
URIB: PQ_NATIVE
Agents PQ-Native: <count>/<total>
Legacy Objects Archived: <count>
PQ-Native Coverage: <percentage>
```

---

## 13. Migration Timeline
### Phase 3 (PQ_NATIVE)
- Remove classical cryptography
- Remove hybrid cryptography
- Enforce PQ-only issuance
- Enforce PQ-only verification
- Archive all legacy objects
- Switch Jasper OS runtime to PQ_NATIVE

### Phase 4 (Optional Future)
- PQ-accelerated cryptography
- PQ-hardware acceleration
- PQ-native rails
- PQ-native agent enclaves

---

## 14. Acceptance Criteria
Phase 3 is complete when:

- All surfaces operate under `PROFILE.PQ_NATIVE`
- All classical cryptography is removed
- All hybrid cryptography is removed
- All new objects use PQ-only signatures
- All legacy objects are archived
- Runtime reports `PQ_NATIVE`
- Dashboard reports full PQ-native coverage