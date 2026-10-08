# ADR-018: Authorization Through a Policy

## Status

**Accepted** - 2026-10-08

## Background

Every gate in the reader's own object read a boolean off the tier's row in `TIER_LIMITS`
(`limitsOf(tier).filterRules`, `.mcp`, `.emailDigests`, …). The operational switches were
flags read beside the page in the Worker, and an agent token's write scope was a string
compared in the MCP layer. Each was one `if` somewhere. Nothing let you list them, test them
as a set, or see that a switched-off feature could still be written through a path that
skipped the page. [ADR-119](../ADR-119-authz-package.md) adds `@sdxc/authz`, and this app is
one of its first consumers.

## Decision

- **Catalog** — `app/authz/abilities.ts` declares every gated ability as a claim:
  `posts.keep`, `tags.label`, `rules.write`, `rules.apply`, `articles.extract`,
  `digests.email`, `agent.connect` and `agent.write`.
- **Roles** — `app/authz/policy.ts` has one role per tier. `free` grants nothing beyond
  `everyone` (keeping posts, applying a previewed rule). `paid` grants labels, rules,
  extraction and the agent surface. `premium` inherits `paid` and adds email.
- **Bound in `UserDO`** — the object binds the policy itself, with the tier `leasedTier` derives
  from its row as the role. Grace periods and manual grants are included, and a lapse whose
  window ran out reads as `free`.
- **Switches as guards** — the switches are guards whose reason is `switched-off`. Their facts
  come from `fromFlags(features, { client: flagsFor(subject) })`, the object's own client,
  evaluated only when a check reads a switch.
- **Agent tokens** — `authorizeAgent` binds `within: ["agent:<scope>"]`. A token never does more
  than its scope nor more than its holder, and the claims it answers (`may.connect`,
  `may.write`) are what hide and refuse the writing tools.
- **Plain data over RPC** — RPC methods return codes and claims: `not-entitled` for a plan that
  does not carry the ability, `switched-off` for a guard, and `entitlement().can` with one
  boolean per ability. A raw `Decision` can carry `ExpressionError` instances, so RPC never
  returns one.
- **Numeric limits stay in `TIER_LIMITS`**, keyed by the same tier names, and a test keeps the
  two tables aligned. The unused `publicApi`, `nonFeedSources` and `ai` fields are gone, along
  with every other boolean.

Pages that only decide what to draw (the sidebar, the saved and tag lists) still read the
switches through `ctx.flags`. Every write those pages offer is refused by the object when the
switch is off.

## Consequences

- A switched-off feature is refused on every path that reaches the object: forms, agent tools
  and replayed posts. Before, only the pages checked it.
- Feature gates read the leased tier. A reader whose grace window ran out loses paid features
  immediately, rather than when the next snapshot lowers the stored tier.
- `app/authz/policy.test.ts` decides every tier × ability, every switch and the agent ceiling
  as one table.
