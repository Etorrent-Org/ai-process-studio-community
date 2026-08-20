# Contributing

Thank you for contributing to AI Process Studio Community.

## Scope

Community contributions should target the open source core:

- `core`
- `discover`
- `map`
- local runtime, security, accessibility, tests and documentation

Do not add proprietary Professional implementation or signing secrets to the Community repository.

## Licence

By submitting a contribution, you agree that your contribution is provided under the Mozilla Public License 2.0 (MPL-2.0) for the files covered by this repository licence.

## Before opening a pull request

Run:

```bash
npm install --package-lock=false
npm run typecheck
npm run build
npm run test:open-core
```

Also verify that no credential, private key, backup, local data file or customer licence is included.

## Pull requests

Keep changes focused and explain:

- the problem being solved
- the intended behaviour
- the tests performed
- any migration or compatibility impact

Security-sensitive reports should follow `SECURITY.md` instead of being disclosed first in a public issue.
