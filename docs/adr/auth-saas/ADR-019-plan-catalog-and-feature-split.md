# ADR-019: Plan Catalog and Feature Split

## Status

**Proposed** - 2026-09-18

## Background

[ADR-018: Per-Tenant Subscriptions](./ADR-018-per-tenant-subscriptions.md) decides how a tenant
carries a subscription, how it is bought and what a lapse does. It says nothing about what is
inside a plan, and the projection it writes is a set of product slugs and feature flags, so
something has to say which slugs exist and what each grants.

This ADR is that catalog: the three base tiers and their limits, the feature set every tier
carries, what the paid tiers add, the add-ons sold per tenant on top of any tier, where it is
written down, how a slug survives a price change, and the two limit behaviours the tiers imply.

## Context

### Security is not a tier

The conventional identity price list sells a second factor: multi-factor sits a tier up or carries
a per-user surcharge, and the free tier ships a password and nothing else. That sells a weaker
product and keeps the loss — a tenant that skips the paid factor is a tenant whose compromise
becomes our incident, our support load and the platform named in the disclosure. It also charges
the customers least able to evaluate the risk, since the ones who understand it already buy it.
Phone numbers are likewise not an identifier, a factor or a delivery channel here at any price: the
verified mailbox is the ownership credential, so a code sent to a phone adds a carrier-level attack
surface and a per-message cost while covering ground TOTP and passkeys already cover.

### Cost does not draw the line either

A tenant served at Pro's cap costs about $1.30 a month against $29, and one at Premium's cap about
$5.60 against $99; a TOTP verification is arithmetic and a passkey ceremony is one signature check,
both inside a request the tenant object already serves. So no capability here is priced because it
is expensive to run. The split is drawn on who is buying and why, and the cost model exists for
lifetime-value visibility and for spotting abuse rather than to protect a margin under no threat.

### What a person needs and what an organization buys

A person signing in needs the sign-in to work and to be hard to steal; nobody signing in has ever
wanted SCIM provisioning, an organizations model or a signed webhook delivery. Those are bought by
a business for how the business runs: a procurement checklist, an HR system that deprovisions, a
security team that wants events in its own SIEM. They also carry operating work that scales with
adoption rather than with sign-ins — a connection configured per identity provider, a sync
reconciled, a delivery retried. That is the line the add-ons follow.

## Decision

### The base tiers

Every tenant carries one base subscription, priced per tenant per month.

| Tier | Price | DAU cap | Audit retention |
| --- | --- | --- | --- |
| Free | $0 | 100 | 7 days |
| Pro | $29 | 2,500 | 30 days |
| Premium | $99 | 10,000 | 90 days |

A DAU is a distinct subject that completes at least one authentication — a session created or a
token issued — within a UTC day, counted per tenant, and
[ADR-022: Daily Active User Metering and Quotas](./ADR-022-daily-active-user-metering-and-quotas.md)
owns the counting.

### What Free includes

Free is a complete, standards-correct identity provider, carrying the OIDC and OAuth2 core,
discovery and userinfo, clients and client secrets, consent and scopes, sessions, password
credentials, passkeys, magic-link sign-in, TOTP second factor with recovery codes, social identity
providers, account linking, attack protection and rate limiting, the management API, subject import
and export, the audit log at the retention above, and the basic roles of owner, admin and member.
Every factor is in that list: a tenant on Free can require a passkey, require TOTP, run under
attack protection, and export every subject it holds.

### What the paid tiers add

Pro and Premium both carry `custom_domain`, `session_policy` and `unbranded_pages`, which drops the
platform's name from the hosted pages. Premium adds `branding` — the logo, palette, radius,
typeface, stylesheet and per-screen copy of the brand record — and raises the DAU cap and the
retention window per the table above. Placement stays out of the catalog: a tenant object is created
with a suggested region and holds it for life, so a tier selling placement would promise a hint the
platform fixes at creation and no upgrade moves. What the paid tiers add is presentation and policy,
and none of it changes how strong an authentication is, which is exactly why they are the paid ones.

### The add-ons

Bought individually, per tenant, on top of any tier including Free. Each is its own subscription on
the same billing customer, attached to the same tenant.

| Add-on | Price | Feature slug |
| --- | --- | --- |
| Enterprise SSO connections | $49 (5 connections, then $10 each) | `sso_connections` |
| SCIM provisioning | $29 | `scim` |
| Organizations | $29 | `organizations` |
| Custom roles and permissions | $19 | `custom_roles` |
| Outbound webhooks | $19 | `outbound_webhooks` |
| Machine-to-machine access and API keys | $29 | `machine_access` |
| Device authorization grant | $9 | `device_grant` |
| Audit streaming and export | $29 | `audit_streaming` |

No add-on is a prerequisite for a safe provider, which is what makes the split defensible: a Free
tenant with none of them runs full OIDC with passkeys, TOTP and attack protection. SSO connections
beyond the first five are metered rather than bought as quantity, because the contract carries
`usage.ingest` and no subscription-update write.

### Where the catalog lives

