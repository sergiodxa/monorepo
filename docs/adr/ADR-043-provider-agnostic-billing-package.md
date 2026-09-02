# ADR-043: Provider-Agnostic Billing Package

## Status

**Proposed** - 2026-09-02

Revised the same day after a prior-art review of Pay (Rails), Cashier (Laravel), PayKit, and roughly fifteen other multi-provider billing and payment abstractions. The review narrowed what this package promises, added an escape hatch it did not have, and reordered the implementation plan. [Prior Art](#prior-art) records what changed and why.

## Background

Billing in the monorepo is Polar, spelled out. `@pkg/polar` wraps `@polar-sh/sdk` behind one 948-line `PolarClient` class with 26 public methods, and it re-exports the vendor's own `Customer`, `Subscription`, `Product`, `Discount`, `Order`, `Checkout`, and `CustomerSession` models as the types five apps program against. Those apps also store the vendor's identifiers as column names (`polar_customer_id`, `polar_subscription_id`, `polar_product_id`), name their webhook routes after the vendor, and name their secrets after it.

Polar is the right merchant of record for the products sold today, and nothing here proposes leaving it. What it proposes is that the vendor stop being a load-bearing type in five applications. The prior-art review changed the shape of that claim: the goal is no longer "switching providers becomes a one-line change", because no project surveyed has achieved that for subscriptions and several abandoned the attempt. The goal is that app code stops naming a vendor, that billing has one failure convention, and that a provider change becomes a bounded project with a known cost instead of an unbounded rewrite.

## Context

### Current State

| Location                                                    | What it does                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/polar/src/index.ts`                               | `PolarClient`: 26 methods over customers, subscriptions, products, discounts, orders, checkouts, portal, usage, webhooks |
| `apps/auth-saas/app/models/subscription.ts`                 | Module-level lazy `PolarClient`, reads subscription state, catches `PolarError`                                          |
| `apps/auth-saas/app/jobs/report-mau.ts`                     | Daily `reportMAU` per tenant                                                                                             |
| `apps/auth-saas/app/http/controllers/api/webhooks/polar.ts` | Constructs a client per delivery to call `verifyWebhook`                                                                 |
| `apps/blog-saas/app/http/controllers/dashboard/billing.tsx` | Checkout and portal redirects, injected via the service container                                                        |
| `apps/blog-saas/app/jobs/report-usage.ts`                   | Daily `ingestPageViews` per account                                                                                      |
| `apps/books/app/http/controllers/checkout.ts`               | Discounted `createCheckout` for one-time product sales                                                                   |
| `apps/books/app/http/controllers/upgrade.tsx`               | `findCustomerByEmail` plus `listOrders` to gate an upgrade price                                                         |
| `apps/books/app/http/controllers/release.tsx`               | `getProduct` twice to render live prices                                                                                 |
| `apps/books/app/http/controllers/webhooks/polar.ts`         | `parseWebhook`, then branches on `order.paid`                                                                            |
| `apps/r3-auth/app/services/customer.ts`                     | Provisions a customer on first login, token read from Secrets Store                                                      |
| `apps/uptime/app/data/customer.ts`                          | `findOrCreate`, `checkout`, `portal` over the same client                                                                |
| `apps/uptime/database/migrations/*_subscriptions.sql`       | A D1 projection of Polar subscription state, written by the webhook                                                      |
| `apps/books/app/lib/test/polar.ts`                          | `FakePolarClient extends PolarClient`, overriding the methods the tests reach                                            |
| `apps/r3-auth/app/lib/test/http.ts`                         | A three-method object cast `as unknown as PolarClient`                                                                   |

Secrets are `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, and `POLAR_PRODUCT_ID`, as plain secrets in four apps and as a Secrets Store binding in `apps/r3-auth`.

### Issues Identified

| Issue                                                            | Impact                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The vendor's model types are the API                             | `Customer`, `Subscription`, `Order` flow into app services and views; a provider change is a type change everywhere       |
| The class name is the vendor name                                | `PolarClient` is the container token, the constructor, and the test double's base class in five apps                      |
| App semantics live in the package                                | `reportMAU` and `ingestPageViews` encode one app's meter name and metadata shape each, against the app-agnostic rule      |
| Failure handling is three different conventions                  | Most methods throw `PolarError`, `ingestEventsSafe`/`ingestPageViews` return `boolean`, `parseWebhook` returns a `Result` |
| No failure mode expresses an unknown outcome                     | A timeout on a charge is indistinguishable from a refusal, so a retry can double-bill                                     |
| `customerId` and `externalCustomerId` are two optional fields    | An ingest event naming neither type-checks and throws at runtime                                                          |
| List methods drain every page                                    | `listOrders`, `listSubscriptions`, `listDiscounts` return unbounded arrays; a caller wanting one page cannot ask for one  |
| Coverage stops at what the apps happened to need                 | `apps/uptime/app/http/controllers/app/team/checkout.tsx` documents a feature it cannot build for lack of a meter call     |
| Large parts of the provider's API have no representation         | Benefits, license keys, files, custom fields, refunds, payments, invoices, meters, balances, metrics, webhook endpoints   |
| Test doubles subclass or cast the real client                    | Two apps hand-roll a fake; one casts through `unknown` because the real class cannot be partially implemented             |
| Vendor identifiers are stored under vendor column names          | `polar_customer_id` in two schemas and `polar_subscription_id` in three; the row cannot say which provider issued it      |
| Provider product ids reach call sites                            | An app holds `POLAR_PRODUCT_ID` and a `Product` enum of Polar ids, so the catalog is addressed in the vendor's vocabulary |
| Webhook verification quirks are vendor-specific, the seam is not | Polar's text secret must be base64-encoded before Standard Webhooks verification; Stripe does not use Standard Webhooks   |
| Webhook deliveries have no idempotency anywhere                  | Every handler re-derives dispatch, and a redelivery is processed again                                                    |

### What "Switchable" Has To Mean

| Concept            | Polar                          | Stripe                                    |
| ------------------ | ------------------------------ | ----------------------------------------- |
| Customer           | `customers`                    | `customers`                               |
| Product / price    | `products`, prices embedded    | `products` plus separate `prices`         |
| Checkout session   | `checkouts`                    | `checkout.sessions`                       |
| Portal session     | `customerSessions`             | `billingPortal.sessions`                  |
| Subscription       | `subscriptions`                | `subscriptions`                           |
| Paid order         | `orders`                       | `invoices` plus `paymentIntents`          |
| Discount           | `discounts`                    | `coupons` plus `promotionCodes`           |
| Usage event        | `events.ingest`                | `billing.meterEvents`                     |
| Meter reading      | `meters.quantities`            | meter event summaries                     |
| Refund             | `refunds`                      | `refunds`                                 |
| License key        | `licenseKeys`                  | none                                      |
| File benefit       | `files`, downloadable benefits | none                                      |
| Webhook proof      | Standard Webhooks headers      | `Stripe-Signature` with `t=`/`v1=` parts  |
| Tax and remittance | merchant of record             | we remain the seller, Stripe Tax computes |

### Prior Art

Fifteen-plus projects across four languages have attempted some version of this. The review's findings are load-bearing for the design, so they are recorded here rather than in a footnote.

#### The convergent negative finding

Five independent parties concluded that subscription lifecycles do not abstract by wrapping provider APIs:

| Project         | What they concluded                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ActiveMerchant  | 100+ gateways, 15 years, Shopify-funded. Its `recurring` API carries a live deprecation notice; only charges plus a 17-code normalized decline vocabulary survived |
| Omnipay         | Recurring billing declared out of scope in writing, because there are "likely far too many differences between how each gateway handles recurring billing"         |
| Laravel Cashier | A request for a `Storage`-style driver abstraction was closed 30 minutes after opening: providers have "vastly different API and core concepts"                    |
| better-auth     | Its Stripe and Polar plugins share no contract — different composition model, different central noun, different lifecycle hooks                                    |
| Pay (Rails)     | Its own README says "It would be best to stick with a single payment provider"; the maintainer is considering extracting non-Stripe processors from core           |

Both category-A libraries independently substituted the same thing: abstract the stored payment method plus the charge, and let the host own the schedule.

#### How the prior art handles capability gaps

| Project        | Mechanism                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pay            | Five inconsistent mechanisms: `NotImplementedError`, generic `Pay::Error` with a prose message, missing methods raising `NoMethodError`, divergent option names under one signature, and silent no-op stubs |
| Cashier        | No mechanism — two packages, each expressing only what its provider does                                                                                                                                    |
| PayKit         | No capability model; a runtime schema demands all 21 methods, so 15 of 17 providers ship throwing stubs (Remita throws in 41 places)                                                                        |
| Omnipay        | `supportsAuthorize()` / `supportsCapture()` / `supportsRefund()` runtime predicates                                                                                                                         |
| ActiveMerchant | Class metadata (`supported_cardtypes`, `currencies_without_fractions`); `supports?` answers card brands, not operations                                                                                     |
| Medusa v2      | Optional methods in capability groups, plus `not_supported` as an in-band webhook action value                                                                                                              |

Pay's silent no-op is the sharpest warning. `subscribe` is its most central method, and on Paddle Billing and Lemon Squeezy the implementation is an empty body returning `nil`, because those providers cannot create a subscription by API at all. The uniform signature is preserved by making it a lie.

Pay also shows what happens to an unenforced normalized vocabulary. `Pay::Subscription::STATUSES` declares eight statuses; grepping the repository finds exactly one reference — its own definition. Every adapter writes the provider's raw status through, so a Lemon Squeezy trial has `status == "on_trial"`, which means the `active` scope matches it while the `active?` predicate returns false.

#### The universal escape hatch

Every successful multi-provider abstraction surveyed has an explicit, uninterpreted passthrough. This was the clearest gap in the first draft of this ADR, which had none.

| Project        | Escape hatch                                                                               |
| -------------- | ------------------------------------------------------------------------------------------ |
| Medusa v2      | An opaque `data` bag round-tripped through every method, never interpreted by the core     |
| Kill Bill      | `PluginProperty` in and out: "Kill Bill does not interpret them; only passes them through" |
| Hyperswitch    | `connector_metadata` plus `connector_transaction_id`                                       |
| Spreedly       | `gateway_specific_fields`, keyed per gateway                                               |
| Vendure        | `metadata`, with a `public` sub-object for what the storefront may see                     |
| ActiveMerchant | A free-form `options` hash inbound, `Response#params` outbound                             |
| Pay            | `api_record` on every model, plus a raw `object` JSON column added in v10                  |
| PayKit         | `_native` typed per provider, plus a per-resource `provider_metadata` slot                 |
| Cashier        | `Cashier::stripe()` and `Cashier::api()`                                                   |

Pay having to add the raw-object column at version 10 is the instructive detail: treat it as day-one design.

#### Two mistakes made more than once

**A checkout return and a webhook are different events.** Omnipay originally handled provider notifications through the same `completePurchase` call that resumed a customer returning from a redirect, and had to split them and deprecate the conflation; django-payments still routes both through one `process_data` that must decide whether to answer a machine with JSON or redirect a human to a success page. The two differ in trust, in timing, and in who is waiting for the response.

**Webhook payloads are not trustworthy as state.** dj-stripe's handler code carries the warning directly: event data is not guaranteed to be in the current API version, so a handler should re-retrieve the object it intends to act on. Deliveries also arrive out of order, are replayed, and are missed, which is why dj-stripe persists the raw delivery before validating it, records `valid` and `processed` on that row separately from the parsed event, and ships reconciliation commands rather than trusting the stream.

The two libraries that kept redirect flows in scope also disagree instructively. ActiveMerchant extracted off-site payments into a separate gem, concluding redirect flows do not fit a request/response gateway contract; Omnipay kept them and states there is "no point differentiating" the two gateway types, because 3-D Secure means an on-site gateway can return a redirect conditionally, per card. Omnipay's position is the one that matches hosted checkout, and it is the position taken here.

#### The third option, and why it is unavailable

Lago, Kill Bill, Chargebee, Zuora, and Recurly achieve real provider independence a different way: they own the customer, plan, subscription, usage, and invoice model themselves, and ask the payment provider only to hold a customer record, store a payment method, charge an amount, refund it, read the result back, and report outcomes asynchronously. That surface is five or six operations plus a status-mapping table, which is why Chargebee lists 63 gateways and Kill Bill claims "virtually no restrictions" while nobody supports more than one subscription provider. The causality runs one way: they support many providers _because_ they own the model.

That option is foreclosed here. Under merchant of record, Polar must own the invoice, because the invoice is the tax document naming the seller. Owning the invoice model means becoming the seller, which is the entire benefit being bought. So this package normalizes provider-owned models rather than replacing them, and accepts the narrower promise that comes with it.

#### The seam that does travel

The entitlement layer is available even under merchant of record, and it is where the successful multi-provider products put their seam. Stigg runs across Stripe, Zuora, Chargebee, AWS Marketplace, and the Apple App Store precisely because it never abstracts the rails: the provider keeps the catalog, invoices, and taxes, and Stigg owns grants and consumption. Flowglad's pitch is "zero webhooks" — the app reads current entitlement state instead of listening for events. Autumn absorbs Stripe's webhooks and re-emits its own vocabulary (`billing.updated` carrying a `plan_changes[]` diff).

Most tellingly, the two better-auth plugins that agree on nothing else both converged on a customer-state snapshot and a slug-to-product mapping that keeps the catalog in the provider. Those are the two primitives with the strongest evidence behind them, and both are adopted below.

## Decision

Create `@pkg/billing`: vendor-neutral billing models plus an adapter contract, with Polar as the first adapter and an in-memory adapter that is a real implementation. `@pkg/polar` is deprecated on adoption and deleted once its last consumer moves.

The name is the domain, not the vendor, and matches `@pkg/mail` (ADR-018) and `@pkg/rate-limit` (ADR-019). `@pkg/commerce` was rejected as promising carts and catalogs; `@pkg/payments` as excluding subscriptions and entitlements, which are most of what the apps read.

### 1. What This Package Promises

Stated first, because the prior art shows the promise is where these designs fail.

It promises: app code holds no vendor type and no vendor id; one failure convention with an explicit unknown outcome; page-at-a-time listing; a test double that is contract-checked; usage ingestion with no app semantics baked in; and a conformance suite that defines what an adapter is.

It does not promise that changing providers is cheap. Polar to Stripe is a change of who legally sells the product, not a config change, and what the package buys is that the code obstacle is bounded and testable while the commercial one is not.

The specifics matter, because the folk version of this is wrong in both directions. Polar documents an offboarding path, and under it **customers and their saved payment methods do move** — easiest into our own Stripe account, since Polar settles through Stripe, and otherwise to any PCI Level 1 provider through Stripe's PAN export. Customers do not re-enter cards; the visible change is whose name appears on their statement.

What does not move is everything this package models: products, prices, discounts, and benefits are recreated by hand, and **active subscriptions are recreated one by one**, each with its first charge aligned to the customer's next Polar renewal or they get billed twice for the same period. During offboarding new checkouts are disabled while existing subscriptions keep renewing until individually cancelled, payouts are held for 120 days after the final transaction, and the whole thing is support-assisted — a few business days into our own Stripe account, several weeks into anyone else's.

Two constraints are permanent rather than procedural. A merchant of record is the merchant, so we cannot hold a token requestor id for our own sales, which forecloses network-token portability and vault-level account updater. And a provider's customer id and token are not reusable at another provider, so a system must expect to hold several provider identities for one customer.

So the honest promise is: **new customers can be signed up on a different provider immediately, and existing subscribers are a re-creation project measured in weeks — not a rewrite, and not a config change.**

Finally, it targets **running two providers at once**, not a one-shot swap, and the two are different designs. The realistic reason to need a second provider is not that Polar's API disappoints — it is availability: an account suspension, an acquisition that stalls development, or a provider going under. Several of the migration accounts in the survey were triggered by exactly that. A swap tolerates a leaky adapter because it happens once; concurrency does not, which is why the customer link in §18 is a row per connection rather than a column.

It also does not promise a uniform verb for every operation. Where the providers genuinely differ in shape, the difference is expressed in the contract rather than hidden, which is the lesson of Pay's no-op `subscribe`.

### 2. The Adapter Is The Client

No wrapper class in front of the adapter. `Billing` is the interface apps program against, and each adapter implements it directly:

```ts
import type { Billing } from "@pkg/billing";

import { PolarAdapter } from "@pkg/billing/polar";

let billing: Billing = new PolarAdapter({
	accessToken: () => env.POLAR_ACCESS_TOKEN.get(),
	webhookSecret: env.POLAR_WEBHOOK_SECRET,
	catalog: { pro: "prod_abc", essentials: "prod_def" },
});
```

`accessToken` accepts a string or a function resolving one, preserving the Secrets Store case in `apps/r3-auth` where the token is only readable with an `await`.

Resources are grouped rather than flattened onto one class. PayKit's flat 21-method interface is the counter-example: adding a method breaks all 17 providers plus a runtime method-name list, and a 948-line file is what the current package already produced.

```ts
export interface Billing {
	/** Which backend issued the ids this instance returns; stored beside them. */
	readonly provider: ProviderId;

	readonly customers: CustomerApi;
	readonly catalog: CatalogApi;
	readonly checkouts: CheckoutApi;
	readonly portal: PortalApi;
	readonly subscriptions: SubscriptionApi;
	readonly entitlements: EntitlementApi;
	readonly orders: OrderApi;
	readonly discounts: DiscountApi;
	readonly usage: UsageApi;
	readonly webhooks: WebhookApi;

	readonly refunds?: RefundApi;
	readonly meters?: MeterApi;
	readonly licenseKeys?: LicenseKeyApi;
	readonly files?: FileApi;
	readonly customFields?: CustomFieldApi;
	readonly metrics?: MetricsApi;
	readonly endpoints?: WebhookEndpointApi;

	/** The configured vendor SDK or HTTP client, for what the contract does not model. */
	readonly native: unknown;
}
```

### 3. Capabilities Are Optional Properties

```ts
import { supports } from "@pkg/billing";

