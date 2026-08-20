# AI Process Studio validation report

## 1.1.0 - Lot A validation - 2026-08-20

### Server and migration

Validated locally against the 1.1.0 server implementation with a fresh 2.0.0 fixture:

- `node --check server.mjs`: passed
- `GET /api/health`: version `1.1.0`, schema `2.1.0`, edition `Community`
- fresh installation without a licence: modules `core`, `discover`, `map`
- automatic migration `2.0.0 -> 2.1.0`: passed
- retired integration settings removed during migration: passed
- historical opportunity category normalized to `Automatiser`: passed
- Professional collection write from Community: HTTP `403`, code `PROFESSIONAL_REQUIRED`
- retired `/api/integrations/webhook` route: HTTP `404`

### Frontend recovery

- TypeScript/TSX syntax transpilation check for `app/studio.tsx`, `app/layout.tsx`, `app/page.tsx` and `vite.config.ts`: passed
- maintained frontend source contains no retired n8n/Notion identifiers: passed
- compatibility patch syntax check: passed
- compatibility patch synthetic validation against exact historical bundle fragments: passed

### Branch CI

`.github/workflows/lot-a-validation.yml` validates on branch pushes:

- server syntax
- JSON contracts
- compatibility patch against the real historical bundle
- Community seed contract
- frontend dependency installation
- TypeScript typecheck
- recovered frontend build

The workflow is intentionally a merge gate for the recovered source; no merge to `main` is part of Lot A.

---

## 1.0.0 - Historical baseline - 2026-08-13

Initial runtime validation before creation of the standalone Git baseline:

- Service: app
- Image: ai-process-studio/app:1.0.0
- Status: healthy
- Endpoint: 127.0.0.1:3080
- health version: 1.0.0
- state schema: 2.0.0
- storage: json-local
