# Commercial model

AI Process Studio uses an open-core model with two clearly separated editions.

## Community

Community is free, public and licensed under MPL-2.0.

Included modules:

- `core`
- `discover`
- `map`

Community has no artificial project, process or user count limit and works without a licence.

## Professional

Professional is a separate proprietary distribution. The launch licence enables the five current Professional modules:

- `audit`
- `ai_finder`
- `optimize`
- `sop`
- `roadmap`

Future modules such as `infographic_export` are not included until explicitly shipped.

### Launch offer

- **Price:** EUR 99 / year / installation.
- **Seats:** no per-user seat counting at launch.
- **Order channel:** email to `contact@7-sens.fr`.
- **Payment and invoicing:** handled manually at launch.
- **Delivery:** Professional package plus a customer-specific locally verified licence.
- **Updates:** Professional updates published during the active 12-month licence period are included.
- **Support:** email, best effort, with no contractual SLA or 24/7 commitment unless separately agreed in writing.

An installation means one deployed AI Process Studio Professional runtime/instance. There is no hardware binding, per-project cap or per-process cap in the launch offer.

## Local-first licensing

Professional entitlement is verified locally with an Ed25519 signature:

- no licence call-home requirement;
- no hardware binding;
- no mandatory telemetry;
- Community fallback when no valid Professional licence is present.

When a Professional licence expires or becomes invalid, the application falls back to Community rights. Existing Professional records stay stored locally and become available again after activation of an appropriate Professional licence. The licence controls feature entitlement; it does not delete customer data.

## Distribution boundary

The Community source repository and the Professional proprietary implementation remain separate distribution boundaries. Professional implementation is not hidden inside the public Community frontend behind a UI switch.

The production signing private key is never stored in this repository, a public CI secret dump, a Docker image, a customer package or a client backup.

## Current baseline

- Community: **1.1.2**
- Professional: **1.1.2**
- production public-key fingerprint (SHA-256): `3d0731662f2f84b5e679dfaca8f67e03475b27f6f71449046c31fc5df2730b04`
- product page: <https://etorrent-org.github.io/ai-process-studio/>
- Professional contact: `contact@7-sens.fr`

Detailed order, invoicing and contractual information is confirmed in writing before payment. The legal identity of the supplier, applicable taxes and mandatory invoice information are provided on the quotation/invoice used for the transaction.
