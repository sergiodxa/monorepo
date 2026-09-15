---
name: sdxc-billing
description: "@sdxc/billing is a vendor-neutral billing contract — `Customer`, `Subscription`, `Order`, `Checkout`, `EntitlementState` behind one `Billing` interface — with Polar, Stripe, Mercado Pago and in-memory providers, a router middleware and a deduplicating webhook endpoint. Use when opening a hosted checkout or portal, syncing entitlements from webhooks, gating a feature on a paid plan, reporting metered usage, or testing a payment provider."
---

# @sdxc/billing

Code is written against `Customer`, `Subscription`, `Order`, `Checkout` and `EntitlementState`, and a platform is reached through the `Billing` contract, so a vendor's name appears in one import and one construction site rather than in every service, column and handler. Nothing throws: every method answers a `Result` from `@sdxc/result`, and a `find*` that matches nothing answers a `not_found` failure rather than `null`. Purchases are hosted links only — checkout and portal hand back a URL, so no card data passes through the package. The middleware and webhook endpoint mount into a `remix` fetch router; `@sdxc/billing/conformance` registers Vitest tests.

Full API, options and examples: [packages/billing/README.md](packages/billing/README.md)

## When to reach for it

- Opening a hosted checkout or a customer portal and redirecting to the returned URL.
- Receiving billing webhooks and projecting `entitlements.of(customer)` into your own tables, so the platform stays off the request path.
- Gating a route or a feature on what a customer currently holds.
- Ingesting metered usage events, or reading back what the platform counted.
- Testing a billing flow end to end with no network and no platform account.
- Adding or auditing a provider, where the conformance suite is what says it is one.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/billing": "workspace:*" } }
```

```ts
import type { Billing } from "@sdxc/billing";

import { PolarBilling } from "@sdxc/billing/providers/polar";

export let polar: Billing = new PolarBilling({
	accessToken: () => readSecret("POLAR_ACCESS_TOKEN"),
	webhookSecret: () => readSecret("POLAR_WEBHOOK_SECRET"),
	products: { pro: "019...", team: "019..." },
	meters: { pings: "019..." },
	features: { reports: "019..." },
});
```

### Entry points

- `@sdxc/billing` — the models, the `Billing` contract, `BillingError`, `supports()`, `BillingWebhook`
- `@sdxc/billing/middleware` — the router middleware publishing `context.billing`, plus `requireEntitlement()`
- `@sdxc/billing/providers/polar` — `PolarBilling`, which answers every group
- `@sdxc/billing/providers/stripe` — `StripeBilling`, a deliberately narrow provider
- `@sdxc/billing/providers/mercado-pago` — `MercadoPagoBilling`, a payment processor rather than a merchant of record
- `@sdxc/billing/providers/memory` — `MemoryBilling`, a full in-memory platform for tests
- `@sdxc/billing/conformance` — the shared suite every provider passes, plus one suite per optional capability

## Suggestions

- Annotate the exported provider as `Billing`, not as the concrete class. It keeps the rest of the code written against the contract and is what makes `supports(billing, "usage")` usable — a concrete class statically has the group, so a guard narrows its own false branch away.
- Configure `products`, `meters` and `features` as your own slugs mapped to the platform's ids; that is what keeps a vendor identifier out of every call site.
- `entitlements.of` is the sync primitive: write that snapshot into your own tables on a webhook and have requests read those. `requireEntitlement(feature)` gates on the projection supplied by the middleware's `entitlements` option, and throws if the middleware ran without one.
- `customers.create` requires `externalId` — it is the key that makes a customer re-resolvable, platforms treat it as immutable, and a taken one answers `conflict`.
- Read `BillingErrorCode` closely before writing recovery: `unknown` (timeout or 5xx) may or may not have taken effect and calls for a reconciliation read, `invalid_response` is a mapping bug and must not trigger reconciliation, `unsupported` means the platform cannot, and `not_implemented` means this provider has not yet.
- A checkout session with a `null` `url` is no longer payable; check it before redirecting. Pass `idempotencyKey` so a double-submitted form bills once.
- Providers are never re-exported from the root, so a bundle resolves only the one imported; the conformance entry imports `vitest` and stays out of the root for the same reason.

## Related

- `@sdxc/api-client` — the base class providers reach their platform's REST API through; skill `sdxc-api-client`
- `@sdxc/webhooks` — the signing and verification primitives `BillingWebhook` builds on; skill `sdxc-webhooks`
- `@sdxc/result` — every billing call answers with its `Result`; skill `sdxc-result`
