# Architecture

## AI Process Studio 1.1.0

AI Process Studio uses a local Docker-based architecture with an open-source Community distribution and separately distributed Professional modules.

Community source (`app/`)
  -> Vinext / Vite build
  -> generated web runtime (`dist/`, not tracked)
  -> Node.js server (`server.mjs`)
     -> JSON state (`data/`)
     -> schemas/
     -> Community prompts/
     -> optional local Professional licence (`license/`)
     -> backups/

## Community client boundary

The maintained Community frontend entry point is `app/community-studio.tsx`.

It contains only the Community product surface:

- local repository and projects
- AS-IS process capture
- deterministic process mapping
- local documents
- Community-safe exports and backup controls
- local administration

Professional implementation is not present in the Community `app/` source. `scripts/check-community-boundary.mjs` enforces this rule in CI.

The historical compiled `dist/` snapshot and its compatibility patch are no longer tracked. Docker now builds a fresh runtime directly from the maintained Community source.

## Server

- Runtime: Node.js 22
- Entry point: `server.mjs`
- Default port: 3080
- Health endpoint: `GET /api/health`
- State schema: 2.1.0

The server remains the authority for entitlement and storage boundaries. This control-plane knowledge can name Professional module IDs without shipping their proprietary feature implementation.

## Editions and modules

Community:

- `core`
- `discover`
- `map`

Professional entitlement IDs:

- `audit`
- `ai_finder`
- `optimize`
- `sop`
- `roadmap`

## Entitlement boundary

- direct Professional collection reads and writes require their module
- analysis import requires `audit`
- `/api/state` returns a view filtered by the current entitlement
- Community full-state writes preserve hidden Professional records rather than deleting them
- Community cannot inject or modify hidden Professional collections through state or restore payloads
- unlicensed Professional prompt records are hidden and preserved server-side
- project export contains only module-authorized Professional collections
- raw backup retains all stored user data for recovery purposes

## Licence cryptography

Professional licences are verified locally with Ed25519.

The public verification key is shipped with the Community server and is not secret. The signing private key belongs to a separate private operational environment and must never be committed, embedded in Docker images or exported in client backups.

There is no call-home or hardware binding in 1.1.0.

## Threat model

The entitlement layer prevents ordinary API/UI bypass and accidental leakage. It is not tamper-proof DRM against a host administrator who can modify local binaries or Docker images.

The commercial protection therefore relies on two complementary controls:

1. server-side entitlement checks for normal application behavior;
2. physical source/distribution separation so proprietary Professional implementation is not shipped in the Community package.

## Persistence and migration

Runtime storage is local JSON. State 2.0.0 is migrated automatically to 2.1.0 on read.

Persistent Docker mounts:

- `/app/data`
- `/app/license`
- `/app/backups`

Runtime user data, licences and backups are excluded from Git.

## Docker and distribution

The Dockerfile uses a multi-stage build:

1. install frontend dependencies in an isolated builder;
2. typecheck and build the maintained Community source;
3. assert the expected Vinext `dist/server/index.js` and `dist/client` outputs;
4. copy only the generated runtime and required server assets into the unprivileged runtime image.

The final container does not depend on a committed frontend bundle.

## Public repository rule

The existing private repository history contains older mixed-source and compiled artifacts. Therefore the private repository must not be made public in place.

The future public Community repository must start from a clean snapshot of the validated Community HEAD without importing private Git history. This prevents historical Professional implementation from becoming accessible through old commits.

## Versions

- Application: 1.1.0
- State schema: 2.1.0
- Backup format: 2.1.0
- Docker image target: `erwanntorrent/ai-process-studio:1.1.0`
