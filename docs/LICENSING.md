# Licensing architecture

## Community entitlement

Without a valid Professional licence, the server grants exactly:

```json
["core", "discover", "map"]
```

Community does not depend on a licence file.

## Professional licence payload

A Professional licence is a signed JSON document with the canonical fields:

```json
{
  "license_id": "APS-...",
  "customer": "Customer name",
  "edition": "Professional",
  "modules": ["audit", "ai_finder", "optimize", "sop", "roadmap"],
  "issued_at": "2026-08-20T00:00:00.000Z",
  "expires_at": null,
  "signature": "base64-ed25519-signature"
}
```

Only the listed Professional module identifiers are accepted. Unknown or duplicate modules, invalid dates, unsupported editions and malformed signatures are rejected before activation.

## Signature model

The canonical payload excludes the `signature` field and is verified locally with Ed25519.

The application package contains only the public verification key. The signing private key belongs in a separate private operational environment and must never be committed or shipped with Community.

## Authorization rules

The local server is authoritative.

- direct Professional entity routes require the matching module
- Professional analysis import requires `audit`
- `/api/state` hides unlicensed Professional collections and prompts
- a Community full-state save preserves hidden Professional records instead of deleting them
- crafted state/restore payloads cannot inject or modify Professional collections without entitlement
- project exports include only collections authorized by the current entitlement
- raw backups preserve stored user data for recovery and ownership purposes

## Licence expiry or removal

If the licence is missing, invalid or expired, the application falls back to Community rights. Existing Professional records remain stored locally and remain present in raw backups, but regular Community state responses and project exports do not expose those protected collections.

## Threat model

The licence layer is designed to prevent normal API/UI bypass and accidental entitlement leakage. It is not intended to defeat a host administrator who can edit the application binaries, Docker image or local data files.

For that reason, proprietary Professional implementation must be distributed separately from the public Community source. Cryptographic entitlement checks alone are not a substitute for source/distribution separation.
