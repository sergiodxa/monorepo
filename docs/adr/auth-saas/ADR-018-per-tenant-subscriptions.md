# ADR-018: Per-Tenant Subscriptions

## Status

**Proposed** - 2026-09-18

## Background

The control plane knows which customers exist, which tenants each owns, and which hostname belongs
to which tenant. It records nothing about money, and
[ADR-002](./ADR-002-rebuild-path-and-implementation-order.md) fixes that a subscription attaches to
a tenant rather than to its owner: a customer with five tenants pays five times, because a tenant
is an isolated provider with its own object, keys and load.

`@sdxc/billing` supplies the provider side — the `Billing` contract over `customers`, `catalog`,
`checkouts`, `subscriptions`, `entitlements`, `orders` and `webhooks`, plus `portal`, `discounts`,
`usage` and `meters` on a platform that has them, which Polar does; the middleware publishing
`context.billing`; `requireEntitlement()`; and `BillingWebhook`. What it leaves open is the join
between a provider's subscription and what an app sells, and that join is this ADR, while
[ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) names what
is bought.

## Context

### One payer, many subscriptions

Polar holds one customer per payer, so five tenants under one customer are five subscriptions on
that customer. `entitlements.of(customer)` answers everything a customer holds, which is the union
across all five, so its `features` map cannot gate a tenant: a customer whose second tenant is on
Premium would carry Premium's flags while administering their first. What stays per-subscription is
the `subscriptions` array — `subscriptionId`, `productSlug`, `status`, `currentPeriodStart`,
`currentPeriodEnd`, `cancelAtPeriodEnd` — so the per-tenant answer is that array joined against the
subscription id recorded on the tenant.

### The provider stays off the request path

Every `/authorize` and `/oauth/token` reads a tenant's plan, for the DAU cap, the retention window
and whichever paid capability the request touches. A read crossing the network to a billing platform
would put a third party's availability in front of every sign-in. The platform is reached in four
places — a checkout, a portal, a delivery, a reconciliation sweep — and a request reads the D1
projection those four write.

### A lapse lands on people who are not the payer

A lapsed subscription in most products costs the payer a feature. A lapsed identity tenant would
cost every end user of that customer's product their ability to sign in: people who never chose the
plan, never saw the invoice, and have no relationship with us. Cost argues the same way: a tenant
at Pro's cap costs about $1.30 a month and one at Premium's about $5.60, against $29 and $99, so
carrying a lapsed tenant is cheaper than the support it saves.

## Decision

### The customer at the provider

One control-plane customer is one Polar customer, joined on `externalId`, created at the first
checkout with `customers.create({ email, externalId, name })` where `externalId` is the
control-plane customer id. A `conflict` is the create racing itself, resolved by re-reading with
`customers.find({ externalId })`; an address Polar already holds is adopted with
`customers.findByEmail` then `customers.update({ externalId })`. The `customers` table keeps
`provider_customer_id` and `provider_connection`, the latter holding `billing.connection`, so a row
states which credential set issued the id it carries.

### What the control plane records

| Table                 | Columns added or introduced                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `customers`           | `provider_customer_id`, `provider_connection`                                                                                   |
| `tenants`             | `plan_slug`, `subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end`, `grace_until`, `lapsed_at` |
| `tenant_addons`       | `tenant_id`, `product_slug`, `subscription_id`, `status`, `current_period_end`                                                  |
| `tenant_entitlements` | `tenant_id`, `products` (JSON slugs), `features` (JSON slug to boolean), `read_at`                                              |
| `billing_checkouts`   | `attempt_id`, `tenant_id`, `customer_id`, `product_slug`, `kind` (`base` or `addon`), `checkout_id`, `created_at`               |
| `billing_deliveries`  | `id`, `type`, `payload`, `valid`, `processed`, `received_at`                                                                    |

`tenant_entitlements` is what the middleware's `entitlements` option reads and `requireEntitlement()`
gates on; its row satisfies `EntitlementSnapshot` as written, and
[ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) needs one such
row per tenant. `billing_deliveries` is the `WebhookStore` `BillingWebhook` is built with.

### Upgrading a tenant

The tenant's billing page posts; the controller resolves the owner's `provider_customer_id`, writes
a `billing_checkouts` row with a fresh `attempt_id` so the intent is durable before anything leaves
the process, calls `checkouts.create({ product, customer: { id }, returnTo, metadata: { tenant,
attempt }, allowDiscountCodes: false, idempotencyKey: attemptId })`, and redirects `303` to
`checkout.data.url`. A failed call or a session carrying no page answers `502` and leaves the row,
so a retry reuses its `attempt_id` and Polar answers the same session. That row, not the metadata,
resolves a completed checkout to a tenant. The return route calls `checkouts.finish(checkoutId)`,
then refreshes the projection with the read the webhook performs — safe twice, being a re-read.

### The portal

`portal.create({ customer, returnTo })`, behind a `supports(billing, "portal")` check, opens Polar's
hosted page, where the payment method lives and invoices are downloaded; one customer is one portal
session however many tenants they own. Plan changes live in the dashboard instead, because a change
made in the portal names a subscription and not a tenant. A cancellation made there arrives as
`subscription.canceled`, handled as one started here, which calls
`subscriptions.cancel(subscriptionId, { atPeriodEnd: true })`.

