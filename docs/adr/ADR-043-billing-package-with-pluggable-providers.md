# ADR-043: Billing Package With Pluggable Providers

## Status

**Accepted** - 2026-09-02

Revised three times, all on the same day. First after a prior-art review of Pay (Rails), Cashier (Laravel), PayKit, and roughly fifteen other multi-provider billing abstractions, which added an escape hatch this design did not have and corrected its data model. Then again after the goal itself was restated: the package exists so billing is implemented the same way in every app, not so a provider could be swapped cheaply. That second pass removed API surface rather than adding it. [Prior Art](#prior-art) records the evidence.

The third pass is this one, written after the package was built. Four providers exist: a memory one, Polar across every group, a deliberately narrow Stripe, and Mercado Pago. Writing three real providers against the contract found bugs in the contract, and this revision is what they changed: `reference()` now reads request headers and answers with a delivery id distinct from the object id, `event()` is async, `portal` and `discounts` and `usage` joined `meters` as optional groups, `subscriptions.cancel` became a contract method, `providerData` became an allow-list, `currencyUnit` was deleted, and the error vocabulary gained `invalid_response` and `retryAfter` while losing `unavailable`. The design in [Decision](#decision) is the one that exists.

## Background

Billing in the monorepo is Polar, spelled out. `@pkg/polar` wraps `@polar-sh/sdk` behind one 948-line `PolarClient` class with 26 public methods, and it re-exports the vendor's own `Customer`, `Subscription`, `Product`, `Discount`, `Order`, `Checkout`, and `CustomerSession` models as the types five apps program against. Those apps also store the vendor's identifiers as column names (`polar_customer_id`, `polar_subscription_id`, `polar_product_id`), name their webhook routes after the vendor, and name their secrets after it.

Polar is the right merchant of record for the products sold today, and nothing here proposes leaving it. The problem is not the vendor, it is that there is no shared shape: five apps bill, and each reached for whichever `PolarClient` method fit at the time. One constructs a client per webhook delivery, one injects it, two resolve it from the container, and each wraps it in a differently-shaped local service. Three failure conventions are in play, two apps hand-rolled a test double, and one of those casts through `unknown`. Reading billing in one app teaches you very little about the next.

So the goal is a single implementation shape for billing, the same in every app, whichever platform an app is on. Provider-neutrality is how that gets enforced rather than what it is for: the moment app code holds a vendor type, the shape drifts toward that vendor's model, which is exactly what happened.

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

| Concept            | Polar                          | Stripe                                    | Mercado Pago                                      |
| ------------------ | ------------------------------ | ----------------------------------------- | ------------------------------------------------- |
| Customer           | `customers`                    | `customers`                               | `customers`, searchable by email only             |
| Product / price    | `products`, prices embedded    | `products` plus separate `prices`         | `preapproval_plan` for recurring, nothing else    |
| Checkout session   | `checkouts`                    | `checkout.sessions`                       | `preferences` with inline items, or `preapproval` |
| Portal session     | `customerSessions`             | `billingPortal.sessions`                  | none                                              |
| Subscription       | `subscriptions`                | `subscriptions`                           | `preapproval`                                     |
| Paid order         | `orders`                       | `invoices` plus `paymentIntents`          | `payments`                                        |
| Discount           | `discounts`                    | `coupons` plus `promotionCodes`           | none                                              |
| Usage event        | `events.ingest`                | `billing.meterEvents`                     | none                                              |
| Meter reading      | `meters.quantities`            | meter event summaries                     | none                                              |
| Refund             | `refunds`                      | `refunds`                                 | `payments/{id}/refunds`                           |
| License key        | `licenseKeys`                  | none                                      | none                                              |
| File benefit       | `files`, downloadable benefits | none                                      | none                                              |
| Webhook proof      | Standard Webhooks headers      | `Stripe-Signature` with `t=`/`v1=` parts  | `x-signature` with `ts`/`v1` parts                |
| Tax and remittance | merchant of record             | we remain the seller, Stripe Tax computes | we remain the seller, no tax service at all       |

The third column is not hypothetical any more: all three providers are written, and the rows reading "none" are what turned four capability groups optional in §4.

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

Create `@pkg/billing`: vendor-neutral billing models plus a provider contract, with Polar as the first provider and an in-memory provider that is a real implementation. A narrow Stripe provider and a Mercado Pago provider exist alongside them to keep the contract honest, adopted by no app. `@pkg/polar` is deprecated on adoption and deleted once its last consumer moves.

The name is the domain, not the vendor, and matches `@pkg/mail` (ADR-018) and `@pkg/rate-limit` (ADR-019). `@pkg/commerce` was rejected as promising carts and catalogs; `@pkg/payments` as excluding subscriptions and entitlements, which are most of what the apps read.

### 1. What This Package Is For

Stated first, because the prior art shows the promise is where these designs fail.

**It is not for making a provider swap cheap.** That is either impossible or hard enough that designing around it distorts everything else — five independent projects concluded as much, and two removed the attempt after shipping it. Polar to Stripe is a change of who legally sells the product; the catalogue and every active subscription are re-created by hand, and Polar holds payouts for 120 days afterwards.

**It is for one legible implementation of billing, repeated.** A reviewer reads how checkout works in one app and recognizes it in the next. A new app gets billing by following the same three steps. And if an app ever runs on a different platform, its billing code still reads like everyone else's, because the platform sits behind a provider instead of in the call sites.

Concretely it promises: app code holds no vendor type and no vendor id; one failure convention; page-at-a-time listing; a contract-checked test double instead of two hand-rolled ones; usage ingestion with no app semantics baked in; and a conformance suite that says what a provider is.

It does not promise a uniform verb for every operation. Where platforms genuinely differ in shape, the difference is expressed in the contract rather than hidden — the lesson of Pay's `subscribe`, which is an empty method body on three of its six providers so that one signature could look uniform.

### 2. The Shape: Methods, Webhooks, Hosted Links

Three rules. Methods and events are the intersection every billing platform supports; hosted links are how everything touching a card stays out of our code, on whichever pages the platform hosts. The same shape stays available whatever an app runs on:

1. **Methods** for what we ask the platform to do — create a customer, open a checkout, cancel a subscription, read something back.
2. **Normalized webhook events** for how we learn what happened. Apps sync their own state from them and read their own tables.
3. **Hosted links** for anything touching money or a card. Every purchase is a redirect to a checkout link, and every billing-management action that touches a card is a redirect to a portal link on the platforms that have one.

What that excludes is the point. No card data, no payment-method objects, no embedded checkout, no setup intents, no SCA or 3-D Secure handling, no invoice rendering, no dunning. Those are precisely the areas the prior art says do not abstract: Omnipay's on-site-versus-redirect split that 3-D Secure made incoherent, ActiveMerchant extracting off-site payments into a separate gem after concluding redirect flows do not fit a request/response contract, and Cashier's payment-method and incomplete-payment subsystems that exist only on its Stripe side. Being hosted-only removes them from scope instead of solving them.

This is already how all five apps work — one notes in a comment that billing stays entirely provider-hosted — so the rule makes an existing practice explicit rather than adding a constraint.

### 3. Shaped The Way This Repo Ships Middleware-Backed Packages

The package follows `@pkg/mail` (ADR-018) and `@pkg/i18n`, which is the shape Remix v3 uses for this kind of concern: a core package holding the classes and models, a middleware module that publishes the thing on the request context, and one module per backend.

| Layer                  | Precedent                      | Here                            |
| ---------------------- | ------------------------------ | ------------------------------- |
| Classes, models, types | `@pkg/mail`, `remix/session`   | `@pkg/billing`                  |
| Request-context wiring | `@pkg/mail/middleware`         | `@pkg/billing/middleware`       |
| Backends               | `remix/session-storage/redis`  | `@pkg/billing/providers/polar`  |
| Test backend           | `@pkg/mail`'s memory transport | `@pkg/billing/providers/memory` |

The division of labour is the one `remix/auth` states for itself: **the route owns redirects, flashes, and the app's own records; the package owns the platform protocol.**

#### Providers are classes

```ts
// app/lib/billing.ts
import { PolarBilling } from "@pkg/billing/providers/polar";
import { env } from "cloudflare:workers";

export const polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN.get(),
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET.get(),
	products: { pro: "prod_abc", essentials: "prod_def" },
});
```

A class rather than a `create*` factory, because the class is both the value and the type: `PolarBilling` names the instance's type for the middleware's context augmentation and for a job's import, `instanceof` works, and a test double can extend it. It also matches every other client in the repo — `Mailer`, `APIClient`, `Database` — so there is one construction idiom rather than two.

Module scope is deliberate: options are validated at boot rather than on the first call that tries to bill. It stays safe because constructing a provider does no work — no network, no heavy module graph — so nothing runs in Worker global scope that could fail an upload.

Every credential option takes a `Secret` — the value itself, or a function resolving it — which is what keeps `apps/r3-auth` working: its token lives in Secrets Store and is only readable with an `await`, which a module-scope constructor cannot do. The function is called once, on the first call that needs it, concurrent callers share one read, and a rejection is not memoized, so one blip does not leave a long-lived provider permanently unable to bill.

That applies to signing secrets as much as to API tokens, because the constraint is where a secret lives rather than which secret it is. A signing secret is only read inside `verify()`, which is already async, and an unreadable one is reported as unproven rather than thrown — a webhook endpoint that answers 5xx is how a platform ends up disabling it.

#### The middleware publishes it on the context, and types it

```ts
// packages/billing/src/middleware/index.ts
declare module "remix/router" {
	interface RequestContext {
		/** Billing for the current request, configured by the billing middleware. */
		billing: Billing;
	}
}

export default function billing(options: BillingMiddlewareOptions): Middleware;
```

The augmentation lives in the imported middleware module rather than an ambient `.d.ts`, exactly as `@pkg/mail` and `@pkg/i18n` do it, so `context.billing` is typed in any app that registers the middleware and absent in one that does not.

The middleware is a **default export**, which is what removes the naming problem: the importing app chooses the local name, so nothing is ever forced to write `billing as billingMiddleware`.

```ts
import billing from "@pkg/billing/middleware";

import { polar } from "~/app/lib/billing";

let router = createRouter({ middleware: [billing({ provider: polar })] });
```

The convention that falls out is the same one mail already uses: **the middleware is named for the capability, the instance is named for the backend.** An app holds `polar` (or `stripe`) and registers `billing(...)`, so the two never collide and swapping the backend changes one line in one file. Following mail's `transport` option, `provider` also accepts `(context) => Billing` for an app that needs to pick a connection per request.

#### Route guards, like `requireAuth`

```ts
import { requireEntitlement } from "@pkg/billing/middleware";

export default createAction(routes.app.team.flows, {
	middleware: [requireEntitlement("flow_monitors")],
	handler,
});
```

`remix/middleware/auth` ships `requireAuth` for this reason: the check that gates a route belongs in middleware, not repeated at the top of every handler. The guard reads the app's own projection, never the platform mid-request.

### 4. Everything Is A Method On The Instance, So Jobs Work Too

Two of the five current billing call sites are cron jobs, not routes, and that decides the shape: the API cannot depend on a request context.

So the instance carries everything, grouped by resource, and the middleware is only a route-side convenience over the same object:

```ts
export interface Billing {
	readonly connection: string;

	readonly customers: CustomerApi;
	readonly catalog: CatalogApi;
	readonly checkouts: CheckoutApi;
	readonly subscriptions: SubscriptionApi;
	readonly entitlements: EntitlementApi;
	readonly orders: OrderApi;
	readonly webhooks: WebhookApi;

	readonly portal?: PortalApi;
	readonly discounts?: DiscountApi;
	readonly usage?: UsageApi;
	readonly meters?: MeterApi;

	/** The configured HTTP client, for what the contract does not model. */
	readonly native: unknown;
}
```

A route reads it from the context; a job imports the instance directly:

```ts
// a controller
let checkout = await context.billing.checkouts.create({ product: "pro", customer, returnTo });
if (isFailure(checkout)) return serverError();
return redirect(checkout.value.url, { status: redirect.Status.SeeOther });
```

```ts
// app/jobs/report-usage.ts — no request, no context
import { polar } from "~/app/lib/billing";

export default createJob(async () => {
	let result = await polar.usage.ingest(events);
	if (isFailure(result)) log.error("billing.ingest_failed", { code: result.error.code });
});
```

Checkout and portal hand back a **URL, not a `Response`**, which is what makes them callable from a job or a test as easily as from a handler, and it keeps the redirect where the division of labour puts it — in the route. It is also what the apps already do today.

Grouping the resources keeps them discoverable without a flat client of 26 methods; PayKit's flat 21-method interface is the counter-example, where adding one method breaks all 17 of its providers.

Seven groups are required, because all three platforms have them: `customers`, `catalog`, `checkouts`, `subscriptions`, `entitlements`, `orders`, and `webhooks`. Four are optional. `meters` was optional from the first draft because a feature was already waiting on it; `portal`, `discounts`, and `usage` became optional when Mercado Pago was written, since it has no payer-facing hosted portal, no merchant coupon API, and no metering endpoint of any kind. Three whole groups absent from one platform is what the optional-property seam in §5 is for, and the first draft's guess at which groups were universal was wrong on three of the ten it declared required.

Refunds, license keys, downloadable files, custom fields, metrics, and webhook-endpoint management are all things Polar can do and nothing here needs, so they are absent entirely. A group is added when an app reaches for one — a group added on spec is surface nobody exercises, which is how a shared package stops being the thing you read to understand billing.

### 5. Capabilities Are Optional Properties

```ts
import { supports } from "@pkg/billing";

if (!supports(billing, "meters")) return notFound();
let usage = await billing.meters.quantities({ meter: "pings", customer });
```

`supports()` narrows through `Required<Pick<Billing, K>>`, so the optional property is non-optional inside the branch. The optional property is both the declaration and the implementation, which is why it cannot disagree with itself the way Omnipay's `supportsRefund()` and Rails' twenty `supports_*?` predicates can. Medusa added account holders and saved payment methods across three minor versions without breaking a single existing provider on exactly this mechanism.

Mercado Pago is what proves the mechanism carries its weight. It declares `customers`, `catalog`, `checkouts`, `subscriptions`, `entitlements`, `orders`, and `webhooks`, and omits `portal`, `discounts`, `usage`, and `meters` — four absent properties instead of four throwing stubs, and a page rendering meter usage does not typecheck against it.

Granularity matters, and the survey is a warning here. Coarse capability groups work — that is Medusa's mechanism, and it survived three minor versions of additions. Fine-grained per-operation matrices rot: ActiveMerchant's hand-maintained feature matrix covers about fifty gateways against two hundred and fifty implementations and was last edited years ago, and none of the commercial engines that support dozens of providers ships a machine-readable capability matrix at all. So capabilities stay at the group level, and a difference finer than a group is expressed as an `unsupported` failure from a real method rather than as another flag.

A capability gap is never a silent no-op and never a missing method. It is an absent property, checked by the compiler.

### 6. Models Are Ours, And The Mapping Is Enforced

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

Normalized vocabularies are parsed at the provider boundary with `remix/data-schema`, not declared and hoped for. A platform status the provider cannot map is a mapping failure the conformance suite catches, because Pay's dead `STATUSES` constant is what happens otherwise: the vocabulary exists, nothing enforces it, and a predicate and a scope end up disagreeing about the same row.

The provider's own status is kept beside ours rather than replaced by it. Three of these systems landed on the same rule independently — Kill Bill keeps a plugin status enum deliberately distinct from its core one, Lago keeps a raw provider status beside a normalized one, and Metronome keeps the provider's status in a separate sub-object with a published event-to-enum table. Collapsing the two is the classic bug in this class of design: the moment they merge, an unmapped provider state has nowhere to live.

A provider's mapping is declared as data, not written as a function — three sets naming which platform statuses mean processing, succeeded, and failed. It is the cheapest normalization mechanism found in the survey, and it makes a new platform status a visible omission rather than a silent fall-through.

Derived state is computed from our own fields rather than delegated to a vendor enum. Cashier's `canceled()` reading local `ends_at` is portable; its `active()` branching on `StripeSubscription::STATUS_*` is not.

### 7. Every Model Carries Its Provider Payload

`providerData` is the escape hatch, and it is deliberate rather than apologetic. Nine independent projects arrived at the same invention, and the ADR is not going to be the tenth to discover it late.

Four rules, three taken from the prior art's mistakes and one from our own:

- The package never reads it. It is stored, returned, and otherwise untouched.
- It never holds anything sensitive. Medusa's `data` is publicly reachable from its storefront, and that footgun is worth avoiding by policy rather than by review.
- **It is an allow-list, not a passthrough.** Every mapper assembles `providerData` from named fields and redacts anything that authorizes acting. Writing three providers showed the rule above does not enforce itself: the obvious implementation is spreading the response body, and that alone leaks a Stripe customer's `address`, `phone`, and `shipping`, and a Polar checkout's `client_secret`, into a bag the previous rule says is safe to log and hand to a view. The raw payload still has a home — `raw` on an event (§17) and the projection column in §23 — but those are places an app opts into, not a field on every model.
- `native` on the provider is the other half: the configured vendor client for operations the contract does not model. Reaching for it is expected, not a failure — the review's estimate is that a fifth to a third of real billing code stays provider-specific, and Cashier, Pay, and PayKit all ship this door.

An escape-hatch call site is not portable, and that is visible in the code rather than discovered during a migration.

### 8. Money Is Minor Units, Converted Inside The Provider

```ts
export interface Money {
	/** Minor units, always an integer: 500 is five dollars, 500 is also five hundred yen. */
	amount: number;
	currency: Currency;
}
```

PayKit is the cautionary case: a unified `amount: number` whose unit silently depends on the provider, no conversion anywhere, and a `amountToCentsMultiplier` knob in its framework adapter admitting the field was never unified.

So every amount crossing the contract is minor units, and a provider whose platform speaks something else converts on both edges. Mercado Pago is that platform — its amounts are major units, so its mapper divides on the way out and multiplies on the way in — which is the concern that earned this section, now with a real case behind it.

The first draft also had the provider declare its convention as a `currencyUnit: "minor" | "major"` field. That field is deleted. Nothing ever read it, because conversion is the provider's own business and the declaration told a caller something it must never act on; a declared-but-unread constant is the exact failure §6 warns about with Pay's dead `STATUSES`. The conformance suite carries the guarantee instead: it round-trips an amount in a zero-decimal currency, so a provider that assumes cents fails a spec rather than a production charge.

Minor units are not universally two decimals. JPY and CLP have none; BHD and KWD have three. Precision is derived from the currency table rather than assumed.

Usage costs stay a decimal string, because per-unit infrastructure costs fall below `1e-6`, where JavaScript switches to exponential notation and Polar's parser rejects the value:

```ts
export interface Cost {
	/** Minor units as a plain decimal string, e.g. `"0.003476700"`. */
	amount: string;
	currency: Currency;
}
```

### 9. Every Method Returns A Result

```ts
export type BillingErrorCode =
	| "not_found"
	| "invalid_request"
	| "unauthenticated"
	| "forbidden"
	| "conflict"
	| "rate_limited"
	/** The platform cannot do this at all. */
	| "unsupported"
	/** This provider has not implemented it yet. */
	| "not_implemented"
	/** The platform answered 2xx in a shape we cannot map. */
	| "invalid_response"
	/** A timeout or 5xx: the operation may or may not have taken effect. */
	| "unknown";

export class BillingError extends Error {
	readonly code: BillingErrorCode;
	readonly connection: string;
	/** The platform's own code, for logs and support tickets. */
	readonly providerCode: string | null;
	/** Never `true` for `unknown`. */
	readonly retryable: boolean;
	/** Seconds to wait, from the platform's `Retry-After`, when it sent one. */
	readonly retryAfter: number | null;
}
```

Every method returns `Promise<Result<T, BillingError>>`, matching `@pkg/mail` (ADR-018) and the rest of the repo:

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

Remix v3 itself has no `Result` type — `remix/data-table` returns `null` from `find` and throws from `update`. Diverging from the framework here is deliberate: billing failures are the kind a caller must handle rather than propagate, a cron job branches on `retryable` instead of catching, and `@pkg/result` is already the repo's convention with a sibling package (`@pkg/mail`) doing the same thing at the same layer. One convention across the repo beats matching the framework on this one point.

This replaces three conventions with one — today most methods throw `PolarError`, two return `boolean`, and one returns a `Result` — and `providerCode` survives into the log, because the postmortem literature is unanimous that raw platform context is what a 2 AM incident needs.

The `unknown` code is the correctness-critical part. Kill Bill separates "the gateway rejected it" from "a timeout or 500, where nobody knows whether it took effect", and Hyperswitch handles 4xx and 5xx through separate paths for the same reason. Under hosted checkout we never move money ourselves, so the risk is not a double charge — it is a duplicate customer or a double-counted usage event. That still earns a distinct code, because recovery is reconciliation rather than a retry, and `retryable` is never `true` for it.

An `unknown` that cannot be resolved is only a nicer label for a lost write, so two obligations come with it. Every mutating call carries an idempotency key derived from our own row id, and every call writes our own correlation id into the platform's metadata. That is what makes recovery possible: Kill Bill's reconciler resolves an undefined transaction by searching the platform for its own correlation id — one match adopts the platform's answer, no match marks the attempt cancelled, and more than one is escalated to a human rather than guessed. Lago does the same with an idempotency key of `payment-<id>` and its own ids in Stripe metadata.

Providers are consequently required to implement a read-back for anything they mutate, and that read-back is the only path the reconciliation job uses.

The vocabulary changed while the providers were written, in three ways worth recording.

`invalid_response` is new, because a response we cannot parse is not an unknown outcome. A failed read did not maybe-take-effect, so answering `unknown` would send a caller into reconciliation over what is really a mapping bug of ours. A provider whose schema rejects a 2xx body answers `invalid_response` and the caller knows the platform is fine and we are not.

`unavailable` is deleted, because no provider ever emitted it. Every 5xx and every timeout is `unknown` by the rule above, so a code meaning "the platform is down and definitely did nothing" cannot be honestly derived from the wire — it was a declared-but-unreachable value, the same failure `currencyUnit` was deleted for in §8.

`retryAfter` is new, because `retryable` alone is not actionable. A `429` carries `Retry-After` on all three platforms, and a job branching on `retryable` otherwise invents a backoff while the platform is telling it the answer.

### 10. Customers Are Referenced By Either Id, As A Union

```ts
export type CustomerRef = { id: string } | { externalId: string };
```

The current package takes two optional fields and throws when both are missing. As a union, "one of the two" is a type error. The `externalId` arm answers a real failure: Pay's deepest reported bug is that it treats the provider's customer as the canonical identifier, so a customer who edits their email in a hosted checkout gets a second provider-side record and their subscription silently stops syncing.

That arm is weaker than the first draft claimed, and the providers are what showed it. Only Polar stores an `external_id` of ours with a uniqueness constraint behind it. Stripe has no such field, so the arm is implemented over `metadata` plus a search index that is eventually consistent and enforces no uniqueness, which makes a `conflict` there a search-then-write race rather than an atomic guarantee. Mercado Pago stores no identifier of ours at all and can only search customers by email, so its provider answers `unsupported` for the `externalId` arm outright — and Mercado Pago is precisely the kind of platform where an edited email creates the second record Pay suffers from.

So `externalId` is a convenience where the platform supports it, not the resolution mechanism. What an app resolves from is its own `billing_customers` row (§23), which holds the provider's id per connection and does not depend on the platform indexing anything of ours.

### 11. The Catalog Is Addressed By Our Slugs, And Lives In The Platform Where There Is One

```ts
let checkout = await billing.checkouts.create({ product: "pro", customer: { externalId: userId } });
```

Providers are configured with a slug-to-product map, and no platform product id appears at a call site. Products and prices are read-only in the contract: creating them is a dashboard task, and a write path nobody uses is a write path nobody tests.

This resolves the difference that split better-auth's two plugins — a Stripe plan is defined in your code, a Polar product is defined in Polar — by choosing the side that both providers can honour. Every entitlement product surveyed independently addresses features and meters by developer-defined slugs.

The slug half holds everywhere. The "lives in the platform" half does not, and the first draft stated it too strongly. Recurring plans are a platform resource on all three — Polar products, Stripe prices, Mercado Pago preapproval plans — but Mercado Pago has no product, price, or catalog resource for one-off items whatsoever: its checkout takes inline items whose ids are free text keying into nothing stored. So `catalog.get()` there is answered from the provider's own configuration, in zero requests, and the group stays required because the answer is still true and still addressed by our slug.

The consequence is worth stating plainly, since it lands on whoever operates such a platform: a one-off price change is a deployment rather than a dashboard edit. Where the platform has a catalog, prices stay editable without shipping code; where it does not, the configured map is the catalog.

### 12. Subscriptions Are Created By Checkout, Never Directly

`SubscriptionApi` has no `create`. A subscription comes into existence when a checkout completes, and the app learns about it from a webhook.

This is the design's most direct debt to the prior art. Polar, Paddle, Paddle Classic, and Lemon Squeezy cannot create a subscription by API; Stripe can. Pay preserved a uniform `subscribe()` by making it an empty method on three of six providers. Cashier let the two packages diverge instead: its Stripe `newSubscription()` returns a persisted subscription synchronously, while its Paddle `subscribe()` returns a checkout object and the subscription materializes later from a webhook — same parallel naming, different kind of return value, reversed argument order.

The divergence is in timing, not naming, so a uniform synchronous creation method is a lie on one provider. Modelling every subscription as webhook-eventual is true on all three: Mercado Pago's by-API path needs card data, which §2 puts out of scope, so its subscriptions also start as a redirect and land as a notification. It is also what the apps already do — `apps/uptime` keeps a D1 projection written by its webhook precisely because of this.

### 13. Plan Changes Happen In The Hosted Portal, Cancellation Is A Method

```ts
await billing.subscriptions.cancel({ id: subscriptionId }, { atPeriodEnd: true });
```

There is no `subscriptions.change()`. Upgrades, downgrades, and payment-method updates are a redirect to the portal link, which is what the apps already do. Cancellation is the exception, and it became one when `portal` turned optional (§4): "cancel in the portal" is no answer on a platform that has no portal, and Mercado Pago is exactly that platform. Cancellation is also the one lifecycle write all three platforms genuinely support, so it earns a contract method rather than a hosted link.

`atPeriodEnd` is where they differ, and the difference is expressed rather than hidden, per §5's rule that a distinction finer than a group is an `unsupported` failure from a real method. Polar and Stripe can both schedule a cancellation for the end of the period; Mercado Pago only cancels immediately, so its provider answers `unsupported` to `atPeriodEnd: true` instead of silently cancelling now and losing the customer the rest of a paid period.

That is a deliberate omission, not a gap. Proration is where a shared plan-change method would have to lie: Polar has four proration behaviours and Stripe three, Stripe's "no proration at all" has no Polar equivalent, and Polar silently promotes a deferred proration to an immediate charge when the billing interval changes. Modelling it means picking a lowest common denominator or passing through a field that means different things per platform. Letting each platform's own portal own it costs nothing today.

If an app ever needs a programmatic plan change, the method takes the caller's intent — charge now, defer to the next invoice, or apply at the next cycle — and the provider maps it. It gets written when something needs it.

### 14. Apps Read Their Own Tables; The Package Supplies Events And A Snapshot

The read path on a request is the app's own projection, never a call to the platform. Webhooks tell an app when to sync, and one snapshot call is what the sync reads:

```ts
let state = await billing.entitlements.of({ externalId: userId });
// write it to our own tables; requests read those
```

`entitlements.of()` returns one object: active products, feature flags, meter balances, and subscription status. It is a required group because it is the sync primitive — one call answering "what does this customer have right now", which every platform can serve and none expresses the same way.

Keeping the platform off the request path is not a performance nicety. One app already projects subscription state into D1 because asking Polar per request meant an outage stopped monitoring, and the survey is unanimous that a webhook is a hint that something changed rather than the new state: payloads arrive out of order, get replayed, and can carry an older API version's shape. So an app that receives an event re-reads the snapshot and writes what it says, rather than applying the payload as a diff.

A periodic repair calling the same snapshot is part of adopting the package, because missed deliveries are normal.

This is the seam the prior-art survey predicted would travel, and it is the one part of the contract that is now demonstrated rather than argued. `EntitlementState` came out of all three platforms with no distortion, despite each of them producing it differently:

| Platform     | How the snapshot is produced                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Polar        | One customer-state endpoint returning active subscriptions, granted benefits, and meter balances        |
| Stripe       | Active entitlements, whose feature `lookup_key` is already our feature slug, plus the subscription read |
| Mercado Pago | Composed from three reads, since no endpoint answers "what does this customer have"                     |

Stripe's `lookup_key` matching our slug exactly is the detail worth keeping: the field the contract needed was already the field the platform had, which is the check §11's slug addressing was designed to pass. The only fact that comes out thinner is meter balances, which are empty on a platform with no metering — an absent fact rather than a distorted one, and visible as an absent `meters` group.

It is also the cheapest group to implement where the platform ships it: Polar's endpoint comes with a `customer.state_changed` event that fires when any of it moves, so the provider maps one call and the sync has one trigger.

### 15. What The Contract Deliberately Omits

Disputes, chargebacks, payouts, and tax reporting are outside this package, and not because they are unimportant. Under merchant of record they belong to the provider: Polar emits no dispute event and no payment-method event at all, because it is the party that fights the chargeback and holds the card. A `disputes` capability group would therefore have no Polar implementation and no Polar data to model, and a dispute reaches us as a line item on a payout statement rather than as something to handle.

The rule generalizes: where merchant of record removes a whole subsystem, that subsystem stays out of the contract rather than becoming a capability nobody implements. This is also why the seller of record is a property of the deployment worth stating plainly in each app's configuration rather than hiding behind the provider — it changes who the customer's counterparty is, not just which API gets called.

Mercado Pago makes that concrete rather than hypothetical. It is a payment service provider, not a merchant of record, so an app billing through it is itself the seller of record and owns tax registration, invoicing obligations, and remittance in every jurisdiction it sells into. The contract is the same on both, which is the point — but the omissions in this section are only free under merchant of record. On a PSP, disputes and payouts and tax still exist; they are the app's problem, handled outside this package, and choosing that provider is choosing that work.

### 16. Lists Return Pages

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

Keeping `cursor` an opaque string a caller only passes back is the decision the implementation vindicated hardest. Within Stripe alone the value behind it is three different things: an object id for `starting_after` collections, an opaque token for search, and a slug for feature lookups. On Mercado Pago it encodes an offset, because its collections page by `offset` and `limit`. Four cursor semantics across three platforms, one type, and no caller that has to know which one it holds.

One property does not survive, and callers need to know it: **a page can hold fewer items than `limit` without being the last page.** Where a filter cannot be expressed in the platform's query — a Mercado Pago collection filtered on a field its search does not index — the provider filters what it fetched, so a short page is normal. Stopping on `items.length < limit` is wrong; the only end-of-list signal is `cursor === null`, which is what `paginate()` uses.

### 17. Webhooks Are A Class Over Three Provider Questions

The app should write handlers, not plumbing, so the package ships the endpoint as a class:

```ts
// app/http/controllers/webhooks/billing.ts
import { BillingWebhook } from "@pkg/billing";

import { polar } from "~/app/lib/billing";

export default new BillingWebhook(polar, {
	async "order.paid"(event, context) {
		await grantAccess(event.order);
	},
	async "subscription.activated"(event, context) {
		await syncTeam(event.subscription);
	},
});
```

A class for the same reason the provider is one: it is constructed at module scope, it can be subclassed by an app that needs to override one step, and it is a type a test can construct directly and drive with a fabricated delivery.

The instance owns everything that is identical in all five apps and is currently written five times: verify the signature, fail closed with `401`, deduplicate by delivery id, persist the delivery, dispatch to the handler, and acknowledge anything unhandled with `200` rather than dropping it. That last part matters — PayKit discards unregistered events with no warning, and Hyperswitch makes "not supported" a first-class outcome instead.

Underneath, the provider answers three narrow questions, which is how the generic half can exist at all:

```ts
export interface WebhookApi {
	/** Is this delivery authentic? Provider-owned: the schemes differ. */
	verify(request: Request, rawBody: string): Promise<boolean>;
	/** The delivery to deduplicate on, and the object it is about. */
	reference(
		request: Request,
		rawBody: string,
	): { deliveryId: string; object: { id: string; type: string } } | null;
	/** The normalized event, or `unrecognized`. Always carries the raw payload. */
	event(rawBody: string): Promise<Result<BillingEvent, BillingError>>;
}
```

Hyperswitch and Medusa independently split webhook handling exactly this way. With `reference()` separate, deduplication and idempotency are generic package code rather than something every app forgets — and the monorepo has no webhook idempotency anywhere today.

Both of the other two questions changed shape once real providers answered them, and both were correctness bugs rather than ergonomics:

**`reference()` takes the request, and separates the delivery from the object.** It originally saw only the body and returned one id, which forced deduplication onto the object's id — so two legitimately distinct `subscription.updated` deliveries about the same subscription looked like a replay, and the second was silently dropped. The per-delivery identifier is not in the body at all on Polar: it arrives in the `webhook-id` header, which a body-only signature cannot reach. Now dedup keys on `deliveryId` and routing uses `object`. Hyperswitch's `ObjectReferenceId` models exactly this distinction, and the first draft collapsed the two after reading it.

**`event()` is async.** It was synchronous, and Mercado Pago cannot satisfy that: its notification body carries an id and a topic and no resource state whatsoever, so the event's subject has to be fetched before it can be mapped. A synchronous `event()` there could only ever answer `unrecognized`, which makes the entire normalized vocabulary unreachable on that platform — the failure mode this ADR spends §6 warning about. The second rule below ("an event is a hint, not the new state") already required a read-back, so the synchronous signature contradicted the ADR's own advice; the platform that cannot cheat is what surfaced it.

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
	| { type: "order.refunded"; order: Order }
	/** Authentic, but not modelled here. Carried through so it can be handled or logged. */
	| { type: "unrecognized"; providerType: string }
);
```

`raw` is on every event, not only the unrecognized one. PayKit's most-commented issue is a user listing eighteen Stripe events its twelve canonical types did not cover, and the resolution was to always emit the raw event alongside the mapped ones. Carrying `raw` everywhere means an incomplete canonical model is never a dead end, and a normalized handler and a platform-specific one can coexist.

Verification stays provider-owned because the schemes differ, and which package a provider reaches for follows from whether its platform speaks a standard:

| Platform     | Scheme                                                                                 | Verified with                             |
| ------------ | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| Polar        | Standard Webhooks headers, over a text secret                                          | `@pkg/webhooks` (ADR-026)                 |
| Stripe       | `Stripe-Signature` with `t=`/`v1=` parts                                               | `@pkg/crypto`'s `hmac`, `timingSafeEqual` |
| Mercado Pago | `x-signature` with `ts`/`v1` parts, over a manifest built from query and header values | `@pkg/crypto`'s `hmac`, `timingSafeEqual` |

`@pkg/webhooks` exports whole-scheme `sign` and `verify` for Standard Webhooks and nothing smaller, so a platform that _is_ Standard Webhooks goes through it and a platform with its own scheme assembles the signing string itself and calls `@pkg/crypto` directly. `@pkg/webhooks` is built on `@pkg/crypto` too, so this is the layering the repo already has rather than a new one. Either way the provider owns the scheme and no package decides for it.

The Polar provider keeps the base64 step Polar's senders apply to a text secret — handing that secret straight to a Standard Webhooks verifier keys on the wrong bytes and rejects every authentic delivery.

Signature failure is fail-closed; an unmodelled shape is fail-open as `unrecognized`.

Three rules come with it, each earned by a mistake in the prior art:

- **A checkout return is not a webhook.** `checkouts.finish()` handles the customer coming back from a hosted page; `BillingWebhook` handles the platform calling us. They stay separate call sites, because Omnipay had to deprecate its way out of merging them and django-payments still serves a browser redirect and a machine response from one function.
- **An event is a hint, not the new state.** A handler re-reads the customer snapshot rather than applying the payload as a diff, because deliveries arrive out of order, get replayed, and can carry an older API version's shape.
- **Reconciliation is not optional.** Webhooks get missed, so a periodic repair that re-reads platform state is part of adopting this package. `apps/uptime` already does this for subscriptions.

### 18. Event Payloads Are Persisted Before They Are Trusted

The route factory stores the raw delivery, keyed by the `deliveryId` from `reference()`, before dispatching it, with `valid` and `processed` recorded on that row and the object's id stored beside the key rather than as it. It gives idempotency a durable key, makes a replay cheap to detect without mistaking a second real change for one, and leaves an audit trail when a handler was wrong. This is dj-stripe's `WebhookEventTrigger` pattern, and it is the piece the monorepo is missing entirely today.

### 19. Usage Ingestion Is Generic

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

`reportMAU` and `ingestPageViews` do not come along: each was one app's meter name and metadata shape living in a shared package. Chunking at the platform's per-request limit stays inside the provider.

`usage` is an optional group (§4), because Mercado Pago has no ingestion endpoint to map. That is a genuine product constraint made visible: an app that bills on usage cannot run on a platform with no metering, and `supports(billing, "usage")` says so at compile time instead of the meter quietly reading zero.

Metered billing is also the reason no existing library can be adopted here. Two apps bill on usage, and PayKit — the only standalone TypeScript contender — has no meter, usage-record, or tiered-pricing concept anywhere in its packages or docs.

### 20. No Vendor SDK: Providers Talk To The API Over `@pkg/api-client`

`PolarBilling extends APIClient` (`@pkg/api-client`): the subclass names the origin once, adds the bearer token in `before`, and calls `get`/`post`/`patch` with paths. `@polar-sh/sdk` is dropped entirely.

The SDK is not paying for itself here. It builds roughly 700 zod schemas when it loads, costing over a megabyte of Worker bundle and tens of milliseconds of startup CPU in every isolate — and §6 already parses every response with `remix/data-schema` on the way into our own models, so the SDK's schemas validate a shape we immediately re-validate and discard. Webhook verification already bypasses it. What remains is an HTTP client, which is the one part `APIClient` already provides.

Dropping it removes work rather than adding it: the memoized lazy-import machinery in the current package exists solely to keep those schemas out of the startup path, and it disappears along with the dependency. `APIClient` goes to the global `fetch`, so provider tests intercept with MSW like any other outbound call instead of mocking a vendor module.

Bundle size is not the strongest argument, though. There is a live correctness one, found while mapping the API and confirmed while implementing the provider over the raw endpoints. The installed SDK is `0.48.1`, which predates Polar's date-versioned API, and it is already behind in ways that matter: Polar sends 41 webhook event types and the SDK's enum knows 35, and it **throws** on the six it does not — which, from a webhook endpoint, is a path to Polar disabling the endpoint for returning errors. `SubscriptionUpdate` has nine body variants against the SDK's six. The `unrecognized` arm in §17 is what makes a new event type a no-op instead of an outage, and it only works if nothing between the wire and that arm throws first.

The prior art agrees. Omnipay states it as policy — it prefers working with the HTTP API directly over depending on official gateway packages — Cashier Paddle ships no SDK dependency at all, and PayKit's twelve SDK-less providers use its own HTTP client.

What we take on is endpoint drift, pagination details, and error-shape mapping. Two things make that affordable: we already own the mapping, since the models are ours either way, so the marginal cost is HTTP plumbing only; and Polar's API is date-versioned, so a provider pins a version explicitly rather than inheriting whatever an SDK release decided. The residual risk is the undocumented edge cases a vendor SDK has absorbed over time, and the remote conformance suite in §22 — run against a real sandbox — is what surfaces those.

### 21. The Memory Provider Is A Real Provider

```ts
import { MemoryBilling } from "@pkg/billing/providers/memory";

let billing = new MemoryBilling({ catalog: { pro: { amount: 4900, currency: "usd" } } });

await billing.customers.create({ email: "jane@example.com", externalId: "u_1" });
let delivery = await billing.webhooks.emit({ type: "order.paid", order });
```

It is a full implementation that passes the same conformance suite, not a mock — Pay's `FakeProcessor` is the model, and the reason it stayed honest for six providers is that it is contract-checked by construction and doubles as the template for writing a new provider.

Pay also earns a second use from it that is worth having: a fake processor is how you give a teammate or a tester a comped account. If that is ever wanted here, Pay's two guards come with it — construction must be explicitly opted into so a form parameter cannot promote a user, and comped accounts must be excludable from revenue queries.

`FakePolarClient` in `apps/books` and the `as unknown as PolarClient` cast in `apps/r3-auth` both delete.

### 22. Conformance Specs, Local And Remote

The package ships one conformance suite (`@pkg/billing/conformance`, a Vitest suite parameterized by provider) that every provider must pass, with the required groups in one function and each optional capability in its own. ActiveStorage's shared service tests are the precedent: assert only the genuinely universal core, and leave anything backend-specific to its own file rather than conditionally skipping inside the shared suite.

That precedent was cited in the first draft and then violated in the first implementation, which is the finding worth recording. Three assertions in the required core were written on usage ingestion — the convenient way to produce billable state in a fixture — so a platform with no metering could not pass the required core at all, and Mercado Pago failed a suite that was meant to describe what every provider is. A fourth assertion, on paging, drove its pages through the same ingestion, so it was unreachable for a provider whose paging was perfectly correct: a spec asserting nothing while appearing green.

The lesson generalizes past this suite. **The shared suite may assert only what every backend genuinely has, including in its fixtures.** A capability used to arrange a test is as much a requirement as one used to assert, and anything else belongs in that capability's own file — exactly what ActiveStorage's split says, and exactly what conditional skipping inside a shared suite lets you avoid noticing.

Capability declarations are asserted in both directions: for each optional group, the suite checks that `supports()` and a real call agree — a declared group must actually work, and an undeclared one must actually be absent. Omnipay's shared `GatewayTestCase` does exactly this, and it is what stops a provider from declaring a capability it stubs. The compiler covers the call site; only a spec covers the provider.

The suite runs twice. Locally against the memory provider in CI, and remotely against a Polar sandbox organization. The remote run is the load-bearing one — a remote suite against real sandboxes is what let ActiveMerchant catch contract drift across 100+ gateways, and no amount of in-memory green proves a provider maps a real payload correctly.

Per the spec-first rule, these specs are written before each provider method.

### 23. Stored Ids Say Which Platform Issued Them

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

`connection` rather than `provider` is deliberate: it names a configured credential set, not a vendor. Five apps could sell through five different Polar organizations, and Chargebee — which routes across 63 gateways — rejects a request that names a gateway where a gateway account is required, because real merchants run several accounts per provider. A provider is therefore constructed with a connection code, and that code is what gets stored.

Every customer is created with `externalId` set to the app's own identifier where the platform stores one, which makes re-resolution on a new backend possible without a mapping table. It is not the mechanism apps rely on, because §10's arm is unsupported on at least one platform: the row above is what an app resolves from, and `externalId` is what makes the row recoverable if it is ever lost. Column renames happen per app as it adopts the package.

Where an app keeps a projection of provider state, it should keep the raw payload beside the normalized columns. Pay added that column at version 10 and describes it as making future changes easier; the apps here already project without it.

## Consequences

### Positive

- **A provider change is bounded** - one construction site per app plus secrets and a re-checkout campaign, rather than a rewrite of every call site, column, test double, and handler.
- **App code stops naming a vendor** - the vendor appears in one import and one construction site per app.
- **The unknown outcome is expressible** - a timeout on a billing call can no longer be mistaken for a refusal, which is the failure mode that double-charges.
- **Capability gaps are compile-time** - an absent property, never a throwing stub or a silent no-op.
- **The escape hatch is designed, not discovered** - `providerData` and `native` mean an unmodelled provider feature is reachable, and visibly non-portable at the call site.
- **Webhook idempotency becomes possible** - `reference()` gives the package a per-delivery dedup key, which nothing in the monorepo has today.
- **The entitlement seam is demonstrated, not argued** - `EntitlementState` composed out of all three platforms with no distortion, including Stripe's feature `lookup_key` turning out to be our feature slug already. It was the prior art's prediction; it is now a result.
- **Three providers found bugs a second one would have missed** - a body-only `reference()`, a synchronous `event()`, a `providerData` passthrough that leaked, a required group three platforms do not all have, and a conformance suite that could not be passed without metering. All of them were cheap to fix before any app depended on the contract.
- **The gap that blocked a feature closes** - meter quantities are in the contract, so `apps/uptime` can build its team-usage view.
- **Test doubles come from the package** - contract-checked by construction; no subclassing, no casting through `unknown`, no mocking a vendor module.
- **One failure convention** - `Result` everywhere, with a normalized code, `providerCode` preserved, and a `retryable` flag jobs can branch on.
- **Portability is testable** - a conformance suite, run against a real sandbox, states what a provider is.
- **The vendor SDK leaves the bundle** - roughly 700 zod schemas and over a megabyte of Worker bundle, plus the lazy-import machinery that existed only to hide them from startup.
- **Jobs and routes use the same object** - the instance is a module-scope export, so a cron job imports it directly while a route reads it from the context; two of the five current call sites are jobs.

### Negative

- **A second layer of models to maintain** - every field worth exposing must be mapped, and a mapping can lose nuance or be wrong in ways the vendor's own types could not be.
- **The wide surface is against the evidence** - every project that achieved real provider independence shrank the portable surface to roughly six operations. Three providers instead of a hundred is the reason to expect a different outcome, and the wide surface now survives three implementations, which is better evidence than the first draft had and still not proof: none of the three is carrying an app's billing yet, and the narrow Stripe provider deliberately implements less than Polar does.
- **Five apps and three schemas to migrate** - mechanical but wide, and every webhook handler must be re-verified against real deliveries.
- **Order normalization is still the weakest seam** - a paid order is one object in Polar, an invoice plus a payment intent in Stripe, and a payment in Mercado Pago. Three providers map it, and the mapping is the one that took the most judgement rather than the most code.
- **Escape-hatch usage will not be rare** - the review's estimate is a fifth to a third of real billing code stays provider-specific, so `native` will appear in app code and each use is a place a migration must revisit.
- **Switching providers is still mostly not a code problem** - merchant-of-record status, tax remittance, the product catalogue, and every active subscription are re-created rather than ported, card-data migration is a compliance process requiring the losing provider's cooperation, and payouts are held for 120 days afterwards.
- **A bug can now live in our mapping** - previously a wrong field was the vendor's.
- **On a platform with no catalog, a price change is a deployment** - Mercado Pago has no product or price resource for one-off items, so the configured slug map is the catalog and editing it ships code (§11).
- **Optional groups move a product constraint into the type system** - correct, but it means a platform choice can make an app's feature un-buildable rather than merely slower: no `usage` is no usage billing, and no `portal` is no self-service plan change.
- **A PSP provider brings back what merchant of record removed** - Mercado Pago leaves the app as seller of record, so tax registration, remittance, and disputes are the app's work, handled outside this package (§15).
- **Dropping the SDK means owning the wire** - endpoint paths, pagination, and error shapes become ours, and the undocumented edge cases a vendor SDK absorbs over time are found by the remote conformance suite rather than inherited.
- **Adoption brings work the apps do not do today** - persisting raw deliveries, deduplicating by delivery id, re-reading objects instead of trusting payloads, and a reconciliation job per app. All of it is missing now, so adopting the package surfaces a gap rather than creating one, but it is real work in Phase 4 rather than a free consequence of the refactor.

### Neutral

- **Polar stays the provider** - this changes where the dependency sits, not who processes payments.
- **`@pkg/polar` is deprecated, not rewritten in place** - it keeps working until its last consumer moves.
- **No new service-container token** - apps construct the provider in an app module and pass it where needed; the five existing `PolarClient` registrations point at the provider until each app is touched.
- **Webhook route paths and secret names keep their current names** - renaming routes would mean re-registering endpoints with the provider, and `POLAR_*` accurately names the Polar provider's inputs.
- **Subscription creation is asynchronous for everyone** - which matches what the apps already do, and is the only shape true on all three providers.
- **Two of the three providers are evidence, not deployments** - no app bills through Stripe or Mercado Pago, neither is on a path to, and Polar stays the only provider any app is expected to use.

## Implementation Plan

Phase order changed after the prior-art review: the second provider moved from last and optional to third and mandatory, because it is the only evidence the contract is provider-agnostic.

### Phase 1: Models, Contract, And Specs

**Priority:** High
**Estimated Effort:** 1 day

1. Create `packages/billing` with models, `Billing`, the resource-group interfaces, `BillingError`, `supports()`, and `paginate()`.
2. Write the conformance spec suite for the required groups, including a zero-decimal-currency case.
3. Implement `MemoryBilling` until the suite is green.

### Phase 2: Polar Provider, Parity Surface

**Priority:** High
**Estimated Effort:** 1-2 days

1. Implement every group the current 26 methods cover over `@pkg/api-client`, keeping the text-secret webhook encoding.
2. Run the conformance suite against a Polar sandbox organization.
3. Port `@pkg/polar`'s existing tests onto the provider.

### Phase 3: Prove The Seam

**Priority:** High
**Estimated Effort:** 1 day

Write the narrowest useful `StripeBilling` — customers, checkout, subscription read, entitlement snapshot, one webhook — in test mode, adopted by no app, and run the conformance suite against it. Until a second provider passes, the claim that this is a shape rather than a Polar transcription is untested, and every finding in the review says that is where these designs break. A contract revised at this point is cheap; revised in Phase 4 it is not.

This phase went further than planned, and it earned its cost. A third provider, Mercado Pago, was written alongside the narrow Stripe one, chosen because it is a payment service provider rather than a merchant of record and because it is missing whole capability groups — the two ways a platform can be unlike Polar that a Stripe provider cannot exercise, since Stripe has a superset of Polar's surface. Every contract bug recorded in this revision came from the second and third providers, and most came from the third. The corrections landed before Phase 4, which is exactly the trade this phase was ordered to buy.

### Phase 4: App Adoption

**Priority:** High
**Estimated Effort:** 1 day per app

Per app: point the app at the provider, replace call sites, delete the local test double, rename the stored columns, and re-verify a real webhook delivery. Simplest billing first: `apps/r3-auth`, `apps/auth-saas`, `apps/blog-saas`, `apps/uptime`, `apps/books`.

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

**Rejected because**: the cost Cashier accepted is duplication across packages that drift, and the benefit it bought — each package expressing its provider honestly — is mostly available here anyway through capability groups and the escape hatch. The decisive difference is that Cashier serves thousands of applications with wildly different billing models, so a lowest common denominator would have been useless to most of them; this package serves five apps with two billing models. The condition set for revisiting it — a second provider that cannot be written without distorting the contract — has now been tested twice and not met: Stripe and Mercado Pago both fit, at the cost of four groups turning optional and the contract corrections recorded above.

### 3. Own The Model, Use The Provider Only To Charge

Hold customers, plans, subscriptions, usage, and invoices in our own tables, and use the provider only to charge a stored payment method. This is Lago, Kill Bill, Chargebee, Zuora, and Recurly, and it is what most prior art converged on.

**Rejected because**: it is incompatible with merchant of record. The invoice is the tax document naming the seller, so owning the invoice model means becoming the seller and giving up the entire reason Polar is the provider. It also means owning proration, dunning, tax, credit notes, and reconciliation, which is the hardest correctness domain available.

### 4. An Entitlement Layer Only, No Rails Abstraction

Abstract only "what does this customer have right now" plus usage grants, and let every checkout, portal, and webhook call be provider-specific. This is Stigg, and it is why Stigg runs across five billing systems.

**Rejected as the whole answer, adopted as part of it**: entitlements are now a required group and the preferred read path (§14). But the apps also create checkouts, open portals, list orders, and ingest usage, and leaving those un-abstracted would leave the vendor's types in the app code, which is the problem being solved. The entitlement seam is the part that survives a provider change; it is not the part that removes `@polar-sh/sdk` from five apps.

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
- [Mercado Pago API reference](https://www.mercadopago.com/developers/en/reference) and [its webhook signature validation](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks)
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
- [ADR-019: Adapter-Based Rate Limiting Package](./ADR-019-provider-based-rate-limiting-package.md)
- [ADR-026: Standard Webhooks Parsing Package](./ADR-026-standard-webhooks-parsing-package.md)
- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-033: Wide Events As The Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md)

## Current Progress

- [x] Phase 1: Models, contract, and specs
  - [x] Models, `Billing`, resource groups, `BillingError`, `supports()`, `paginate()`
  - [x] Conformance spec suite for the required groups
  - [x] `MemoryBilling` passing it
- [x] Phase 2: Polar provider, parity surface
  - [x] Every group the 26 methods covered, over `@pkg/api-client`
  - [x] `@polar-sh/sdk` gone from the provider
- [x] Phase 3: Prove the seam
  - [x] `StripeBilling`, deliberately narrow, adopted by no app
  - [x] `MercadoPagoBilling`, a PSP rather than a merchant of record, missing four capability groups
  - [x] Contract bugs the second and third providers found, fixed and recorded in this ADR
- [ ] Phase 4: App adoption
- [ ] Phase 5: Capability build-out
- [ ] Phase 6: Remove `@pkg/polar`

## Notes

- Polar's webhook secret is an arbitrary string that its senders base64-encode before signing, so the HMAC key is the secret's UTF-8 bytes. The Polar provider must keep that conversion; a Standard Webhooks verifier given the raw secret rejects every authentic delivery.
- Usage costs stay decimal strings, not numbers. Per-unit infrastructure costs fall below `1e-6`, where JavaScript switches to exponential notation and the provider's parser rejects the value.
- Every credential option is a `Secret`, so an API token and a signing secret are configured the same way: the value, or a function resolving it. `apps/r3-auth` keeps its token in Secrets Store, which is what the resolver form exists for, and a signing secret can live there just as well. A rejected resolution must not be memoized, or one blip leaves a long-lived instance permanently unable to bill; an unreadable signing secret makes a delivery unproven rather than throwing.
- Keep vendor concepts out of the core namespace. Pay defines an unnamespaced `Pay::Payment` that is hardcoded to Stripe payment intents and setup intents, because SCA exists in only one provider's model — once the shared namespace means one vendor's concept, the abstraction has already lost. The same applies to columns: Pay's shared schema carries `stripe_account` and `application_fee_percent`.
- An abstraction that cannot survive one provider's major version bump will not survive two providers. Cashier has no upgrade path from Paddle Classic to Paddle Billing; those users stay on a forked 1.x permanently. Treat a platform's next API version as a new provider, not a change to this contract.
- There is no public account of anyone completing a provider-to-provider migration using Pay or Cashier, despite both being widely deployed for years. That absence is the honest state of the evidence for the migration story, and a reason to keep the promise in §1 narrow.
- Polar's `external_id` is unique per organization and **immutable once set**, so the value written at customer creation is permanent. Use the app's own stable subject id, never an email or a slug that can change, and never a value that encodes which product bought what.
- Polar's `polar-version` header is real and takes a date (`2026-04` is the default, `2026-10` is available), but it is declared in neither of Polar's published OpenAPI documents, so pin it deliberately and treat it as load-bearing rather than optional.
- Polar returns two different pagination envelopes — most collections carry a total count and max page, while the events collection carries a next-page flag — and two incompatible error body shapes that collide on the same `detail` key, with `422` not always meaning validation. The provider normalizes all four into `Page<T>` and `BillingError`; a caller should never see which envelope arrived.
- Polar's API is date-versioned, and Polar itself is a Stripe-settled reseller, so a provider pins the version explicitly and treats a Polar release note as it would a vendor SDK bump. Pinning is now visible in our code rather than implied by a dependency range.
- One stable object, several provider attempts, is the shape that makes retries expressible without lying to the caller: a retried payment grows a second attempt rather than becoming a new payment. Worth keeping in mind if payment attempts ever get modelled here.
- When refunds arrive in Phase 5, model partial refunds as an append-only transaction log with derived balances rather than a mutable `amountRefunded` scalar. django-payments keeps the scalar and consequently can only detect an over-refund after the fact, logging an error because raising one "would just cause inconsistencies"; django-oscar keeps `amountAllocated`/`amountDebited`/`amountRefunded` as separate running totals over a transaction log, which makes the same check a precondition.
- Fraud or manual-review state is a separate axis from payment status, not another status value. django-payments models the two independently, and a Stripe-shaped model usually collapses them.
- Do not let a method's arity or argument shape depend on a capability flag. Solidus has one `void` called with three arguments or two depending on whether the payment method supports payment profiles; that is the shape a typed contract exists to rule out.
- Recurly is the one product that credibly promises a silent gateway switch, and the reason is that it holds the card data itself as a PCI-DSS Level 1 merchant service provider. That option is not available under merchant of record, which is why the promise in §1 is narrower than theirs.
- Metronome is often cited as evidence for provider-independent billing, and it is a useful design reference, but Stripe acquired it, so treat its independence story as historical rather than as a live existence proof.
- Products, prices, and discounts are read-only in the required contract. Creating them is a dashboard task, and a write path nobody uses is a write path nobody tests.
- Mercado Pago's `/v1/payments` is frozen: it still works, but new capabilities land on its successor order-creation endpoint instead, so treat a payment read as a legacy surface and expect the successor to be the migration whoever adopts this provider inherits.
- Mercado Pago's separate sandbox checkout URL is deprecated. Test flows go through the live checkout URL with test credentials and test payer accounts, so a provider must not branch its checkout URL on an environment flag.
- Mercado Pago amounts are major units and its customer search matches on email only. The first is handled by conversion inside the provider (§8); the second is why its `externalId` reference arm is `unsupported` (§10).
