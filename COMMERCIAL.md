# Commercial model

AI Process Studio uses an open-core model with two editions.

## Community

Community is free and is the public source edition.

Included modules:

- `core`
- `discover`
- `map`

Community has no artificial project or process count limit. Its source is licensed under MPL-2.0.

## Professional

Professional is a commercial edition. A signed local licence can enable:

- `audit`
- `ai_finder`
- `optimize`
- `sop`
- `roadmap`

Future commercial modules such as `infographic_export` are not part of the 1.1.0 contract until explicitly shipped.

The launch pricing target is **EUR 99/year per user or installation**. This is an indicative commercial target, not a licence term embedded in the software.

## Distribution boundary

The Community source repository and the Professional commercial implementation must remain separate distribution boundaries.

A signed licence is an authorization mechanism; it is not a substitute for keeping proprietary Professional implementation outside the public Community source package.

The Professional signing private key must never be stored in this repository, in a public CI secret dump, in a Docker image, or in a client backup.

## Local-first licensing

Version 1.1.0 intentionally uses:

- no call-home requirement
- no hardware binding
- no per-project or per-process caps
- a local Ed25519 signature check
- Community fallback when no valid Professional licence is present

This keeps installation simple while preserving a clear commercial boundary.

## Data ownership

Backups preserve the user's stored data, including previously created Professional records. Regular Community API responses and project exports do not expose Professional collections without the matching entitlement, and Community restore/state operations cannot inject or modify those protected collections.

## Publication blocker

The repository is **not ready to be made public yet** because the transitional versioned `dist/` snapshot still comes from the historical full application bundle. Lot C must rebuild or remove that transitional bundle and verify that the public Community package contains no proprietary Professional implementation before repository visibility changes.
