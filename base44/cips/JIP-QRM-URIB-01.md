# PQ_NATIVE URIB Settlement Schema
### URIB Settlement Schema — Version 3 (PQ_NATIVE Mode)
**Status:** Implementation-Ready
**Author:** Leon C. Long II
**System:** Jasper OS / URIB / ThreadZero
**Version:** 3
**Depends on:** JIP-QRM-01/02/03, JIP-QRM-RT-01 (PQ_NATIVE Runtime Spec)

---

## 1. Overview

**Name:** URIB Settlement Schema
**Mode:** `PQ_NATIVE`
**Version:** `3`
**Role:** Represent cross-rail settlement events with invariant proofs and PQ-only signatures.

---

## 2. Top-level settlement object

```json
{
  "urib_settlement_id": "URIB-SET-<uuid>",
  "version": 3,
  "crypto_profile": "PQ_NATIVE",
  "created_at": "<timestamp>",
  "initiator_did": "did:jasper:<agent>",
  "rails": [ /* rail entries */ ],
  "amounts": { /* normalized values */ },
  "invariants": { /* invariant proofs */ },
  "commitment": { /* commitment object */ },
  "audit": { /* ThreadZero linkage */ }
}
```

---

## 3. Rail entries

Each rail (ACH, RTP, FedWire, SWIFT, blockchain, etc.) is modeled as a settlement surface.

```json
"rails": [
  {
    "rail_id": "ACH",
    "rail_did": "did:jasper:rail:ach",
    "rail_profile": "PQ_NATIVE",
    "rail_version": 3,
    "rail_tx_id": "<rail-specific-id>",
    "rail_amount": {
      "currency": "USD",
      "value": "1000.00"
    },
    "rail_direction": "DEBIT|CREDIT",
    "rail_metadata": {
      "iso20022_msg_type": "pacs.008",
      "bank_bic": "<bic>",
      "account_iban": "<iban>"
    }
  }
]
```

---

## 4. Normalized amounts

URIB needs a canonical representation of value across rails.

```json
"amounts": {
  "base_currency": "USD",
  "base_value": "1000.00",
  "normalized_vector": {
    "ACH": "1000.00",
    "RTP": "1000.00",
    "FedWire": "1000.00",
    "SWIFT": "1000.00",
    "BTC": "0.015",
    "XRP": "250.0"
  }
}
```

---

## 5. Invariant proofs

URIB's core: cross-rail invariants must hold.

```json
"invariants": {
  "value_conservation": {
    "invariant_id": "INV-VALUE-001",
    "description": "Total value conserved across all rails",
    "status": "SATISFIED|VIOLATED",
    "proof_hash": "<hash>",
    "proof_version": 3
  },
  "direction_consistency": {
    "invariant_id": "INV-DIR-001",
    "description": "Debit/Credit directions consistent across rails",
    "status": "SATISFIED|VIOLATED",
    "proof_hash": "<hash>",
    "proof_version": 3
  },
  "identity_binding": {
    "invariant_id": "INV-ID-001",
    "description": "All rails bound to valid DIDs",
    "status": "SATISFIED|VIOLATED",
    "proof_hash": "<hash>",
    "proof_version": 3
  }
}
```

---

## 6. Commitment object (PQ_NATIVE)

This is the cryptographic heart of URIB in PQ_NATIVE mode.

```json
"commitment": {
  "commitment_id": "URIB-CMT-<uuid>",
  "commitment_version": 3,
  "crypto_profile": "PQ_NATIVE",
  "commitment_root": "<hash-of-rails+amounts+invariants>",
  "commitment_signature_pq": "<ML-DSA-65-signature>",
  "signer_did": "did:jasper:<agent-or-rail>",
  "signer_key_id": "<key-id>",
  "signed_at": "<timestamp>"
}
```

**Rules:**

- Only `commitment_signature_pq` is allowed.
- No classical or hybrid signature fields.
- `commitment_root` must be deterministic over the full settlement object.

> **Implementation note:** The `universalBridge` orchestration function and the
> `quantumResilience` crypto layer already emit `c_stack` / `c_bridge`
> commitment hashes and `pq_native_sign` / `pq_native_verify`
> (`commitment_version: 3`, `crypto_profile: PQ_NATIVE`) round-trips. A future
> wiring step stamps each URIB settlement's `commitment_root` through
> `pq_native_sign` so the on-disk AuditLog record carries a live PQ-native
> commitment signature.

---

## 7. Audit linkage (ThreadZero)

URIB must bind to ThreadZero for full lineage.

```json
"audit": {
  "threadzero_block_id": "TZ-BLOCK-<id>",
  "threadzero_block_version": 3,
  "threadzero_crypto_profile": "PQ_NATIVE",
  "threadzero_sig_pq": "<ML-DSA-65-signature>",
  "threadzero_state_root": "<state-root>",
  "threadzero_event_root": "<event-root>"
}
```

---

## 8. Validation rules (runtime)

At runtime, a URIB settlement is valid only if:

- `version == 3`
- `crypto_profile == "PQ_NATIVE"`
- `commitment.commitment_version == 3`
- `commitment.crypto_profile == "PQ_NATIVE"`
- `commitment_signature_pq` verifies with ML-DSA-65
- all `rails[*].rail_profile == "PQ_NATIVE"`
- all invariants have `status == "SATISFIED"`
- `audit.threadzero_crypto_profile == "PQ_NATIVE"`
- `audit.threadzero_sig_pq` verifies.

---

## 9. Example minimal PQ_NATIVE URIB settlement

```json
{
  "urib_settlement_id": "URIB-SET-1234",
  "version": 3,
  "crypto_profile": "PQ_NATIVE",
  "created_at": "2026-07-19T12:00:00",
  "initiator_did": "did:jasper:agent:alpha",
  "rails": [
    {
      "rail_id": "ACH",
      "rail_did": "did:jasper:rail:ach",
      "rail_profile": "PQ_NATIVE",
      "rail_version": 3,
      "rail_tx_id": "ACH-2026-0001",
      "rail_amount": {
        "currency": "USD",
        "value": "1000.00"
      },
      "rail_direction": "DEBIT",
      "rail_metadata": {
        "iso20022_msg_type": "pacs.008",
        "bank_bic": "TESTUS33",
        "account_iban": "US00TEST0000000001"
      }
    }
  ],
  "amounts": {
    "base_currency": "USD",
    "base_value": "1000.00",
    "normalized_vector": {
      "ACH": "1000.00"
    }
  },
  "invariants": {
    "value_conservation": {
      "invariant_id": "INV-VALUE-001",
      "description": "Total value conserved across all rails",
      "status": "SATISFIED",
      "proof_hash": "<hash>",
      "proof_version": 3
    }
  },
  "commitment": {
    "commitment_id": "URIB-CMT-5678",
    "commitment_version": 3,
    "crypto_profile": "PQ_NATIVE",
    "commitment_root": "<hash>",
    "commitment_signature_pq": "<ML-DSA-65-signature>",
    "signer_did": "did:jasper:agent:alpha",
    "signer_key_id": "key-ml-dsa-1",
    "signed_at": "2026-07-19T12:00:01"
  },
  "audit": {
    "threadzero_block_id": "TZ-BLOCK-9001",
    "threadzero_block_version": 3,
    "threadzero_crypto_profile": "PQ_NATIVE",
    "threadzero_sig_pq": "<ML-DSA-65-signature>",
    "threadzero_state_root": "<state-root>",
    "threadzero_event_root": "<event-root>"
  }
}
``