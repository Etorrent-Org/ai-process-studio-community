# AI Process Studio

AI Process Studio is a standalone local-first application for documenting and mapping business processes, with an open-core Community edition and a separate Professional commercial distribution.

## Version

- Application: 1.1.0
- State schema: 2.1.0
- Storage: json-local
- Docker image target: `erwanntorrent/ai-process-studio:1.1.0`

## Editions

**Community** works without a licence and includes:

- `core` — local repository and portfolio data
- `discover` — AS-IS process capture
- `map` — deterministic process mapping
- local documents, backup and Community-safe exports

**Professional** is a separate commercial distribution that can enable:

- `audit`
- `ai_finder`
- `optimize`
- `sop`
- `roadmap`

The public Community frontend does not contain the implementation of those Professional capabilities.

## Open-source licence

The Community source is licensed under **MPL-2.0**. See `LICENSE` and `CONTRIBUTING.md`.

Professional is a separate commercial implementation boundary. A signed licence authorizes installed Professional modules but does not make their implementation part of the Community source package. See `COMMERCIAL.md` and `docs/LICENSING.md`.

## Security and entitlement policy

The local server is authoritative for module access.

- Professional collections are blocked without the matching module.
- `/api/state` hides unlicensed Professional collections and prompts.
- Community full-state saves preserve hidden Professional data instead of deleting it.
- Crafted state and restore payloads cannot inject or modify Professional collections.
- Project exports include only data authorized by the current entitlement.
- Raw backups preserve locally stored user data for recovery and data ownership.
- Professional licence documents are validated for edition, module allowlist, duplicates, dates and Ed25519 signature.
- The signing private key is never part of the client repository or image.

See `SECURITY.md` for the local threat model.

## Runtime

AI Process Studio runs locally with Docker.

Start:

    .\START-AI-PROCESS-STUDIO.ps1

Stop:

    .\STOP-AI-PROCESS-STUDIO.ps1

Default URL:

    http://127.0.0.1:3080

Health endpoint:

    http://127.0.0.1:3080/api/health

## Installation and update

Windows installation:

    .\INSTALL-AI-PROCESS-STUDIO.ps1

Update:

    .\UPDATE-AI-PROCESS-STUDIO.ps1

The Dockerfile now rebuilds the Community web runtime directly from the maintained `app/` source. The historical compiled `dist/` bundle is no longer tracked in the Community candidate and the legacy compatibility patch is no longer used.

Existing 2.0.0 state is automatically migrated to schema 2.1.0. Retired integration settings are removed during migration and historical opportunity category `Automatiser avec n8n` is normalized to `Automatiser`.

## Community frontend source

- `app/community-studio.tsx` — Community-only application UI
- `app/page.tsx` — Community entry point
- `package.json` — frontend dependencies and scripts
- `vite.config.ts` — Vinext/Vite build configuration
- `tsconfig.json` — TypeScript configuration
- `scripts/check-community-boundary.mjs` — CI guard against reintroducing Professional implementation markers

Generated `dist/` output is ignored by Git and produced during `npm run build` or Docker build.

## Publication status

The **current private repository itself must not simply be switched to public**, because its historical Git commits contain the earlier transitional bundle and earlier mixed Community/Professional source.

A future public repository must be initialized from a clean Community snapshot produced from the current clean HEAD, without importing the private repository history. Publication, tag creation, GitHub Release and Docker Hub publication are separate authorized operations.

## Backup and restore

Create a backup:

    .\BACKUP-AI-PROCESS-STUDIO.ps1

Restore a backup:

    .\RESTORE-AI-PROCESS-STUDIO.ps1 -ArchivePath <path-to-zip>

## Validation

    npm run check:community-boundary
    npm run typecheck
    npm run build
    npm run test:open-core

The `Lot C validation` GitHub Actions workflow also rebuilds and boots the Community Docker image from source.

## Repository structure

- `app/` : maintained Community frontend source
- `scripts/` : source-boundary and maintenance scripts
- `tests/` : open-core and policy tests
- `server.mjs` : local Node.js server and entitlement API
- `schemas/` : JSON schemas
- `prompts/` : Community prompt definitions
- `seed/` : initial Community application state and public verification key
- `data/` : local runtime data, excluded from Git
- `license/` : optional local Professional licence, excluded from Git
- `backups/` : local backups, excluded from Git
