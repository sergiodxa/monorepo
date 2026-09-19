# ADR-022: Daily Active User Metering and Quotas

## Status

**Proposed** - 2026-09-18

## Background

The tiers are sold on one number: Free allows 100 daily active users, Pro 2,500 and Premium
10,000, with Pro and Premium billing $10 per started 1,000 above the cap. A price list naming a
meter obliges the product to produce it, exactly, per tenant, every day.

Authentication happens inside the tenant's Durable Object, which is also where the subject ids
are, so the count belongs there — and ADR-001 warns that per-object storage is finite, which
makes the size of a structure remembering who has already been seen today something to settle
before it ships. This ADR defines the meter, where it is kept, what the cap does, and the daily
row the billing and cost ADRs read.

## Context

### What an authentication is

| Event                                                  | Effect on the meter                |
| ------------------------------------------------------ | ---------------------------------- |
| A session created for a subject                        | First sight of that subject today  |
| An access token minted for a subject with no session   | First sight of that subject today  |
| A refresh rotation for a subject already counted today | Already counted                    |
| A discovery or JWKS read                               | Names no subject, so there is none |

A DAU is a distinct subject that produced at least one first sight within a UTC day, counted per
tenant. A session is created before a code is exchanged, so the token endpoint usually meets a
subject the meter has already seen.

### The meter must be cheap and exact at once

The cost model budgets a tenant at roughly 3 object row writes per DAU-day across 8 object
requests, so a meter writing a row per authentication would add most of that again for no new
information. One write per subject per day adds a third of it: 2,500 writes a day at the Pro cap
against a tenant costing about $1.30 a month to serve. The figure also has to be exact, because
a Free tenant is turned away at the hundredth subject and a Pro tenant is invoiced from its
busiest day — an estimate within two percent is an argument the customer wins.

## Decision

### The tables the object holds

```sql
CREATE TABLE dau_seen (day INTEGER, subject TEXT, PRIMARY KEY (day, subject)) WITHOUT ROWID;
CREATE TABLE dau_day (day INTEGER PRIMARY KEY, subjects INTEGER NOT NULL DEFAULT 0,
	sessions INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0,
	notices INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0);
```

`day` is `floor(epochMs / 86_400_000)`, an integer that sorts, subtracts and indexes. The cap
lives in the enforcement record `applyEntitlements` writes, so it reaches the object by a push
when a subscription changes rather than riding on every request, and a tenant whose record has
never been written enforces the Free cap.

### Distinctness without a write per request

The object instance holds a `Set<string>` of the subjects it has counted today. A repeat
authentication is a set hit and touches no storage at all; a miss runs
`INSERT INTO dau_seen … ON CONFLICT DO NOTHING`, reads `changes()`, bumps `dau_day` when the
answer is `1`, and adds the subject to the set either way.

`SqlStorage.exec` is synchronous, so the check, the insert and the bump run with no `await`
between them and therefore no interleaving point — the race ADR-001 names cannot open here. A
cold isolate pays one insert attempt per subject per lifetime rather than a bulk read of the
day's subjects, so nothing about the rebuild scales with how big the day is. The first
authentication of a new day replaces the set and prunes `dau_seen` outside the retained window,
so rollover costs one request a few deletes and an idle object costs nothing.

### What the structure costs

`dau_seen` is `WITHOUT ROWID`, so the key is the row: an 8-byte day beside a subject id, about 40
bytes at a 26-character id, and two days are retained so a late close finds its day.

| Tier    | DAU cap | `dau_seen` per day | Retained |
| ------- | ------- | ------------------ | -------- |
| Free    | 100     | ~4 KB              | ~8 KB    |
| Pro     | 2,500   | ~100 KB            | ~200 KB  |
| Premium | 10,000  | ~400 KB            | ~800 KB  |

`dau_day` is about 40 bytes a day, kept for 400 days at 16 KB, so a year of a tenant's usage
chart is answered inside the object and the meter's whole footprint stays under a megabyte at the
top tier.

### The UTC day

The boundary is the same instant for every tenant. For a customer far from UTC it falls inside
the working day, so one local day is counted as two partial UTC days, each carrying fewer
distinct subjects than the whole — which makes the cap easier to clear and the busiest-day figure
overage is priced from lower. It holds because the alternative makes the meter's arithmetic
tenant-specific: two tenants' figures stop being comparable, a charge becomes checkable only
against a timezone stored elsewhere, and the period it bills in is UTC-anchored already. The
dashboard names the meter as UTC wherever it shows a number.

### What happens at the cap

**Free is hard.** Once `dau_day.subjects` reaches the cap, an authentication by a subject already
counted today proceeds and the hundred-and-first distinct subject is refused a new session, so
the cap bounds breadth: sessions already open and their refresh tokens keep working, and the
owner and admins reach the dashboard through the control plane regardless. The refusal is an
authorization-endpoint error. It clears at the day rollover, or the moment an upgrade's
`applyEntitlements` raises the cap, since the object re-reads the record against the same day's
count.

