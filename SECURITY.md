# Security Policy

## Supported version

Security fixes currently target AI Process Studio 1.1.x.

## Reporting a vulnerability

Please use GitHub's private security reporting / Security Advisory flow for this repository when available. Do not publish exploitable details in a public issue before a fix is available.

Include:

- affected version
- reproduction steps
- expected and observed behaviour
- security impact
- relevant logs or request samples with secrets removed

## Local-first threat model

AI Process Studio is designed to run locally and binds the default Docker port to `127.0.0.1`.

The application protects ordinary API and UI access with local authentication, CSRF checks, same-origin write checks, module authorization and signed licence verification. A person with administrator/root access to the host filesystem or Docker runtime can alter local binaries or data; the licence layer is therefore an authorization boundary, not tamper-proof DRM.

## Secrets

Never commit or attach:

- Professional signing private keys
- passwords or session cookies
- customer licence files containing unnecessary personal data
- production `.env` files
- private backup archives

The shipped Ed25519 **public** verification key is intentionally non-secret.

## Backups

Backups may contain confidential process information and previously created Professional data. Treat backup archives as sensitive business data and protect them accordingly.
