# ADR-020: Entitlements as Feature Flags

## Status

**Proposed** - 2026-09-18

## Background

M1 leaves a provider that signs a subject in. Per-tenant subscriptions attach a plan to a tenant
and project what it grants into the control plane, and the plan catalog names what each tier and
add-on carries. Between those and the capabilities that are sold sits the thing this ADR
supplies: the one place a call site asks whether a tenant may use one.

Fifteen paid capabilities means fifteen gates. Written one at a time, each reads a subscription
row, restates a tier comparison, and decides for itself what a lapsed subscription means. Moving
a capability into Pro then edits every site that compared against a tier, and a site that was
missed keeps charging or keeps giving away. So the question gets one shape — may this tenant use
X — the answer gets one path, `ctx.flags`, and the truth behind it gets one per-tenant row.

## Context

### A customer's entitlements are not a tenant's

`entitlements.of(customer)` answers everything a payer holds, which for a customer owning five
tenants is the union across all five. Its `features` map would hand Premium's capabilities to
the same person while they administer their Free tenant, so it is the wrong shape for a gate.

What survives per subscription is the snapshot's `subscriptions` array — `subscriptionId`,
`productSlug`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`. Joining
that array against the subscription id recorded on a tenant produces one tenant's answer, and
per-tenant subscriptions already does that join and stores the result as a `tenant_entitlements`
row: `{ tenant_id, products, features, read_at }`, which satisfies `EntitlementSnapshot` as it
stands. This ADR reads that row and never calls the billing provider.

### The gate belongs where the tenant is already resolved

Polar is a third party over the network, so an entitlement decided by calling it puts a vendor's
availability in front of every administrative action a paying tenant takes. The tenant's row is
read already to resolve a hostname to an object, so a projection read beside it is free to the
request.

### Gates land on writes, and the protocol surface has none

Per-tenant subscriptions decides that authentication never stops for a billing state: a custom
domain that a live token names as `iss` keeps resolving, and `/authorize`, `/oauth/token`,
`/userinfo` and the discovery documents keep serving. A paid capability therefore lapses at the
administrative write — configuring a domain, adding an SSO connection, editing branding, minting
an API key — which is also where every entitlement flag is evaluated.

## Decision

### One provider owns one namespace

The router middleware from `@sdxc/flags` publishes one client as `ctx.flags`, and its
`context(ctx)` callback runs once per request over the tenant already resolved:

```ts
featureFlags(flags, {
	context: (ctx) => ({
		targetingKey: ctx.tenant.id,
		plan: { tier: ctx.tenant.planSlug, status: ctx.tenant.subscriptionStatus },
		entitlement: ctx.tenant.entitlements, // the tenant_entitlements row
	}),
});
```

The default provider is `EntitlementProvider`, constructed over the `EngineProvider` from
`@sdxc/flags-engine`. A key beginning `entitlement.` is answered from `context.entitlement`;
every other key falls through to the engine, which is what makes the namespace load-bearing
rather than cosmetic. `resolveBoolean` answers `resolved(features[slug] ?? false, { variant,
flagMetadata: { readAt, plan } })`, `resolveNumber` answers the limits the plan carries, and the
other two answer `failed(defaultValue, "TYPE_MISMATCH")` in this namespace, since an entitlement
is a grant or a limit and nothing else.

### The catalog

`@sdxc/flags/catalog` declares every key once, so a call site spells none of them:

```ts
export let entitlements = defineFlags({
	sso: flag.boolean("entitlement.sso-connections", false),
	customDomain: flag.boolean("entitlement.custom-domain", false),
	dauCap: flag.number("entitlement.dau-cap", 100),
	ssoConnectionsIncluded: flag.number("entitlement.sso-connections-included", 0),
});
```

`entitlement.<slug>`, where `<slug>` is the slug the plan catalog, `tenant_entitlements.features`
and `requireEntitlement()` all use. Every boolean handle declares `false` and every numeric
handle declares the Free value, so a key with no answer denies and a limit with no answer is the
smallest one.

### Two gates at two granularities

`requireEntitlement(feature, { onDenied })` from `@sdxc/billing/middleware` admits a request only
when the projection supplied by `billing({ entitlements })` grants the named feature, and
publishes it as `context.entitlements`. That option reads the same `tenant_entitlements` row, so
it answers whether a whole administrative route exists for a tenant while `ctx.flags` answers
whether a branch inside a route everyone reaches runs. One row, two readers, one answer.

### Freshness

A webhook delivery rewrites the row and purges the tenant's KV resolution entry, so the next
request reads the new projection seconds after the purchase, and an hourly sweep repairs a
delivery that never arrived. The checkout return route makes it immediate for the buyer: it
finishes the checkout, refreshes the projection inline, then redirects, so the capability is on
before the dashboard renders.

### Degradation

The projection is read from the row the request already needed, so a billing outage reaches only
`read_at`. An aged projection is served as it stands, because the last answer Polar gave is the
last contract the customer had, and `read_at` travels on `flagMetadata` for a reader that wants
to say so.

A tenant whose row is missing entirely denies every entitlement, and that is the right direction
because of where the gates sit. Nothing on the protocol surface consults a flag, so a denial can
only refuse an administrative write, in front of an admin who is present and can retry; the cost
of a wrong grant is a capability provisioned without a subscription. Dashboard reads stay
ungated, so a customer in any billing state can see and export what their tenant is configured
with. Fail closed is therefore a decision about one class of call, because the class where
failing closed would hurt somebody who never chose the plan has no gate in it.

### RPC surface

This ADR adds no tenant-object methods. Evaluation happens in the Worker on the way to the
object, so a denied capability is one the object is never asked to perform, and the two plan
properties the object enforces for itself arrive through the `applyEntitlements` operation
per-tenant subscriptions defines.

## Consequences

### Positive

- A call site asks one question through one client, so a capability moving between tiers is a
  change to the plan catalog and to nothing that evaluates it.
- Nothing on the authentication path calls the billing provider or consults a flag, so neither
  Polar's availability nor a missing projection can reach an end user signing in.
- A misspelled key is not expressible: the catalog holds the only spelling, and carries the type
  and the denying default with it.

### Negative

- One provider answering two sources is a seam only review holds: a key that should have been in
  the namespace and is not becomes an engine lookup instead.
- The projection is a copy, so entitlements are as correct as the last delivery plus the sweep
  window, and a Polar edit outside a subscription event waits for it.
- Reading the union-shaped snapshot correctly depends on the join being right in the one place
  that writes the row; a wrong join there is wrong for every gate at once.

### Neutral

- Entitlement evaluation reads memory and touches no store, so asking the same question twice in
  a request costs nothing, and the context carries plan and status for release targeting.

## Alternatives Considered

**Targeting rules keyed on tier and add-on list.** One provider, one store, and an operator who
can grant a capability without a deploy. It also makes every entitlement a hand-written stanza in
KV that must exist before the capability works — a forgotten one denies a paying customer — and
it puts the plan catalog in a second place that drifts from what Polar sold. A KV outage would
then resolve every entitlement to its denying default for every paid tenant. Rejected: the
per-tenant row holds the answer already, and a rule restating it is a copy with its own outage.

**Evaluating the customer snapshot's `features` map directly.** It is the shape a flag wants and
it arrives from the provider needing no join. It is also the union across every tenant the payer
owns, so it grants a Free tenant whatever its Premium sibling holds. Rejected on correctness.

**Reading the subscription at each call site.** No flag layer, no namespace, nothing to learn. It
restates the tier comparison per site, spreads the lapse policy across the codebase, and fails
silently when a gate is missing. Rejected.

**`requireEntitlement()` alone.** Route-level denial is clearer when a whole route is paid for.
It cannot express a branch inside a shared route, which is most of them: a claim in a token, a
field on a form, a connection offered on the sign-in page. Kept for what it does, joined by the
flag client for the rest.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the boundary this decides on the Worker side of
- [ADR-018: Per-Tenant Subscriptions](./ADR-018-per-tenant-subscriptions.md) — writes the row this reads, and fixes that gates land on writes
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — owns the slugs this evaluates
- [ADR-059: Flags Package Implementing OpenFeature](../ADR-059-flags-package-implementing-openfeature.md) — the client, catalog and middleware used here
- [ADR-060: Flag Evaluation Engine](../ADR-060-flag-evaluation-engine.md) — what every non-entitlement key falls through to
- [ADR-021: Release Flags and Kill Switches](./ADR-021-release-flags-and-kill-switches.md) — the other use of this client
- [ADR-022: Daily Active User Metering and Quotas](./ADR-022-daily-active-user-metering-and-quotas.md) — reads `entitlement.dau-cap` through it