if (!supports(billing, "licenseKeys")) return notFound();
let key = await billing.licenseKeys.validate({ key, productId });
```

`supports()` narrows through `Required<Pick<Billing, K>>`, so the optional property is non-optional inside the branch. The optional property is both the declaration and the implementation, which is why it cannot disagree with itself the way Omnipay's `supportsRefund()` and Rails' twenty `supports_*?` predicates can. Medusa added account holders and saved payment methods across three minor versions without breaking a single existing provider on exactly this mechanism.

A capability gap is never a silent no-op and never a missing method. It is an absent property, checked by the compiler.

Granularity matters, and the survey is a warning here. Coarse capability groups work — that is Medusa's mechanism, and it survived three minor versions of additions. Fine-grained per-operation matrices rot: ActiveMerchant's hand-maintained feature matrix covers about fifty gateways against two hundred and fifty implementations and was last edited years ago, and none of the commercial engines that support dozens of providers ships a machine-readable capability matrix at all. So capabilities stay at the group level, and a difference finer than a group is expressed as an `unsupported` failure from a real method rather than as another flag.

### 4. Models Are Ours, And The Mapping Is Enforced

Every model is defined in the package; no vendor type is re-exported.

```ts
export interface Customer {
	id: string;
	/** Our own identifier, set at creation and the join key across providers. */
	externalId: string | null;
	email: string;
	name: string | null;
	metadata: Record<string, string>;
	createdAt: Date;
	/** The provider's own payload for this object. Never interpreted here. */
	providerData: Readonly<Record<string, unknown>>;
}