`app/services/billing/catalog.ts` holds `PLANS`, keyed by plan slug and carrying the display name,
price, DAU cap, audit retention days and feature slugs, and `ADDONS`, keyed by add-on slug and
carrying the display name, price and the one feature slug it grants. The same module constructs the
provider with `products` mapping every plan and add-on slug to its Polar product id, `features`
mapping every feature slug to its Polar benefit id, and `meters` mapping `auth.dau` and
`sso_connections` to their meter ids, read from bindings per environment since sandbox and
production share no ids. Slugs are the whole vocabulary above the provider: a checkout opens on
`"pro"` and a subscription read answers `productSlug: "pro"`. `PLANS` and `ADDONS` decide what a
slug grants, because an entitlement is scoped to one tenant while Polar grants benefits per
customer; the benefit map stays configured so a reconciliation compares the two, and a divergence
is logged as a catalog bug.

### Slugs outlive their prices

A slug is permanent once anything has been sold under it. A price change creates a new price on the
same Polar product, leaving the slug and its feature set where they are, and existing subscriptions
renew at the price they hold; a repositioning changes a display name in `PLANS`. When a plan is
replaced, a new slug is added and the old one stays in `PLANS` and in `products` with its feature
set intact, closed to new checkouts. Entries are added and closed, never removed, because removing
one rewrites history: a list skips a row naming an unconfigured product and logs
`billing.skipped_row` while `find` fails outright, so a subscription sold under a dropped slug stops
projecting and its tenant loses what it pays for.

### Overage above a paid cap

Pro and Premium bill $10 per started 1,000 DAU above the tier cap, measured once per billing period
from that period's highest single-day DAU: a Pro tenant whose busiest day reached 3,400 is 900 over
the cap, which is one block and $10 for the period. It is reported through `usage.ingest` on the
`auth.dau` meter, one event per tenant per UTC day with an `externalId` of the tenant and the day so a
resend counts once, and Polar prices the meter;
[ADR-025: Usage Reporting for Lifetime Value](./ADR-025-usage-reporting-for-lifetime-value.md) owns
that job.

### The Free hard cap

Free has no overage. The 101st distinct subject in a UTC day is refused a new session; sessions
already open and their refresh tokens keep working, so nobody signed in is turned out, and the
tenant's owner and admins reach the dashboard regardless. The refusal is an authorization-endpoint
error, a dashboard banner and one email a day to the owner, and it clears at 00:00 UTC or as soon
as an upgrade's projection is written. A ceiling is what makes Free safe to offer with every
security feature in it: there is no invoice to collect against, so the limit has to hold, and it
sits where a real free tenant does not reach it while an abusive one reaches it on its first day.

## Consequences

### Positive

- Every tenant can be configured as securely as every other, so no breach traces back to a paywall
  we put in front of a factor.
- One module holds the price, the cap, the retention and the feature set, so the number a page
  renders and the number a gate enforces are the same number.
- An add-on buys one capability without a tier jump, so a small team needing SCIM pays $29, and a
  slug's fixed meaning leaves a repriced plan projecting exactly the features it did before.

### Negative

- Giving away every factor removes the upsell most competitors lead with, so revenue rests entirely
  on caps, three Pro features and eight add-ons.
- Eight add-ons are eight products to keep in step between Polar and `ADDONS`, and a pricing page
  with three tiers and eight checkboxes is harder to read than three columns. Overage measured from
  the period's peak also undercharges a tenant that sits above its cap every day.
- A Free tenant at its cap experiences it as sign-in failures for its end users, which is the harm
  the lapse policy otherwise avoids; it is accepted because the ceiling is disclosed up front.

### Neutral

- Two descriptions of entitlement exist, the local tables and Polar's benefit grants; the local one
  decides and the remote one is what a reconciliation compares against. Feature slugs are also the
  vocabulary of the entitlement flags, so a new capability adds its slug in one place.

## Alternatives Considered

**Selling multi-factor as a security tier.** The industry norm and the highest-margin line on a
competitor's price list. It ships a weak default, charges to fix it, and leaves us holding the
incident when a tenant declines. Rejected at any price.

**SMS one-time codes as a paid factor.** Conventional and the usual content of a security upsell.
Phone numbers are not an identifier, a factor or a delivery channel here: the verified mailbox is
the ownership credential, so a code to a phone buys a carrier-level attack surface and a
per-message cost while duplicating TOTP and passkeys. Rejected.

**Summing each day's excess for overage.** More accurate over a month. One launch or one marketing
email becomes a bill the customer did not plan for, which is how a cap becomes a reason to leave.
Rejected in favour of the period's peak.

## References

- [ADR-018: Per-Tenant Subscriptions](./ADR-018-per-tenant-subscriptions.md) — the mechanism this catalog is sold through
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how a feature slug is evaluated
- [ADR-022: Daily Active User Metering and Quotas](./ADR-022-daily-active-user-metering-and-quotas.md) — the DAU count and the cap enforcement
- [ADR-025: Usage Reporting for Lifetime Value](./ADR-025-usage-reporting-for-lifetime-value.md) — the job that reports overage
- [ADR-043: Billing Package With Pluggable Providers](../ADR-043-billing-package-with-pluggable-providers.md) — the provider configuration shape
