# AI Process Studio Community

[![Release](https://img.shields.io/github/v/release/Etorrent-Org/ai-process-studio-community)](https://github.com/Etorrent-Org/ai-process-studio-community/releases/latest)
[![Community validation](https://github.com/Etorrent-Org/ai-process-studio-community/actions/workflows/lot-c-validation.yml/badge.svg?branch=main)](https://github.com/Etorrent-Org/ai-process-studio-community/actions/workflows/lot-c-validation.yml)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

AI Process Studio Community is a **local-first, self-hosted workspace for documenting and mapping business processes** before deciding where AI or automation is actually useful.

It runs locally with Docker, stores application data on the host, and works without a licence for the Community feature set.

**Current version:** 1.1.2 · **State schema:** 2.1.0 · **Storage:** local JSON

[Product page](https://etorrent-org.github.io/ai-process-studio/) · [Latest release](https://github.com/Etorrent-Org/ai-process-studio-community/releases/latest) · [Report a bug](https://github.com/Etorrent-Org/ai-process-studio-community/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/Etorrent-Org/ai-process-studio-community/issues/new?template=feature_request.yml)

## What Community does

Community focuses on understanding the real process first:

- **Discover** — capture the AS-IS process, actors, steps and friction points.
- **Map** — turn the captured process into a deterministic process map.
- **Core workspace** — manage projects, process information and local documents.
- **Local ownership** — keep runtime data, backups and exports under your control.
- **Community-safe exports** — export only data available to the Community entitlement.

Community works without a licence and includes the `core`, `discover` and `map` modules.

## Quick start on Windows

### Requirements

- Windows 10 or 11
- Docker Desktop running
- PowerShell

### Recommended: install from the latest GitHub Release

1. Download the latest `ai-process-studio-community-<version>-source.tar.gz` archive from the [Releases page](https://github.com/Etorrent-Org/ai-process-studio-community/releases/latest).
2. Extract it into a dedicated folder.
3. Open PowerShell in that folder.
4. Run:

```powershell
.\INSTALL-AI-PROCESS-STUDIO.ps1
```

Then open:

```text
http://127.0.0.1:3080
```

The installer builds the Docker image locally from the published Community source. A Docker Hub image is **not required**.

### Start and stop later

```powershell
.\START-AI-PROCESS-STUDIO.ps1
.\STOP-AI-PROCESS-STUDIO.ps1
```

Health endpoint:

```text
http://127.0.0.1:3080/api/health
```

## Community and Professional

AI Process Studio uses an open-core model with a strict source boundary.

| Capability | Community | Professional |
| --- | :---: | :---: |
| Projects and local process workspace | ✅ | ✅ |
| AS-IS process discovery | ✅ | ✅ |
| Deterministic process mapping | ✅ | ✅ |
| Local documents, backup and Community-safe exports | ✅ | ✅ |
| Audit | — | ✅ |
| AI opportunity finder | — | ✅ |
| Optimization | — | ✅ |
| SOP generation | — | ✅ |
| Transformation roadmap | — | ✅ |

Professional is a **separate commercial distribution**. Its implementation is not shipped inside the public Community frontend behind a simple UI gate. See [`COMMERCIAL.md`](COMMERCIAL.md) and [`docs/LICENSING.md`](docs/LICENSING.md).

## Privacy and data ownership

AI Process Studio is designed for local operation:

- the default service binds to `127.0.0.1`;
- application state is stored locally;
- backups stay local unless you move them elsewhere;
- no call-home licensing is required for Community;
- no telemetry is required to use Community.

See [`SECURITY.md`](SECURITY.md) for the local threat model and vulnerability reporting guidance.

## Backup and restore

Create a backup:

```powershell
.\BACKUP-AI-PROCESS-STUDIO.ps1
```

Restore a backup:

```powershell
.\RESTORE-AI-PROCESS-STUDIO.ps1 -ArchivePath <path-to-zip>
```

Version 1.1.1 uses the Windows-safe host directory `licenses/` while keeping `/app/license` inside the container. Backups made with the earlier `license/` host directory remain restorable.

## Updating

From an updated source folder:

```powershell
.\UPDATE-AI-PROCESS-STUDIO.ps1
```

Existing state using schema 2.0.0 is automatically migrated to schema 2.1.0.

## Troubleshooting

Before opening a bug, please include:

- AI Process Studio version;
- Windows version;
- Docker Desktop version;
- the exact command used;
- the exact error message;
- relevant Docker logs with secrets removed.

Use the [bug report template](https://github.com/Etorrent-Org/ai-process-studio-community/issues/new?template=bug_report.yml). For general support guidance, see [`SUPPORT.md`](SUPPORT.md).

Do **not** attach passwords, session cookies, Professional signing keys, customer licence files or private backup archives.

## For contributors

The maintained Community frontend lives in `app/`. Generated `dist/` output is intentionally not tracked.

Validation commands:

```text
npm run check:community-boundary
npm run typecheck
npm run build
npm run test:open-core
```

GitHub Actions also rebuilds and boots the Community Docker image, checks `/api/health`, verifies the application home page and validates Windows-safe paths.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) before proposing source changes.

## Repository structure

- `app/` — maintained Community frontend source
- `scripts/` — source-boundary and maintenance scripts
- `tests/` — open-core and policy tests
- `server.mjs` — local Node.js server and entitlement API
- `schemas/` — JSON schemas
- `prompts/` — Community prompt definitions
- `seed/` — initial Community state and public verification key
- `data/` — local runtime data, excluded from Git
- `licenses/` — optional local Professional licence, excluded from Git except for its README
- `backups/` — local backups, excluded from Git

## Licence

AI Process Studio Community is licensed under **Mozilla Public License 2.0 (MPL-2.0)**. See [`LICENSE`](LICENSE).