### Keeping state in step

`POST /webhooks/billing` mounts a module-scope `BillingWebhook` over the Polar provider and the
`billing_deliveries` store. Verification is the provider's, against the exact bytes received; a
forged delivery is the one request answered `401`, and everything else is acknowledged, because an
error response is how a platform decides an endpoint is broken. Deduplication keys on the delivery
id, since one object produces many deliveries.

| Event                          | What the handler does                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `checkout.completed`           | Matches the `billing_checkouts` row, attaches `subscriptionId` to its tenant as base or add-on |
| `subscription.activated`       | Attaches when the checkout event was missed                                                    |
| `subscription.updated`         | Carries `status`, `currentPeriodEnd` and `cancelAtPeriodEnd` onto the tenant                   |
| `subscription.canceled`        | Records `cancel_at_period_end`; access runs to `currentPeriodEnd`                              |
| `subscription.revoked`         | Ends access and sets `lapsed_at`                                                               |
| `order.paid`, `order.refunded` | Clears `grace_until` on payment; reprojects either way                                         |
| `customer.updated`             | Keeps the customer's email in step                                                             |

Every handler then re-reads `entitlements.of({ id: providerCustomerId })` and rewrites
`tenant_entitlements` for each of that customer's tenants, joining the snapshot's `subscriptions`
array against the subscription ids those tenants hold. Deliveries are reordered, replayed and
occasionally dropped, so a payload is the signal that something changed and the snapshot is the
state; a scheduled job sweeps projections older than an hour through the same read.

### What the tenant object is told

The object enforces the two plan properties that live inside it, the DAU cap and the audit retention
window, through one RPC method shaped as a whole operation.
`applyEntitlements({ plan, features, dauCap, auditRetentionDays, effectiveAt })` writes the tenant's
enforcement record and prunes audit rows outside the new window in the same call, answering
`{ plan, prunedRows }`. It is called from the projection write.

### Payment failure and cancellation

Token issuance never stops for non-payment. `/authorize`, `/oauth/token`, `/userinfo` and the
discovery documents keep serving a lapsed tenant through its notice period, and every token already
issued keeps verifying.

| Stage                                      | State                                 | What the tenant has                                                                                   |
| ------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Charge fails                               | `past_due`, `grace_until` 14 days out | Everything, unchanged; dashboard banner, email at day 0, 7 and 13                                     |
| Grace ends, or a cancellation takes effect | `revoked`, `lapsed_at` set            | Authentication at the former tier's cap and retention; paid capabilities refuse administrative writes |
| 60 days after `lapsed_at`                  | Scheduled for deletion                | Export available throughout; final notice at day 45 and day 59                                        |

Paid capabilities lapse at the write rather than the read: the gate refuses configuring a new custom
domain, editing branding, changing session policy, adding an SSO connection or minting an API key.
A custom domain already serving as a tenant's issuer keeps resolving, because a token in the wild
names it as `iss` and relying parties verify against its discovery document.

## Consequences

### Positive

- A tenant is the unit of isolation, of cost and of billing at once, so what is counted, gated and
  invoiced are the same thing, and non-payment cannot lock out a customer's end users.
- Every request reads a local projection, so a billing platform outage costs new checkouts only.
- Handlers are one operation repeated, so a replayed or reordered delivery converges on the same
  state as a perfect one.

### Negative

- Five tenants are five checkouts and five invoice lines, more friction at purchase and a busier
  invoice than one seat-priced subscription; a lapsed tenant is then served free for sixty days,
  so a customer can pay one month and take two more.
- The projection can be stale between a missed delivery and the next sweep, so a customer can pay
  and wait up to an hour unless they return through the checkout route.
- Deleting a tenant at the end of the notice period destroys an OIDC issuer, the most irreversible
  operation in the product, reachable from a billing state.

### Neutral

- Plan changes live in the dashboard and payment details in the portal, so one relationship is
  managed across two surfaces, and a tenant holding add-ons is read as a list of subscriptions.

## Alternatives Considered

**One subscription per customer with tenants as seats.** One checkout, one invoice line. It prices
the second tenant at the marginal cost of a seat when it costs a whole isolated provider, and makes
every entitlement a customer-level fact no tenant can differ on. Rejected: the tenant is the unit.

**Stopping token issuance on non-payment.** The conventional lever, and the one that collects
fastest. It takes a customer's end users hostage, turning a billing dispute into an outage on a
product we did not build. Rejected.

**Gating paid capabilities at the read.** One check, wherever the capability is used. It withdraws a
custom domain that a live token names as its issuer, breaking verification for relying parties that
never had a billing relationship with us. Rejected in favour of the write.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the boundary `applyEntitlements` is shaped for
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md) — why a subscription attaches to a tenant
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the products this buys
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how a call site evaluates the projection
- [ADR-043: Billing Package With Pluggable Providers](../ADR-043-billing-package-with-pluggable-providers.md) — the contract used here