**Pro and Premium take overage.** Nothing is refused and the day is counted as it comes. The
period's charge is derived from its highest single-day figure rather than from anything the
object holds, so the object's only job above the cap is to keep counting accurately.

A tenant that has lapsed from a paid plan keeps that plan's cap, because authentication does not
stop for a billing state; the hard cap is a property of being on Free, not of owing money.

### The warning path

The operations that create a session return the day's figure on their own result — `metering:
{ day, subjects, cap, notice }`, where `notice` is `"none"`, `"approaching"` or `"reached"` — so
the Worker learns the count without a second round trip, and `dau_day.notices` records what the
object emitted so each notice goes out once per tenant per day. `approaching` fires at 80% of the
cap as a dashboard banner and an email to the owner: on Free it offers the upgrade, on Pro and
Premium it names where overage begins and the rate. `reached` fires at the cap, as a banner and
one email a day.

### The daily close

A scheduled job runs shortly after 00:05 UTC over the tenants the control plane records as having
authenticated, calling `closeMeteringDay({ day })` on each, which answers `{ day, subjects,
sessions, tokens }`, marks the day closed, prunes `dau_seen` outside the window, and answers the
same figures on a second call, so a retried job is safe. `readUsage({ from, to })` answers the
day rows behind a tenant's usage chart from `dau_day` alone, so no subject id leaves the object.
Both are whole operations — one closes a day, the other renders a chart — rather than parts the
Worker assembles into something else.

Each closed day is written to the control-plane table `tenant_usage_day(tenant_id, day, subjects,
sessions, tokens)`, keyed on `(tenant_id, day)`. That row is the interface the cost ledger
multiplies by the rate card and the usage reporting ADR sends as the day's metered quantity, and
the period's highest single-day figure, which overage is priced from, is a read over those rows.

Pro at its cap costs about $1.30 a month to serve against $29 and Premium about $5.60 against
$99, so the meter is not protecting margin. It exists to price a tier against something real, to
make cost of goods and lifetime value legible per tenant, and to make an abusive tenant visible
on the day it starts.

## Consequences

### Positive

- A repeat authentication costs a hash lookup, so the meter adds one row write per subject per
  day and nothing after the first request, while staying exact enough for a refusal and an
  invoice to both be defensible.
- The Free cap bounds breadth, so a tenant reaching it keeps serving everyone already signed in.
- One daily row feeds the quota, the invoice, the cost ledger and the tenant's chart, so all four
  report the same number.

### Negative

- The set lives in the isolate, so an object evicted and rebuilt several times in a day pays one
  insert attempt per subject per rebuild; the count stays exact and the write count rises.
- The UTC boundary cuts through the working day for tenants far from UTC, so a local day's
  distinct subjects are split across two counted days.
- `dau_seen` is a second index over subject ids whose only defence against growth is the prune,
  and the cap reaches the object by a push, so a subscription change that never projects leaves
  yesterday's cap standing until the hourly sweep.

### Neutral

- Analytics Engine receives a point per authentication for dashboards and alerting, with its
  sampling and retention making it the observability copy while the object holds the billing
  record; a tenant that authenticates nobody holds no rows and is not closed.

## Alternatives Considered

**Counting every authentication.** No distinctness structure, no set, one counter. It bills a
tenant for its users' habits rather than its user base: a mobile client refreshing hourly
multiplies one person by twenty-four. Rejected.

**Monthly active users.** The other meter the market uses, and one that smooths a spiky week. A
month-long distinctness structure is thirty times the storage, and a cap that bites only at month
end finds a runaway tenant long after the damage. Rejected.

**A HyperLogLog sketch.** About 1.5 KB whatever the cap, so storage stops mattering. It answers
within a couple of percent, which decides whether a Free tenant is refused and which block a Pro
tenant is invoiced in. Rejected.

**Counting in the control plane, or in Analytics Engine.** One table, queryable across tenants,
no per-object growth, very cheap writes in the second case. D1 puts a write on the authentication
path into a store every tenant shares and needs the subject id to leave the object ADR-001 keeps
it inside; Analytics Engine samples. Rejected as the meter, kept as the chart.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the storage ceiling and the whole-operation rule this is sized and shaped by
- [ADR-018: Per-Tenant Subscriptions](./ADR-018-per-tenant-subscriptions.md) — `applyEntitlements`, which carries the cap into the object
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — fixes the caps, the hard cap and how overage is priced
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — where `entitlement.dau-cap` is read
- [ADR-024: Cost Ledger and Unit Economics](./ADR-024-cost-ledger-and-unit-economics.md) — multiplies the daily row by the rate card
- [ADR-025: Usage Reporting for Lifetime Value](./ADR-025-usage-reporting-for-lifetime-value.md) — ingests the daily row to the billing provider
