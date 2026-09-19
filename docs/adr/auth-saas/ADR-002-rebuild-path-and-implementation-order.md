# ADR-002: Rebuild Path and Implementation Order

## Status

**Proposed** - 2026-09-18

## Background

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) settles where a tenant's state
lives: a Durable Object per tenant holding subjects, clients, sessions and signing keys, a D1
control plane holding the registry, and a Worker owning HTTP and rendering. It also settles
that the provider is built into `apps/auth-saas` rather than reached as a package.

That is an architecture, not a plan. It does not say which of the fifty-odd capabilities a
customer identity platform is expected to have get built, in what order, or which of them a
customer pays extra for. This ADR answers those three questions once, so that the ADRs that
follow each answer one narrow design question and can be read in any order.

The feature surface is inventoried in [features.md](./features.md), a comparison of four
identity platforms. It is the input to what follows; it is not itself a plan, because a
comparison lists what exists elsewhere rather than what is worth building here.

## Context

### The ordering constraint is monetization, not protocol

The obvious order is protocol-first: build every authentication feature, then add billing at
the end. It fails on the second feature that is not free.

Every paid capability needs a gate, and a gate needs three things that do not exist until
subscriptions do: a subscription attached to a tenant, an entitlement derived from it, and an
evaluation point a call site can reach. Building ten paid features and then retrofitting gates
means editing ten features again, in ten places, with no test that catches a missing gate —
which is the same failure mode ADR-001 rejected for tenant isolation, one layer up.

So monetization lands in the middle: after the provider can serve a real sign-in, and before
the first capability anyone pays for.

### A tenant is the unit of everything

Subscriptions attach to tenants, not customers. A customer with five tenants pays five times,
because a tenant is an isolated provider with its own object, its own keys and its own load,
and the cost of serving it does not fall when the same person owns another one.

This is decided here rather than in the billing ADR because it shapes the control-plane schema,
which is built first: a subscription is a column on the tenant, and quota is counted per
tenant object.

### What the first implementation has to include

ADR-001's design is not exercised until one request completes a full authorization code
exchange against a real tenant. That is the bar for M1, and it fixes the contents: a tenant has
to exist and be addressable, a subject has to be able to prove who they are, a session has to
survive the redirect, and a token has to be signed by a key that never left the object.

Anything not on that path — a second factor, an enterprise connection, an audit query — is not
in M1 no matter how ordinary it is, because none of it is needed to prove the architecture
works and all of it is cheaper to build once the boundary has been used in anger.

### There is nothing in production to preserve

`apps/auth-saas` exists as code and is not deployed. It has no tenants, no subjects, no issued
tokens and no customers. Every constraint that usually dominates a rebuild — a live issuer that
must keep verifying, sessions that must not drop, a migration window during which two stores
are authoritative — is absent.

That makes this a first build that happens to start with a populated directory. The existing
code is a source of parts, reused where it already says the right thing and discarded where it
does not, so the sequencing below follows dependency alone.

This freedom expires. It lasts until the first external relying party points at an issuer here,
after which a key, a `sub` and a hostname are promises to somebody outside this repository and
changing one stops being a refactor. The decisions that are cheap only before that line — id
format, claim set, issuer URL — should be made as though they were not.

## Decision

Three milestones. Each ADR below is a separate document; this one owns only the order.

### M1 — the provider serves a sign-in

Built in this order, because each step is unusable without the one before it.

| # | ADR | Why it comes here |
| --- | --- | --- |
| 003 | Control plane schema | A tenant has to exist before anything can be scoped to it |
| 004 | Tenant object schema and migrations | The object needs a schema registry before it holds a row |
| 005 | Hostname resolution and tenant domains | A request has to reach the right object |
| 006 | Subjects and identifiers | The thing being authenticated |
| 007 | Password credentials | The first way to prove a subject |
| 008 | Passkeys | The second, and the one that ships alongside rather than after |
| 009 | Sessions | Authentication has to survive the redirect to `/authorize` |
| 010 | Signing keys and token minting | Keys exist before the token endpoint needs them |
| 014 | Clients and client secrets | A relying party has to be registered to be authorized |
| 015 | Consent and scopes | The authorization endpoint branches on it |
| 011 | Authorization endpoint and PKCE | The front half of the exchange |
| 012 | Token endpoint and refresh rotation | The back half |
| 013 | Discovery and userinfo | Served from the Worker; needs the key set and the issuer |
| 016 | Hosted sign-in UI and branding | The pages the flow has been redirecting to |
| 017 | Transactional email | Verification and reset, which sign-up needs to be real |