export type SubscriptionStatus =
	"trialing" | "active" | "past_due" | "canceled" | "revoked" | "incomplete";
```

Normalized vocabularies are parsed at the adapter boundary with `remix/data-schema`, not declared and hoped for. A provider status the adapter cannot map is a mapping failure the conformance suite catches, because Pay's dead `STATUSES` constant is what happens otherwise: the vocabulary exists, nothing enforces it, and a predicate and a scope end up disagreeing about the same row.

The provider's own status is kept beside ours rather than replaced by it. Three of these systems landed on the same rule independently — Kill Bill keeps a plugin status enum deliberately distinct from its core one, Lago keeps a raw provider status beside a normalized one, and Metronome keeps the provider's status in a separate sub-object with a published event-to-enum table. Collapsing the two is the classic bug in this class of design: the moment they merge, an unmapped provider state has nowhere to live.

An adapter's mapping is declared as data, not written as a function — three sets naming which provider statuses mean processing, succeeded, and failed. It is the cheapest normalization mechanism found in the survey, and it makes a new provider status a visible omission rather than a silent fall-through.

Derived state is computed from our own fields rather than delegated to a vendor enum. Cashier's `canceled()` reading local `ends_at` is portable; its `active()` branching on `StripeSubscription::STATUS_*` is not.

### 5. Every Model Carries Its Provider Payload

`providerData` is the escape hatch, and it is deliberate rather than apologetic. Nine independent projects arrived at the same invention, and the ADR is not going to be the tenth to discover it late.

Three rules, taken from the prior art's mistakes:

- The package never reads it. It is stored, returned, and otherwise untouched.
- It never holds anything sensitive. Medusa's `data` is publicly reachable from its storefront, and that footgun is worth avoiding by policy rather than by review.
- `native` on the adapter is the other half: the configured vendor client for operations the contract does not model. Reaching for it is expected, not a failure — the review's estimate is that a fifth to a third of real billing code stays provider-specific, and Cashier, Pay, and PayKit all ship this door.

An escape-hatch call site is not portable, and that is visible in the code rather than discovered during a migration.

### 6. Money Is Minor Units, And The Adapter Declares Its Convention

```ts
export interface Money {
	/** Minor units, always an integer: 500 is five dollars, 500 is also five hundred yen. */
	amount: number;
	currency: Currency;
}
```

PayKit is the cautionary case: a unified `amount: number` whose unit silently depends on the provider, no conversion anywhere, and a `amountToCentsMultiplier` knob in its framework adapter admitting the field was never unified.

So the adapter declares what its provider speaks, rather than the package assuming:

```ts
interface Billing {
	/** Whether this provider's API speaks minor units or major units. */
	readonly currencyUnit: "minor" | "major";
}
```

Minor units are not universally two decimals. JPY and CLP have none; BHD and KWD have three. Precision is derived from the currency table rather than assumed, and the conformance suite bills in a zero-decimal currency so an adapter that assumes cents fails there instead of in production.

Usage costs stay a decimal string, because per-unit infrastructure costs fall below `1e-6`, where JavaScript switches to exponential notation and Polar's parser rejects the value:

```ts
export interface Cost {
	/** Minor units as a plain decimal string, e.g. `"0.003476700"`. */
	amount: string;
	currency: Currency;
}
```

### 7. Every Method Returns A Result, Including "We Do Not Know"

```ts
export type BillingErrorCode =
	| "not_found"
	| "invalid_request"
	| "unauthenticated"
	| "forbidden"
	| "conflict"
	| "rate_limited"
	| "unavailable"
	/** The provider's API cannot do this at all. */
	| "unsupported"
	/** This adapter has not implemented it yet. */
	| "not_implemented"
	/** A timeout or 5xx: the operation may or may not have taken effect. */
	| "unknown";

