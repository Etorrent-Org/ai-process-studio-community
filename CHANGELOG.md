# Changelog

## 1.1.1 - 2026-08-21

Windows installation and Community runtime reliability fixes.

### Installation and runtime

- avoids the case-insensitive Windows collision between the root `LICENSE` file and the former host `license/` directory by using `licenses/`
- keeps the in-container Professional licence path `/app/license` unchanged
- restores both current backups using `licenses/` and legacy backups using `license/`
- installs production dependencies in the final Docker image so Vinext SSR can load React at runtime
- validates the application home page in addition to `/api/health`

### Validation

- adds a case-insensitive tracked-path collision guard
- adds Windows source and archive path-safety validation
- validates the Community home page after the Docker image starts
- derives staging artifact names and Docker staging tags from `VERSION`
- aligns staging package metadata with the release version and verifies the health endpoint reports that version

### Distribution

- application version: 1.1.1
- Docker image target: `erwanntorrent/ai-process-studio:1.1.1`
- state schema: 2.1.0

## 1.1.0 - 2026-08-20

Open-core transition, frontend source recovery and commercial boundary hardening.

### Community and Professional

- Community works without a licence and includes `core`, `discover` and `map`
- Professional modules are `audit`, `ai_finder`, `optimize`, `sop` and `roadmap`
- Professional writes are enforced by the local server, including full-state writes and module collections
- historical bundled licence `APS-2026-V1-LOCAL` is obsolete and no longer grants extended modules
- bundled public seed licence removed

### Open-core hardening — Lot B

- `/api/state` now hides unlicensed Professional collections and prompts
- Community full-state saves preserve hidden Professional records server-side instead of deleting them
- crafted state and restore payloads cannot inject or modify protected Professional collections
- project exports include only Professional collections authorized by the active entitlement
- raw backups continue to preserve stored user data for recovery and ownership
- Professional licence validation now rejects unsupported editions, unknown or duplicate modules, incoherent dates and malformed signatures before activation
- local document writes now apply the same-origin write guard consistently
- added integration coverage for Community/Professional boundaries
- added automated scan preventing committed private key material

### Licensing and governance — Lot B

- Community source licence declared as MPL-2.0
- commercial Community/Professional model documented
- local Ed25519 licence format and threat model documented
- `SECURITY.md` and `CONTRIBUTING.md` added
- Professional signing private key explicitly excluded from the Community distribution model
- transitional historical `dist/` bundle recorded as a blocker before any public repository switch

### State 2.1.0

- automatic migration from 2.0.0
- retired integration flags and URLs removed from settings
- retired prompt modules removed during migration
- historical `Automatiser avec n8n` opportunities normalized to `Automatiser`
- backup format aligned to 2.1.0

### Integrations

- direct webhook API removed
- third-party workflow and publishing integrations removed from the maintained product contract
- legacy compiled UI is patched deterministically at Docker build time so retired controls are not exposed in 1.1.0

### Frontend source

- restored `app/` source tree
- added Vinext/Vite and TypeScript configuration
- added explicit Community/Professional navigation and gates
- added source recovery documentation
- added automated validation for the legacy UI patch and recovered frontend build

### Distribution

- application version: 1.1.0
- Docker image: `erwanntorrent/ai-process-studio:1.1.0`
- state schema: 2.1.0

## 1.0.0 - 2026-08-13

Initial standalone Git baseline for AI Process Studio.

### Included

- Docker local runtime
- compiled web client
- Node.js local API server
- JSON-local persistence
- state schema 2.0.0
- process-analysis prompts
- local licensing
- backup and restore tooling
- health endpoint
- installation, start, stop and update scripts

### Distribution

- Docker Compose image tag aligned with the Docker Hub namespace: `erwanntorrent/ai-process-studio:1.0.0`
- application exposed locally on `127.0.0.1:3080`
- current Windows installation and update workflow rebuilds the image locally with `docker compose build --pull`

### Documentation maintenance - 2026-08-14

- README expanded with installation, update, backup and restore workflows
- architecture documentation aligned with the current Docker image tag and actual local-build deployment path
- changelog synchronized with the repository state after the Docker Hub naming change

This release established AI Process Studio as an independent application with its own repository and lifecycle.
