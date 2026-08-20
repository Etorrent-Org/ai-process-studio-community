# Community publication plan

## Non-negotiable rule

The existing private `Etorrent-Org/ai-process-studio` repository must **not** be made public in place.

Its private Git history contains earlier transitional compiled bundles and earlier mixed Community/Professional source. Deleting those files from the current HEAD is not sufficient because public Git history would still expose them.

## Public source strategy

The public Community repository must start with fresh Git history from a validated source snapshot of the clean Community HEAD.

A source snapshot must contain:

- maintained Community `app/` source only;
- local server and entitlement control plane;
- Community prompt catalog;
- schemas and Community seed;
- public Ed25519 verification key only;
- Dockerfile and local installation scripts;
- MPL-2.0 licence, security and contribution documentation;
- generated `package-lock.json` for dependency reproducibility;
- no generated `dist/` tree;
- no runtime data, backups, licence files or private signing material;
- no proprietary Professional implementation.

## Dependency security decision

The earlier staging dependency graph reported two high-severity findings associated with `image-size@2.0.2`, pulled as a runtime dependency by `vinext@1.0.0-beta.4`.

For the publication candidate:

- `vinext` is upgraded to `1.0.0-beta.6`;
- upstream now bundles `image-size` as a build-time implementation detail instead of exposing it in the consumer dependency graph;
- the staging workflow explicitly fails if `image-size` appears in the generated Community consumer `package-lock.json`;
- the Community application does not import `next/image`, does not expose an image upload path and accepts only TXT, Markdown and PDF documents;
- the npm audit report is retained as a staging artifact and any remaining **high** or **critical** vulnerability blocks publication.

This is a scoped mitigation, not a claim that the upstream `image-size` parser defects have been fixed. If the vulnerable parser becomes reachable from untrusted Community input in a future version, publication must be blocked until that path is removed or patched.

## Staging workflow

`.github/workflows/community-package.yml` creates validation artifacts only. It does **not**:

- create or modify a public repository;
- push a Docker image;
- create a Git tag;
- create a GitHub Release;
- change repository visibility.

The workflow builds and checks the Community source, generates a fresh dependency lockfile for the staged source archive, creates an SBOM and npm audit report, builds the Community Docker image and calculates SHA-256 checksums.

The dependency audit is a release gate: high or critical findings cause the workflow to fail. The workflow also verifies that the known vulnerable `image-size` package is absent from the consumer dependency graph.

## Release gates

Before publication all of the following must be true:

1. Lot B entitlement policy tests are green.
2. Lot C Community source, build and Docker boot tests are green.
3. Community boundary scan is green.
4. No tracked historical `dist/` exists in the publication snapshot.
5. No private key or secret is present.
6. Dependency audit reports zero high and zero critical vulnerabilities in the Community consumer graph.
7. `image-size` is absent from the generated Community consumer dependency graph.
8. The staged Docker image boots and `/api/health` reports version `1.1.0` and edition `Community`.
9. The final public source archive checksum matches the artifact used to initialize the public repository.

## Authorized publication sequence

Publication itself requires separate explicit authorization for each write boundary.

Recommended sequence:

1. create a new public Community repository from the clean staged source snapshot;
2. verify its first commit and source boundary;
3. configure repository description, topics, security policy and homepage;
4. build and publish the public Community Docker image;
5. tag `v1.1.0` in the public Community repository;
6. create the GitHub Release with source archive, checksums and release notes;
7. verify installation from the public artifacts on a clean machine.

The historical private repository remains private as the development and Professional integration repository.