export class BillingError extends Error {
	readonly code: BillingErrorCode;
	readonly provider: ProviderId;
	/** The provider's own code, for logs and support tickets. */
	readonly providerCode: string | null;
	/** Never `true` for `unknown`. */
	readonly retryable: boolean;
}
```

The `unknown` arm is the correctness-critical addition. Kill Bill separates `ERROR` (the gateway rejected it) from `UNDEFINED` (a timeout or 500, where nobody knows whether money moved), and Hyperswitch handles 4xx and 5xx through separate methods for the same reason. Every code in the first draft asserted a definite outcome, and a billing package that cannot say "unknown" eventually double-charges or wrongly denies access. `retryable` is never true for it: recovery is reconciliation, not a retry.

Splitting `unsupported` from `not_implemented` follows PayKit's one clearly good error decision — the caller learns whether to change the design or wait for a release.

```ts
let result = await billing.customers.create({ email, externalId: userId });
if (isFailure(result)) {
	logger.error("billing.customer_create_failed", {
		code: result.error.code,
		providerCode: result.error.providerCode,
	});
	return serverError();
}
```

One convention replaces the current three, and `providerCode` survives into the log because the postmortem literature is unanimous that raw provider context is what a 2 AM incident actually needs.

An `unknown` that cannot be resolved is only a nicer label for a lost write, so two obligations come with it. Every mutating call carries an idempotency key derived from our own row id, and every call writes our own correlation id into the provider's metadata. That is what makes recovery possible: Kill Bill's reconciler resolves an undefined transaction by searching the provider for its own correlation id — one match adopts the provider's answer, no match marks the attempt cancelled, and more than one match is deliberately escalated to a human rather than guessed. Lago does the same thing with an idempotency key of `payment-<id>` and its own ids in Stripe metadata.

Adapters are consequently required to implement a read-back for anything they mutate, and that read-back is the only path the reconciliation job uses.

### 8. Customers Are Referenced By Either Id, As A Union

```ts
export type CustomerRef = { id: string } | { externalId: string };
```

The current package takes two optional fields and throws when both are missing. As a union, "one of the two" is a type error. The `externalId` arm is also what makes a migration tractable at all: Pay's deepest reported bug is that it treats the provider's customer as the canonical identifier, so a customer who edits their email in a hosted checkout gets a second provider-side record and their subscription silently stops syncing.

### 9. The Catalog Stays In The Provider, Addressed By Our Slugs

```ts
let checkout = await billing.checkouts.create({ product: "pro", customer: { externalId: userId } });
```

Adapters are configured with a slug-to-product map, and no provider product id appears at a call site. Products and prices are read-only in the contract: creating them is a dashboard task, and a write path nobody uses is a write path nobody tests.

This resolves the difference that split better-auth's two plugins — a Stripe plan is defined in your code, a Polar product is defined in Polar — by choosing the side that both providers can honour. Every entitlement product surveyed independently addresses features and meters by developer-defined slugs.

### 10. Subscriptions Are Created By Checkout, Never Directly

`SubscriptionApi` has no `create`. A subscription comes into existence when a checkout completes, and the app learns about it from a webhook.

This is the design's most direct debt to the prior art. Polar, Paddle, Paddle Classic, and Lemon Squeezy cannot create a subscription by API; Stripe can. Pay preserved a uniform `subscribe()` by making it an empty method on three of six providers. Cashier let the two packages diverge instead: its Stripe `newSubscription()` returns a persisted subscription synchronously, while its Paddle `subscribe()` returns a checkout object and the subscription materializes later from a webhook — same parallel naming, different kind of return value, reversed argument order.

The divergence is in timing, not naming, so a uniform synchronous creation method is a lie on one provider. Modelling every subscription as webhook-eventual is true on both, and it is what the apps already do — `apps/uptime` keeps a D1 projection written by its webhook precisely because of this.

### 10a. Plan Changes Are Expressed As Intent

A subscription update takes what the caller wants to happen to the money, not the provider's enum:

```ts
await billing.subscriptions.change({ subscription, product: "pro", billing: "charge_now" });
```

`"charge_now" | "defer_to_next_invoice" | "at_next_cycle"` covers what both providers can express. The enums themselves do not map: Polar has four proration behaviours and Stripe three, and Stripe's "no proration at all" has no Polar equivalent, so a pass-through field would be a different feature depending on who is configured.

Two provider behaviours the adapter must not hide, because they change what the caller has to handle: Polar silently promotes a deferred proration to an immediate charge when the billing interval changes, and for the charging behaviours the subscription is only updated if the payment succeeds — a declined card leaves the plan unchanged and returns a failure rather than scheduling anything. A caller that assumes a change always lands will show the wrong plan.

### 11. Entitlement Is The Primary Read Path

```ts
let state = await billing.entitlements.of({ externalId: userId });
if (!state.features.has("flow_monitors")) return upgradePrompt();
```

`entitlements.of()` returns one snapshot: active products, feature flags, meter balances, and subscription status. It is a required group, not an optional capability, and it is the read path app code should prefer over inspecting a `Subscription`.

This is the seam with the best evidence in the survey. It is the only layer at which anyone runs across five billing systems, it is what makes a future adapter tractable, and every provider can answer "what does this customer have right now" while none of them agree on event shapes. It also composes with the projection apps already keep: the snapshot is what a webhook invalidates, so events become cache-invalidation hints rather than the source of truth.

It is also the cheapest group to implement, because Polar already ships it: a customer-state endpoint returning active subscriptions, granted benefits, and meter balances, plus a `customer.state_changed` event that fires when any of it moves. The adapter maps one call, and Stripe's side composes from subscriptions plus entitlements.

### 11a. What The Contract Deliberately Omits

Disputes, chargebacks, payouts, and tax reporting are outside this package, and not because they are unimportant. Under merchant of record they belong to the provider: Polar emits no dispute event and no payment-method event at all, because it is the party that fights the chargeback and holds the card. A `disputes` capability group would therefore have no Polar implementation and no Polar data to model, and a dispute reaches us as a line item on a payout statement rather than as something to handle.

The rule generalizes: where merchant of record removes a whole subsystem, that subsystem stays out of the contract rather than becoming a capability nobody implements. This is also why the seller of record is a property of the deployment worth stating plainly in each app's configuration rather than hiding behind the adapter — it changes who the customer's counterparty is, not just which API gets called.

### 12. Lists Return Pages

```ts
export interface Page<T> {
	items: T[];
	cursor: string | null;
}

