# ADR-021: Release Flags and Kill Switches

## Status

**Proposed** - 2026-09-18

## Background

Entitlements as feature flags puts one client on `ctx.flags` and gives entitlement keys a
namespace of their own; every other key falls through to the `EngineProvider` from
`@sdxc/flags-engine`. This ADR is what those other keys are.

M3 adds fifteen capabilities to a service that mints tokens for other people's users. A change
to the token endpoint that is wrong is wrong for every tenant at once, and the only lever a
deploy gives is another deploy — which takes back the whole release, including the parts that
were working, and cannot be aimed at the one tenant that found the problem. So the same client
carries a second kind of key. A rollout is a question about confidence — this code is new,
serve it to one tenant, then a tenth, then everyone. A withdrawal is a question about damage —
this capability is hurting production, stop serving it now.

## Context

### The definition set is data with an operator behind it

`WorkerKVFlagStore` keeps the whole set as one JSON value under one key, so filling a snapshot
is a single KV `get` served from the edge cache. `createEngine({ store, maxAge })` parses that
set once and resolves every later evaluation against the held snapshot, reporting `stale` once
it has aged past `maxAge`; scheduling the reload is the caller's, because a Worker has a timer
only while a request is in flight. `EngineProvider.refresh()` answers a `Result` rather than
throwing, emits `PROVIDER_CONFIGURATION_CHANGED` naming every key either snapshot answered for,
and emits `PROVIDER_STALE` once when a reload fails over an aged snapshot.

### A flag that outlives its rollout is a branch nobody reads

Every flag is two code paths, one of them kept alive by a JSON value in another system. A year
after a rollout finished, the losing path still compiles, still has tests, and still runs for
whichever tenant an old rule happens to match. The rule that removes flags is part of the
design rather than a habit, and it is written down below.

## Decision

### Two namespaces, one shape

| Key                | Meaning                         | Default | Lifetime            |
| ------------------ | ------------------------------- | ------- | ------------------- |
| `release.<slug>`   | Serve the new path              | `false` | Until fully rolled  |
| `kill.<slug>`      | Withdraw the capability now     | `false` | As long as it ships |

Both are `flag.boolean` handles in the catalog module the entitlement handles live in, and both
default to the state production was in before anyone touched a flag, so a store that cannot be
read leaves the deployed behaviour standing. A rollout that has reached everyone is then a flag
whose only remaining job is to be deleted, which is what makes the lifecycle rule load-bearing
rather than tidy.

### Targeting

`targetingKey` is the tenant id, so a split lands every subject of a tenant on one arm and a
rollout reads as "these tenants are on the new path"; one that varies per end user names `by`
on its split. Rules are tried in order, so overrides sit above the split:

```json
"release.token-exchange-v2": {
	"variants": { "on": true, "off": false },
	"defaultVariant": "off",
	"metadata": { "owner": "identity", "expiresAt": "2026-12-01" },
	"targeting": [
		{ "when": { "op": "segment", "name": "internal" }, "serve": "on" },
		{ "when": { "op": "always" }, "serve": { "weights": { "on": 10, "off": 90 } } }
	]
}
```

Internal tenants are a `SegmentSet` entry written once and referenced by name from every flag,
so the list of tenants seeing everything first lives in one place.

### Who edits them, and how

A dashboard route reachable only by platform staff — a control-plane role, never a tenant role.
The editor checks a draft with `FLAG_DEFINITION_SCHEMA` through `s.parseSafe`, so it refuses
exactly what the engine would, and previews it with `evaluateAll(parseFlagSet(draft), context)`
against a tenant context typed into the form, so "who would this serve" is answered before the
write. `StoredFlagSet` carries a `version`: the editor holds the one it read and the route
declines a write whose stored version has moved, so two operators editing at once resolve the
conflict rather than overwrite one another. Every accepted write appends to a control-plane
`flag_change` table — key, before, after, actor, at — because changing how a live identity
provider behaves deserves the record a deploy gets.

### How a change reaches a request

A rewritten KV value converges globally in about a minute. The engine is built with
`maxAge: "30 seconds"`, and a request finding `engine.stale` answers from the snapshot in hand
and reloads behind the response with `ctx.waitUntil(provider.refresh())`, so the worst case from
save to universal effect is under two minutes and a busy isolate converges first.
`createFlags({ handlers })` routes `PROVIDER_STALE` and `PROVIDER_ERROR` to the logger, and
`wideEventHook()` attaches the key, reason, variant and provider of every evaluation to the
invocation's wide event, so which arm a request took is on that request's own record.