M1 is complete when a registered client completes an authorization code exchange with PKCE
against a tenant on its own hostname, signed by that tenant's own key.

### M2 — the platform can charge

| # | ADR | Why it comes here |
| --- | --- | --- |
| 018 | Per-tenant subscriptions | Attaches a subscription to a tenant |
| 019 | Plan catalog and feature split | Names the tiers, the add-ons, and what is free |
| 020 | Entitlements as feature flags | The evaluation point every later gate reads |
| 021 | Release flags and kill switches | The other use of the same client, separated deliberately |
| 022 | Daily active user metering and quotas | The meter the tiers are sold on |
| 023 | Audit log and retention | Retention is a tier property, so it lands with the tiers |
| 024 | Cost ledger and unit economics | What a tenant costs to serve |
| 025 | Usage reporting for lifetime value | Sends both to the billing provider |

M2 is complete when a tenant can be on a paid plan, a gated capability refuses to run without
the entitlement, and a month of usage and cost has reached the billing provider.

### M3 — the capabilities customers pay for

No internal order beyond dependency: each is gated by M2 and independent of its siblings.
Sequence by demand.

- 026 TOTP second factor and recovery codes
- 027 social identity providers
- 028 enterprise SSO connections
- 029 SCIM provisioning
- 030 organizations
- 031 roles and permissions
- 032 machine-to-machine access and API keys
- 033 outbound webhooks
- 034 management API
- 035 attack protection
- 036 account linking
- 037 subject import and export
- 038 session policy configuration
- 039 device authorization grant
- 040 magic link sign-in

### Reuse of what exists

The current code is a parts bin, not a system to be kept alive. A module is reused when it
already expresses the decision an ADR here reaches, and rewritten when it was shaped by the
shared relational store or by provider logic living outside the app. Nothing is retained for
compatibility, because there is nothing to be compatible with: the schema that ships is the one
the ADRs below describe, written once, with no column saying which implementation owns a row.

### What is not built

Phone numbers are not an identifier, a delivery channel, or a second factor anywhere in this
series. The verified mailbox is the ownership credential, so a code sent to a phone adds a
carrier-level attack surface and a per-message cost without strengthening anything. TOTP and
passkeys cover the same ground with neither.

## Consequences

### Positive

- Every paid capability is gated by machinery that existed before it did, so a missing gate is
  a build error at the call site rather than a revenue leak found in production.
- M1 is small enough to prove the ADR-001 boundary before thirty features are committed to it.
- The ADRs that follow are each one decision, so they can be revised without a rewrite of the
  plan.
- A tenant is the unit of isolation, of cost and of billing at once, so quota, metering and
  invoicing all count the same thing.

### Negative

- Monetization before capability means the second milestone ships no user-visible feature, and
  that is the milestone most likely to be cut short under pressure.
- Starting from zero discards working code, and some of it will come back the same shape.
- Nothing here is validated against real traffic, so the tier limits, the claim set and the
  object's method boundaries all meet their first customer after M1.
- Fixing the price table and tier limits this early means the later ADRs inherit numbers that
  have not met a customer yet.

### Neutral

- M3 has no internal order, so its sequence is a commercial decision rather than a technical
  one, and this ADR deliberately does not make it.
- The feature inventory that seeded this list describes competitors; a capability appearing
  there is an argument for building it, never a decision to.

## Alternatives Considered

**Protocol first, billing last.** The conventional order, and the one that gets a working
product soonest. It retrofits a gate into every paid capability after the fact, across as many
files as there are features, with nothing failing when one is missed. Rejected: the cost of the
retrofit scales with the number of features and the risk is silent.

**Billing first, provider second.** Gates before the thing being gated. It front-loads the
machinery that is hardest to justify with nothing running, and it designs entitlements against
imagined capabilities rather than real ones. Rejected: M1 is what teaches the shape the
entitlements have to fit.

**One ADR for the whole roadmap.** Fewer files, one place to look. It also means every
revision to one feature's design edits a document that fourteen other features depend on, and
review of a narrow change spans the whole plan. Rejected in favour of one decision per file.

**Keeping the current provider and moving its storage underneath it.** Less code discarded, and
the protocol surface stays where it already works. It also keeps a provider designed against a
shared relational store, so every whole-operation method ADR-001 asks for has to be assembled
from calls written to be chatty, and the boundary erodes at exactly the point the architecture
depends on. Rejected: with nothing deployed, the reason to preserve that shape is sunk cost.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the architecture this sequences
- [features.md](./features.md) — the capability inventory this list was drawn from