let page = await billing.orders.list({ customer: { externalId: userId }, limit: 25 });

for await (let order of paginate((cursor) => billing.orders.list({ product: "pro", cursor }))) {
	// walk every page, one request at a time
}
```

Draining every page stays available through `paginate()`, as the caller's explicit choice. PayKit shipped no list methods at all — no `list`, no cursor, no `has_more` anywhere — which pushes every enumeration through its escape hatch.

### 13. Webhooks: Four Questions, One Event Union

The provider-specific part is decomposed, so the generic part can be written once:

```ts
export interface WebhookApi {
	/** Is this delivery authentic? Owned by the adapter: the schemes differ. */
	verify(request: Request, rawBody: string): Promise<Result<void, BillingError>>;
	/** Which object is this about, for deduplication and routing. */
	reference(rawBody: string): Result<{ id: string; type: string }, BillingError>;
	/** The normalized event, or `unrecognized`. Always carries the raw payload. */
	event(rawBody: string): Result<BillingEvent, BillingError>;
	/** verify + reference + event, for handlers that want one call. */
	parse(request: Request, rawBody: string): Promise<Result<BillingEvent, BillingError>>;
}
```

Hyperswitch and Medusa independently split webhook handling this way, and the reason is concrete: with `reference()` separate, deduplication and idempotency are generic package code instead of something every app forgets. The monorepo currently has no webhook idempotency anywhere.

```ts
export type BillingEvent = { id: string; raw: unknown } & (
	| { type: "customer.created" | "customer.updated"; customer: Customer }
	| { type: "checkout.completed"; checkout: Checkout }
	| {
			type:
				| "subscription.activated"
				| "subscription.updated"
				| "subscription.canceled"
				| "subscription.revoked";
			subscription: Subscription;
	  }
	| { type: "order.paid"; order: Order }
	| { type: "order.refunded"; order: Order; refund: Refund }
	/** Authentic, but not modelled here. Carried through so it can be handled or logged. */
	| { type: "unrecognized"; providerType: string }
);
```

`raw` is on every event, not only the unrecognized one. PayKit's most-commented issue is a user listing eighteen Stripe events its twelve canonical types did not cover, and its resolution was to always emit the raw event alongside the mapped ones under a `provider.event` namespace. Carrying `raw` everywhere means an incomplete canonical model is never a dead end, and a normalized handler and a provider-specific one can coexist.

Verification stays adapter-owned because the schemes differ: Polar sends Standard Webhooks headers, and the Polar adapter keeps the base64 step Polar's senders apply to a text secret — handing that secret straight to a Standard Webhooks verifier keys on the wrong bytes and rejects every authentic delivery. A Stripe adapter implements `Stripe-Signature` instead. Both use `@pkg/webhooks` (ADR-026) for HMAC primitives; neither delegates the decision to it.

Signature failure is fail-closed; an unmodelled shape is fail-open as `unrecognized`.

Three rules come with it, each earned by a mistake in the prior art:

- **A checkout return is not a webhook.** `CheckoutApi` handles the customer coming back from a hosted page; `WebhookApi` handles the provider calling us. They stay separate methods with separate call sites, because Omnipay had to deprecate its way out of merging them and django-payments still serves a browser redirect and a machine response from one function.
- **An event is a hint, not the new state.** A handler acting on anything consequential re-reads the object through the adapter rather than trusting the payload, because deliveries arrive out of order, get replayed, and can carry an older API version's shape.
- **Reconciliation is not optional.** Webhooks get missed, so a periodic repair that re-reads provider state is part of adopting this package, not a later addition. `apps/uptime` already does this for subscriptions.

### 13a. Event Payloads Are Persisted Before They Are Trusted

Apps store the raw delivery, keyed by the `reference()` id, before acting on it, with `valid` and `processed` recorded on that row. It gives idempotency a durable key, makes a replay cheap to detect, and leaves an audit trail when a handler was wrong. This is dj-stripe's `WebhookEventTrigger` pattern, and it is the piece the monorepo is missing entirely today.

### 14. Usage Ingestion Is Generic

```ts
export interface UsageEvent {
	name: string;
	customer: CustomerRef;
	/** Idempotency key; a resent event with the same value is counted once. */
	externalId?: string;
	timestamp?: Date;
	metadata?: Record<string, string | number | boolean>;
	cost?: Cost;
}