### The lifecycle rule

A `release.*` definition declares `metadata` with an `owner` and an `expiresAt` no more than 90
days out. `metadata` travels onto every resolution, so an expired flag shows up on the wide
event of every request that reads it as well as in the daily job that reports overdue flags to
their owner.

Removal happens in one order, and the order is what keeps it safe: delete the losing branch and
keep the winning arm, which makes the `client.get` call disappear; delete the handle from the
catalog, which turns any call site still reading it into a build error; delete the definition
from KV. A definition removed first resolves `FLAG_NOT_FOUND` while code still reads it, which
serves the default and quietly reverses a finished rollout. `kill.*` flags carry an owner and
no expiry, because the capability they withdraw has none; they are deleted with it.

### Why an entitlement and a release are never one flag

|                              | `entitlement.*`                  | `release.*` and `kill.*`     |
| ---------------------------- | -------------------------------- | ---------------------------- |
| Derived from                 | The tenant's own subscription    | How much confidence there is |
| Changed by                   | A purchase or a lapse            | An operator                  |
| Read from                    | The projection on the tenant row | The definition set in KV     |
| Falling back to the default  | Refuses a paying tenant's write  | Leaves production as deployed|
| Lives as long as             | The capability is sold           | The rollout takes            |

One key for both would make throwing a kill switch on SSO indistinguishable from revoking what
a customer paid for, let a ten-percent rollout ration a purchased capability to a tenth of its
buyers, and leave "why can this tenant not use SCIM" with two causes behind one lookup. Kept
apart, a paid capability under rollout is gated by both, and the two lines say different things
to the reader and to the customer:

```ts
if (!(await ctx.flags.get(entitlements.sso))) return upgrade(ctx);
if (await ctx.flags.get(kills.ssoConnections)) return unavailable(ctx);
```

### RPC surface

This ADR adds no tenant-object methods. Flags resolve in the Worker, and a withdrawn capability
is one the Worker declines to ask the object to perform.

## Consequences

### Positive

- A capability misbehaving in production is withdrawn in under two minutes without a build, and
  the withdrawal can be aimed at one tenant.
- A rollout is data that can be previewed against a real tenant context before it reaches one.
- The order of removal makes a half-deleted flag a build error rather than a silent revert.
- One client, one context and one middleware serve both kinds of key, so a rollout rule targets
  a tier without extra wiring.

### Negative

- Propagation rides on KV, so the flag store's availability bounds how fast a kill switch
  reaches every isolate, and a deploy stays the lever when KV is what is down.
- Every operator holding the flag role can change how a live identity provider behaves for every
  tenant; the change table records that after the fact rather than preventing it.
- The expiry report is machinery whose purpose is to delete machinery, and it works only for as
  long as someone reads it.

### Neutral

- Evaluation writes no log lines of its own, so the record of which arm a request took is the
  invocation's wide event and nothing else.
- A paid capability under rollout is read twice per request, both times from memory.

## Alternatives Considered

**Deploy-time constants, or definitions bundled with the Worker through `InMemoryFlagStore`.**
No second store, no propagation window, definitions reviewed like code. Changing one is then a
build and a deploy, which is minutes rather than seconds, takes back a whole release, and cannot
be aimed at a tenant. Rejected as the emergency lever; the in-memory store is kept for tests,
where pinning a flag through it is how a test states the arm it exercises.

**One namespace for both kinds of key.** Fewer conventions to teach and one lookup to explain.
It makes withdrawing a broken capability and revoking a purchase the same operation, which is
the one distinction an identity platform's support answers turn on. Rejected.

**A hosted flag service.** Sub-second propagation, an audit trail and an editor without building
any of them. It puts a third party in front of an identity provider's request path and charges
per evaluation for what one KV read serves from the edge cache. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — why evaluation stays in the Worker
- [ADR-018: Per-Tenant Subscriptions](./ADR-018-per-tenant-subscriptions.md) — the subscription an entitlement key is derived from
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — the client these keys share, and the namespace they fall through
- [ADR-059: Flags Package Implementing OpenFeature](../ADR-059-flags-package-implementing-openfeature.md) — the client, catalog, hooks and middleware
- [ADR-060: Flag Evaluation Engine](../ADR-060-flag-evaluation-engine.md) — the definition format, store and provider
