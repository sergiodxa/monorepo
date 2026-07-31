# ADR-009: Shard the `GeoFetchDO` Namespace Within a Region

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§6 and §17 (high). A throughput ceiling, not a cost problem — the current design is the
_cheaper_ one.

## Context

`CheckHttpJob.fetchMonitor` derives the Durable Object id from the location hint alone:

```ts
let locationHint = monitor.location_hint as DurableObjectLocationHint;
let id = env.GEO_FETCH.idFromName(monitor.location_hint);
let namespace = EU_LOCATION_HINTS.has(monitor.location_hint)
	? env.GEO_FETCH.jurisdiction("eu")
	: env.GEO_FETCH;
let stub = namespace.get(id, { locationHint });
```

`location_hint` is an enum of nine values, so **the entire platform's HTTP probing runs
through at most nine Durable Object instances**, shared across every team and every monitor.
The default is `wnam`, so in practice most traffic funnels through one object:
`idFromName("wnam")`.

This has one genuine benefit and two genuine problems.

**The benefit — duration amortisation.** DO duration is billed per object as wall-clock time
while it cannot hibernate. Concurrent requests to the same object overlap in one billed
window: four monitors probing through the same object over a 250 ms window cost 250 ms of
duration in total, not 1,000 ms. Per-ping DO duration cost therefore _falls_ as regional
density rises. This is why the current design is cheap, and why sharding is a deliberate
trade rather than a pure win.

**Problem 1 — throughput ceiling.** A single Durable Object is a single-threaded actor
serving all requests to that id. Every `wnam` monitor across every tenant queues behind it.
At the reference account's 4 checks/minute this is nothing; at 100,000 monitors on a 1-minute
interval in the default region it is ~1,667 requests/second through one object, which exceeds
what a single instance will serve. The ceiling is invisible until it is hit, and it is hit
platform-wide at once.

**Problem 2 — shared fate across tenants.** A monitored endpoint that accepts a connection
and then hangs keeps the object non-hibernatable for up to the caller's `timeout_seconds`
(default 10, and per the DO docs an active outbound connection can hold an object in memory
"for up to 15 minutes per connection"). One tenant's pathological target degrades probing for
every other tenant in that region. It also inflates the shared billed duration window, so one
tenant's hung target is charged against everyone's amortisation.

## Decision

Shard the object id within each region, keeping the location hint as the placement input:

```ts
const SHARDS_PER_REGION = 8;

let shard = shardFor(monitor.id, SHARDS_PER_REGION);
let id = env.GEO_FETCH.idFromName(`${monitor.location_hint}:${shard}`);
let stub = namespace.get(id, { locationHint });
```

`shardFor` must be **stable per monitor** — derive it from a hash of `monitor.id`, not from a
counter or `Math.random()` — so a monitor's probes consistently land on one object and its
measured response times stay comparable over time. A monitor moving between shards would
introduce a step change in its latency series for no reason the user can see.

`SHARDS_PER_REGION = 8` raises the per-region ceiling ~8× while keeping enough density per
shard that duration amortisation still works at scale. Make it a module constant, not
configuration: changing it re-hashes every monitor onto a different object, which is exactly
the step change above, so it should be a deliberate code change with a note in the changelog.

Keep the jurisdiction branch as it is — sharding is orthogonal to it. (That branch has its own
bug; see [ADR-013](./ADR-013-correct-the-durable-object-jurisdiction-mapping.md).)

### Alternative considered and rejected

**One object per monitor** (`idFromName(monitor.id)`). Maximum isolation, and the obvious
shape. Rejected on cost: it destroys amortisation completely, so every check pays its own full
billed duration window. At the typical 250 ms band that is $0.000000391 per ping versus
roughly a quarter of that at four-monitor density — and the gap widens as density rises,
exactly when it matters. It would also create one DO instance per monitor, which is a lot of
objects for no benefit the shard approach does not already deliver.

## Consequences

- **Per-region throughput ceiling rises ~8×.** The wall moves from "one object serves all
  `wnam` traffic" to eight, and the constant is trivially raisable once measured.
- **Blast radius shrinks ~8×.** A hung target degrades one shard, not a whole region.
- **DO duration cost rises**, by up to 8× in the worst case where density was previously
  perfectly shared and now is not. In absolute terms: from $0.000000391 toward
  $0.000000541 per ping at the typical band — under 0.5% of expected HTTP cost either way.
  This is the cost being spent to buy the headroom, and it is small enough not to change any
  conclusion in ADR-002 §11 or §14.
- **Requires measuring before tuning.** The right shard count depends on the real
  per-object request rate and the real billed duration, neither of which is instrumented
  today. [ADR-019](./ADR-019-instrument-d1-rows-and-do-wall-time.md) adds the DO wall-time
  measurement that makes `SHARDS_PER_REGION` a tuned number rather than a guess — land that
  first if the ceiling is not yet urgent.
- **Not urgent at current scale.** Four checks per minute through one object is far from any
  limit. This ADR exists so the ceiling is a known, priced decision rather than an outage;
  it can sit behind ADR-003 through ADR-008 comfortably.
- Existing monitors' response-time history stays comparable, because sharding is stable per
  monitor and the location hint — which is what actually determines where the probe originates
  — does not change.