await billing.usage.ingest([
	{ name: "mau", customer: { externalId: tenantId }, metadata: { month, count } },
]);
```

`reportMAU` and `ingestPageViews` do not come along: each was one app's meter name and metadata shape living in a shared package. Chunking at the provider's per-request limit stays inside the adapter.

Metered billing is also the reason no existing library can be adopted here. Two apps bill on usage, and PayKit — the only standalone TypeScript contender — has no meter, usage-record, or tiered-pricing concept anywhere in its packages or docs.

### 15. Adapters Load Their Vendor Code Lazily

Constructing an adapter does no work and imports no SDK. `@polar-sh/sdk` builds roughly 700 zod schemas at load, costing over a megabyte of Worker bundle and tens of milliseconds of startup CPU in every isolate, including the many that never bill anything. The Polar adapter keeps the memoized first-call `import()` the current client uses, with a rejected load discarded so a transient secret-store failure clears on the next call.

A Stripe adapter should be written over `fetch` for the same reason. Pay's soft-dependency pattern is worth copying: the package depends on no vendor SDK, each adapter declares its own optional peer dependency, and a version mismatch fails loudly at construction rather than mysteriously at the first charge.

### 16. The Memory Adapter Is A Real Adapter

```ts
import { MemoryAdapter } from "@pkg/billing/memory";

let billing = new MemoryAdapter({ catalog: { pro: { amount: 4900, currency: "usd" } } });

await billing.customers.create({ email: "jane@example.com", externalId: "u_1" });
let delivery = billing.webhooks.emit({ type: "order.paid", order });
```

It is a full implementation that passes the same conformance suite, not a mock — Pay's `FakeProcessor` is the model, and the reason it stayed honest for six providers is that it is contract-checked by construction and doubles as the template for writing a new adapter.

Pay also earns a second use from it that is worth having: a fake processor is how you give a teammate or a tester a comped account. If that is ever wanted here, Pay's two guards come with it — construction must be explicitly opted into so a form parameter cannot promote a user, and comped accounts must be excludable from revenue queries.

`FakePolarClient` in `apps/books` and the `as unknown as PolarClient` cast in `apps/r3-auth` both delete.

### 17. Conformance Specs, Local And Remote

The package ships one executable spec suite (`packages/billing/spec/`) that every adapter must pass, parameterized by adapter, with the required groups in one suite and each optional capability in its own file. ActiveStorage's shared service tests are the precedent: assert only the genuinely universal core, and leave anything backend-specific to its own file rather than conditionally skipping inside the shared suite.

Capability declarations are asserted in both directions: for each optional group, the suite checks that `supports()` and a real call agree — a declared group must actually work, and an undeclared one must actually be absent. Omnipay's shared `GatewayTestCase` does exactly this, and it is what stops an adapter from declaring a capability it stubs. The compiler covers the call site; only a spec covers the adapter.

The suite runs twice. Locally against the memory adapter in CI, and remotely against a Polar sandbox organization. The remote run is the load-bearing one — a remote suite against real sandboxes is what let ActiveMerchant catch contract drift across 100+ gateways, and no amount of in-memory green proves an adapter maps a real payload correctly.

Per the spec-first rule, these specs are written before each adapter method.

### 18. Stored Ids Say Which Provider Issued Them

| Before                  | After                                    |
| ----------------------- | ---------------------------------------- |
| `polar_customer_id`     | a `billing_customers` row per connection |
| `polar_subscription_id` | `billing_subscription_id`                |
| `polar_product_id`      | `billing_product_slug`                   |

Neither Pay nor Cashier stores the provider name, and in Cashier's case that is the root of the migration impossibility — the provider is implicit in `stripe_id` and `stripe_status`.

A single `billing_customer_id` column is not enough, though, and this is the one place the first draft of this ADR was simply wrong. Because a provider's customer id and payment token cannot be reused at another provider, one of our customers legitimately has several provider identities, and a dual-run needs all of them at once. So the customer link is a row, not a column:

```
billing_customers
  subject_id        -- our own identifier, the join key
  connection        -- which configured connection issued the ids below
  provider_customer_id
  is_default        -- the connection to bill against now
  UNIQUE (subject_id, connection)
  UNIQUE (subject_id) WHERE is_default
```

This is Lago's shape, arrived at after supporting six providers, and the partial unique index on `is_default` is what keeps "which provider bills this customer" unambiguous while several identities coexist.

`connection` rather than `provider` is deliberate: it names a configured credential set, not a vendor. Five apps could sell through five different Polar organizations, and Chargebee — which routes across 63 gateways — rejects a request that names a gateway where a gateway account is required, because real merchants run several accounts per provider. An adapter is therefore constructed with a connection code, and that code is what gets stored.

Every customer is created with `externalId` set to the app's own identifier, so customers can be re-resolved on a new backend without a mapping table. Column renames happen per app as it adopts the package.

Where an app keeps a projection of provider state, it should keep the raw payload beside the normalized columns. Pay added that column at version 10 and describes it as making future changes easier; the apps here already project without it.

## Consequences

### Positive

- **A provider change is bounded** - one construction site per app plus secrets and a re-checkout campaign, rather than a rewrite of every call site, column, test double, and handler.
- **App code stops naming a vendor** - the vendor appears in one import and one construction site per app.
- **The unknown outcome is expressible** - a timeout on a billing call can no longer be mistaken for a refusal, which is the failure mode that double-charges.
- **Capability gaps are compile-time** - an absent property, never a throwing stub or a silent no-op.
- **The escape hatch is designed, not discovered** - `providerData` and `native` mean an unmodelled provider feature is reachable, and visibly non-portable at the call site.
- **Webhook idempotency becomes possible** - `reference()` gives the package a generic dedup key, which nothing in the monorepo has today.
- **Entitlement reads survive a provider change** - the one seam the surveyed multi-provider products actually run on.
- **The gap that blocked a feature closes** - meter quantities are in the contract, so `apps/uptime` can build its team-usage view.
- **Test doubles come from the package** - contract-checked by construction; no subclassing, no casting through `unknown`, no mocking a vendor module.
- **One failure convention** - `Result` everywhere, with a normalized code, `providerCode` preserved, and a `retryable` flag jobs can branch on.
- **Portability is testable** - a conformance suite, run against a real sandbox, states what an adapter is.

### Negative

- **A second layer of models to maintain** - every field worth exposing must be mapped, and a mapping can lose nuance or be wrong in ways the vendor's own types could not be.
- **The wide surface is against the evidence** - every project that achieved real provider independence shrank the portable surface to roughly six operations. Two providers instead of a hundred is the reason to expect a different outcome, and it is an expectation, not a proof.
- **Five apps and three schemas to migrate** - mechanical but wide, and every webhook handler must be re-verified against real deliveries.
- **Order normalization is the weakest seam** - a paid order is one object in Polar and an invoice plus a payment intent in Stripe; that mapping will need revision when a second adapter is written.
- **Escape-hatch usage will not be rare** - the review's estimate is a fifth to a third of real billing code stays provider-specific, so `native` will appear in app code and each use is a place a migration must revisit.
- **Switching providers is still mostly not a code problem** - merchant-of-record status, tax remittance, the product catalogue, and every active subscription are re-created rather than ported, card-data migration is a compliance process requiring the losing provider's cooperation, and payouts are held for 120 days afterwards.
- **A bug can now live in our mapping** - previously a wrong field was the vendor's.
- **Adoption brings work the apps do not do today** - persisting raw deliveries, deduplicating by reference, re-reading objects instead of trusting payloads, and a reconciliation job per app. All of it is missing now, so adopting the package surfaces a gap rather than creating one, but it is real work in Phase 4 rather than a free consequence of the refactor.

### Neutral

- **Polar stays the provider** - this changes where the dependency sits, not who processes payments.
- **`@pkg/polar` is deprecated, not rewritten in place** - it keeps working until its last consumer moves.
- **No new service-container token** - apps construct the adapter in an app module and pass it where needed; the five existing `PolarClient` registrations point at the adapter until each app is touched.
- **Webhook route paths and secret names keep their current names** - renaming routes would mean re-registering endpoints with the provider, and `POLAR_*` accurately names the Polar adapter's inputs.
- **Subscription creation is asynchronous for everyone** - which matches what the apps already do, and is the only shape true on both providers.

## Implementation Plan

Phase order changed after the prior-art review: the second adapter moved from last and optional to third and mandatory, because it is the only evidence the contract is provider-agnostic.

### Phase 1: Models, Contract, And Specs

**Priority:** High
**Estimated Effort:** 1 day

1. Create `packages/billing` with models, `Billing`, the resource-group interfaces, `BillingError`, `supports()`, and `paginate()`.
2. Write the conformance spec suite for the required groups, including a zero-decimal-currency case.
3. Implement `MemoryAdapter` until the suite is green.

### Phase 2: Polar Adapter, Parity Surface

**Priority:** High
**Estimated Effort:** 1-2 days

1. Implement every group the current 26 methods cover, keeping lazy SDK loading and the text-secret webhook encoding.
2. Run the conformance suite against a Polar sandbox organization.
3. Port `@pkg/polar`'s existing tests onto the adapter.

### Phase 3: Prove The Seam

**Priority:** High
**Estimated Effort:** 1 day

Write the narrowest useful `StripeAdapter` — customers, checkout, subscription read, entitlement snapshot, one webhook — in test mode, adopted by no app, and run the conformance suite against it. Until a second adapter passes, this ADR's central claim is untested, and every finding in the review says that is where these designs break. A contract revised at this point is cheap; revised in Phase 4 it is not.

### Phase 4: App Adoption

**Priority:** High
**Estimated Effort:** 1 day per app

Per app: construct the adapter, replace call sites, delete the local test double, rename the stored columns, and re-verify a real webhook delivery. Simplest billing first: `apps/r3-auth`, `apps/auth-saas`, `apps/blog-saas`, `apps/uptime`, `apps/books`.

### Phase 5: Capability Build-Out

**Priority:** Medium
**Estimated Effort:** 1-2 days

Meters and customer balances first, since a feature is waiting on them; then refunds, license keys, files, custom fields, metrics, and webhook-endpoint management, each with its own capability spec file.

### Phase 6: Remove `@pkg/polar`

**Priority:** Medium
**Estimated Effort:** 1 hour

Delete the package and its workspace dependencies once nothing imports it.

## Alternatives Considered

### 1. Keep `PolarClient`, Rename It

**Rejected because**: the vendor's model types are the actual coupling, and a rename leaves them in place. The apps would still hold Polar's `Subscription` and store `polar_customer_id`.

### 2. Two Provider-Specific Packages, As Laravel Did

Ship `@pkg/polar` and later `@pkg/stripe` as independent packages with no shared contract, each expressing its provider's real model. This is Cashier's answer, chosen deliberately by maintainers who had the resources to unify and declined.

**Rejected because**: the cost Cashier accepted is duplication across packages that drift, and the benefit it bought — each package expressing its provider honestly — is mostly available here anyway through capability groups and the escape hatch. The decisive difference is that Cashier serves thousands of applications with wildly different billing models, so a lowest common denominator would have been useless to most of them; this package serves five apps with two billing models. Worth revisiting if the second adapter in Phase 3 cannot be written without distorting the contract.

### 3. Own The Model, Use The Provider Only To Charge

Hold customers, plans, subscriptions, usage, and invoices in our own tables, and use the provider only to charge a stored payment method. This is Lago, Kill Bill, Chargebee, Zuora, and Recurly, and it is what most prior art converged on.

**Rejected because**: it is incompatible with merchant of record. The invoice is the tax document naming the seller, so owning the invoice model means becoming the seller and giving up the entire reason Polar is the provider. It also means owning proration, dunning, tax, credit notes, and reconciliation, which is the hardest correctness domain available.

### 4. An Entitlement Layer Only, No Rails Abstraction

Abstract only "what does this customer have right now" plus usage grants, and let every checkout, portal, and webhook call be provider-specific. This is Stigg, and it is why Stigg runs across five billing systems.

**Rejected as the whole answer, adopted as part of it**: entitlements are now a required group and the preferred read path (§11). But the apps also create checkouts, open portals, list orders, and ingest usage, and leaving those un-abstracted would leave the vendor's types in the app code, which is the problem being solved. The entitlement seam is the part that survives a provider change; it is not the part that removes `@polar-sh/sdk` from five apps.

### 5. Adopt PayKit Or Another Existing Library

**Rejected because**: PayKit is the only standalone TypeScript contender and it cannot serve this monorepo. It has no metered or usage billing of any kind, and two apps bill on usage; it has no list or pagination methods at all; its unified `amount` field is not actually unified across providers; and it sends live-mode transaction amounts to a vendor telemetry endpoint on every create call with no documented opt-out. Its maturity is also not there: 67 stars, one maintainer at 89% of commits, four issues ever, 142 weekly downloads, no license file, and package metadata pointing at an abandoned repository namespace.

The broader search found no mature standalone library in any language that abstracts subscription billing across providers. Every survivor is either inside an e-commerce framework, restricted to charges, or a billing engine that owns the model.

### 6. Buy MoR Optionality From Stripe Instead

If the real requirement is being able to stop being the merchant of record without changing code, Stripe sells both sides now: Stripe direct and Stripe Managed Payments, its own merchant-of-record product built out of the Lemon Squeezy acquisition. Same vault, same object graph, so it is the only merchant-of-record transition on the market that genuinely is a configuration change.

**Rejected because**: it is roughly double Polar's rate, and Stripe documents Managed Payments as a poor fit for sophisticated subscription, metered, or hybrid billing, with subscriptions created through Checkout rather than the API. Metered and hybrid billing is precisely what two of these apps do. Worth revisiting only if merchant-of-record optionality ever outranks the billing model.

### 7. Normalize Everything, No Optional Capabilities

**Rejected because**: it moves a compile-time fact to runtime, which is exactly what PayKit's runtime schema forces — 17 providers each shipping stubs that throw, one of them in 41 places. A page rendering license keys should not typecheck against a backend that has none.

### 8. A Capability Registry Or A Capabilities Set

**Rejected because**: it can disagree with the implementation. Optional properties cannot, and Pay is the demonstration of what unenforced declarations become — a normalized status list with exactly one reference in the whole repository, its own definition.

### 9. Wait Until A Second Provider Is Actually Needed

**Rejected because**: the cost is paid at migration time either way, and highest exactly when there is schedule pressure. Several fixes here are worth landing with no provider change in sight: one failure convention with an unknown outcome, page-at-a-time lists, package-owned test doubles, webhook idempotency, no app semantics in shared code, and the meter-quantities gap.

## References

- [Polar API reference](https://docs.polar.sh/api-reference) and [Polar's offboarding guide](https://polar.sh/docs/migrate-away)
- [Polar Master Services Terms](https://polar.sh/legal/master-services-terms), for who the seller of record is
- [Stripe Managed Payments](https://docs.stripe.com/managed-payments)
- [Stripe API reference](https://docs.stripe.com/api)
- [Stripe payment-method data migrations](https://docs.stripe.com/get-started/data-migrations/overview)
- [Standard Webhooks](https://www.standardwebhooks.com)
- [Pay (Rails)](https://github.com/pay-rails/pay) and [its multi-processor caveat](https://github.com/pay-rails/pay/blob/main/README.md)
- [Laravel Cashier (Stripe)](https://laravel.com/docs/13.x/billing), [Cashier (Paddle)](https://laravel.com/docs/13.x/cashier-paddle), and [the rejected driver-abstraction request](https://github.com/laravel/cashier-stripe/issues/1591)
- [PayKit](https://docs.usepaykit.dev/introduction)
- [ActiveMerchant `Gateway`](https://github.com/activemerchant/active_merchant/blob/master/lib/active_merchant/billing/gateway.rb)
- [Omnipay](https://github.com/thephpleague/omnipay) and [its shared `GatewayTestCase`](https://github.com/thephpleague/omnipay-tests/blob/master/src/GatewayTestCase.php)
- [django-payments `BasicProvider`](https://github.com/jazzband/django-payments/blob/master/payments/core.py)
- [dj-stripe webhook models](https://github.com/dj-stripe/dj-stripe/blob/main/djstripe/models/webhooks.py)
- [django-oscar payment models](https://github.com/django-oscar/django-oscar/blob/master/src/oscar/apps/payment/abstract_models.py)
- [Medusa `AbstractPaymentProvider`](https://docs.medusajs.com/resources/references/payment/provider)
- [Kill Bill payment plugins](https://killbill.github.io/killbill-docs/latest/payment_plugin.html)
- [Lago payment providers](https://github.com/getlago/lago-api) and [its Stripe integration](https://docs.getlago.com/integrations/payments/stripe-integration)
- [Zuora on multiple gateways and network tokens](https://docs.zuora.com/en/zuora-payments/process-payments/network-tokenization/multiple-gateways-and-network-tokens)
- [Chargebee Smart Routing and gateway accounts](https://www.chargebee.com/docs/payments/2.0/payment-gateways-and-configuration/gateway_settings)
- [Recurly on switching payment gateways](https://docs.recurly.com/recurly-subscriptions/docs/payment-gateways-1)
- [Hyperswitch connector guide](https://github.com/juspay/hyperswitch/blob/main/add_connector.md)
- [ActiveStorage shared service tests](https://github.com/rails/rails/blob/main/activestorage/test/service/shared_service_tests.rb)
- [ADR-018: Mail Package With Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [ADR-019: Adapter-Based Rate Limiting Package](./ADR-019-adapter-based-rate-limiting-package.md)
- [ADR-026: Standard Webhooks Parsing Package](./ADR-026-standard-webhooks-parsing-package.md)
- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-033: Wide Events As The Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md)

## Current Progress

- [ ] Phase 1: Models, contract, and specs
- [ ] Phase 2: Polar adapter, parity surface
- [ ] Phase 3: Prove the seam
- [ ] Phase 4: App adoption
- [ ] Phase 5: Capability build-out
- [ ] Phase 6: Remove `@pkg/polar`

## Notes

- Polar's webhook secret is an arbitrary string that its senders base64-encode before signing, so the HMAC key is the secret's UTF-8 bytes. The Polar adapter must keep that conversion; a Standard Webhooks verifier given the raw secret rejects every authentic delivery.
- Usage costs stay decimal strings, not numbers. Per-unit infrastructure costs fall below `1e-6`, where JavaScript switches to exponential notation and the provider's parser rejects the value.
- Only `apps/r3-auth` reads its token from Secrets Store, which is why `accessToken` accepts a resolver. A rejected resolution must not be memoized, or one blip leaves a long-lived instance permanently unable to bill.
- Keep vendor concepts out of the core namespace. Pay defines an unnamespaced `Pay::Payment` that is hardcoded to Stripe payment intents and setup intents, because SCA exists in only one provider's model — once the shared namespace means one vendor's concept, the abstraction has already lost. The same applies to columns: Pay's shared schema carries `stripe_account` and `application_fee_percent`.
- An abstraction that cannot survive one provider's major version bump will not survive two providers. Cashier has no upgrade path from Paddle Classic to Paddle Billing; those users stay on a forked 1.x permanently. Treat a provider's next API version as a new adapter, not a change to this contract.
- There is no public account of anyone completing a provider-to-provider migration using Pay or Cashier, despite both being widely deployed for years. That absence is the honest state of the evidence for the migration story, and a reason to keep the promise in §1 narrow.
- Polar's `external_id` is unique per organization and **immutable once set**, so the value written at customer creation is permanent. Use the app's own stable subject id, never an email or a slug that can change, and never a value that encodes which product bought what.
- Polar's API is date-versioned, and Polar itself is a Stripe-settled reseller, so an adapter pins a version and treats a Polar release note as it would a vendor SDK bump.
- One stable object, several provider attempts, is the shape that makes retries expressible without lying to the caller: a retried payment grows a second attempt rather than becoming a new payment. Worth keeping in mind if payment attempts ever get modelled here.
- When refunds arrive in Phase 5, model partial refunds as an append-only transaction log with derived balances rather than a mutable `amountRefunded` scalar. django-payments keeps the scalar and consequently can only detect an over-refund after the fact, logging an error because raising one "would just cause inconsistencies"; django-oscar keeps `amountAllocated`/`amountDebited`/`amountRefunded` as separate running totals over a transaction log, which makes the same check a precondition.
- Fraud or manual-review state is a separate axis from payment status, not another status value. django-payments models the two independently, and a Stripe-shaped model usually collapses them.
- Do not let a method's arity or argument shape depend on a capability flag. Solidus has one `void` called with three arguments or two depending on whether the payment method supports payment profiles; that is the shape a typed contract exists to rule out.
- Recurly is the one product that credibly promises a silent gateway switch, and the reason is that it holds the card data itself as a PCI-DSS Level 1 merchant service provider. That option is not available under merchant of record, which is why the promise in §1 is narrower than theirs.
- Metronome is often cited as evidence for provider-independent billing, and it is a useful design reference, but Stripe acquired it, so treat its independence story as historical rather than as a live existence proof.
- Products, prices, and discounts are read-only in the required contract. Creating them is a dashboard task, and a write path nobody uses is a write path nobody tests.
