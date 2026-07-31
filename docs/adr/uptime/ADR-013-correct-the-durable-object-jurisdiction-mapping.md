# ADR-013: Correct the Durable Object Jurisdiction Mapping

## Status

**Accepted** — implemented 2026-07-31. Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md) §17 (medium). Needs a product
decision before an implementation — see Open question.

## Context

`CheckHttpJob` routes some regions through Cloudflare's EU jurisdiction:

```ts
/** Location hints that route through the EU jurisdiction for GDPR compliance. */
const EU_LOCATION_HINTS = new Set(["eeur", "enam"]);
```

```ts
let locationHint = monitor.location_hint as DurableObjectLocationHint;
let id = env.GEO_FETCH.idFromName(monitor.location_hint);
let namespace = EU_LOCATION_HINTS.has(monitor.location_hint)
	? env.GEO_FETCH.jurisdiction("eu")
	: env.GEO_FETCH;
let stub = namespace.get(id, { locationHint });
```

The nine values `monitors.location_hint` accepts are the Cloudflare location hints:
`wnam`, `enam`, `sam`, `weur`, `eeur`, `apac`, `oc`, `afr`, `me`. In that vocabulary:

- `eeur` — **E**astern **Eur**ope. Plausibly EU.
- `enam` — **E**astern **N**orth **Am**erica. Not Europe.

A jurisdiction is a hard constraint: it restricts the object to data centres within that
jurisdiction. A location hint is a preference. When the two conflict, the jurisdiction wins.
So a monitor configured to probe from **eastern North America** gets a Durable Object placed in
the **EU**, and:

- its probe originates from Europe, not North America;
- `response_time_ms` — the whole reason `GeoFetchDO` exists — measures the wrong continent;
- the region selector in the UI silently does not do what it says for that one option;
- `wnam`, the _default_, is unaffected, so this is invisible unless someone picks `enam`.

The listed intent is "GDPR compliance", which is a coherent goal — but the mechanism does not
serve it either. Jurisdiction pinning controls where the _Durable Object_ runs, and this object
holds no personal data: it proxies a fetch, measures elapsed time, and returns. It has no
storage, no alarms, and no state that survives the request. The personal data in this system —
`cron_job_pings.source_ip`, `cron_job_pings.user_agent`, session payloads, alert recipient
addresses — lives in D1 and KV, neither of which is jurisdiction-scoped here.

So there are two candidate readings and they need different fixes:

1. **`enam` is a typo.** The intended second EU hint was `weur` (Western Europe), and the set
   should be `{"eeur", "weur"}`. Under this reading `enam` is a plain bug.
2. **The jurisdiction pinning is doing nothing useful anywhere.** If the compliance goal is
   about stored personal data, this object is the wrong lever entirely and the branch should
   go.

## Open question

**Which reading is correct is a product/compliance decision, not an engineering one**, and it
cannot be settled from the code. The docblock says "for GDPR compliance" without naming the
obligation. Someone needs to answer: does any commitment — a customer contract, a DPA, a
published claim — require EU-only processing for probes originating in Europe? If yes, reading
1 with `weur` added is right. If no, reading 2 is right.

This ADR does not pick. It records both, and records that shipping either is better than
leaving `enam` pointed at Europe.

## Decision

**Immediately, regardless of the answer: remove `enam` from `EU_LOCATION_HINTS`.** It is wrong
under both readings. Under reading 1 it is a typo; under reading 2 the whole set goes and
`enam` with it. Nothing depends on `enam` being EU-pinned, so this is safe to ship now and
does not prejudge the product question.

```ts
/** Location hints that route through the EU jurisdiction for GDPR compliance. */
const EU_LOCATION_HINTS = new Set(["eeur", "weur"]);
```

**Then, once the compliance question is answered**, either:

- **Reading 1** — keep the set as `{"eeur", "weur"}` and rewrite the comment to name the actual
  obligation and why a jurisdiction, rather than a location hint, is what satisfies it.
- **Reading 2** — delete the branch, always use `env.GEO_FETCH`, and record the decision here.
  If EU data residency is genuinely required, address it where the personal data is: a
  jurisdiction-scoped namespace for anything holding `source_ip`, or not storing it at all
  ([ADR-020](./ADR-020-retention-for-every-result-table.md) already proposes narrowing that
  retention).

Add a test asserting which hints are jurisdiction-pinned. The current behaviour has no
coverage, which is why a one-character-class mistake in a `Set` literal survived.

## Consequences

- **`enam` monitors start probing from North America**, so their recorded `response_time_ms`
  changes — likely downward, for targets hosted in the Americas. That is a step change in an
  existing latency series, so it will look like an improvement that did not happen. Worth a
  changelog note, and worth checking whether any `enam` monitor's `degraded_after_ms` threshold
  was tuned around the inflated numbers.
- **No cost change.** Same number of DO requests, same duration band. Jurisdiction affects
  placement, not billing.
- **`eeur` and `weur` monitors keep an EU-pinned object**, which may or may not be what
  compliance requires — deliberately unresolved above rather than silently decided.
- **Cheap to ship.** One line, plus a test. It sits behind nothing in this ADR series.
- Interacts with [ADR-009](./ADR-009-shard-the-geofetch-durable-object-namespace.md): sharding
  changes the object id but not the jurisdiction branch, so the two are independent and can land
  in either order.

## Implementation outcome

Implemented 2026-07-31 in `apps/uptime/app/jobs/check-http.ts`. `EU_LOCATION_HINTS` is now
`new Set(["eeur", "weur"])` and the docblock states what the pin does and does not do instead of
citing "GDPR compliance": that a jurisdiction constrains where the object runs, that this object
holds no personal data, and that whether the pin belongs here at all is still the open product
question above. The branch stays, reading 2 is not taken, and nothing here answers the
compliance question.

`app/jobs/check-http.test.ts` gained a `CheckHttpJob EU jurisdiction` suite: one test walking all
nine accepted `location_hint` values and asserting the pinned set is exactly `weur` and `eeur`,
and one asserting an `enam` monitor probes with `locationHint: "enam"` and no jurisdiction. Both
fail if `enam` goes back into the set.

### The second bug: the id was minted from the wrong namespace

The branch had a second defect, independent of which hints are in the set. The id was minted off
the base namespace and then handed to `get()` on the jurisdictional subnamespace:

```ts
let id = env.GEO_FETCH.idFromName(name); // no jurisdiction
let namespace = EU_LOCATION_HINTS.has(monitor.location_hint)
	? env.GEO_FETCH.jurisdiction("eu") // jurisdiction "eu"
	: env.GEO_FETCH;
let stub = namespace.get(id, { locationHint });
```

Cloudflare's
[Durable Objects data-location reference](https://developers.cloudflare.com/durable-objects/reference/data-location/)
settles this, and it is not merely ineffective — it is an error:

- A jurisdiction is a property of the **id**, stamped on by the namespace that minted it. The
  page's own example asserts `env.MY_DURABLE_OBJECT.idFromName("my-name")` and
  `env.MY_DURABLE_OBJECT.jurisdiction("eu").idFromName("my-name")` are different ids, and the
  [id API reference](https://developers.cloudflare.com/durable-objects/api/id/#jurisdiction)
  asserts the first has `jurisdiction === undefined` and the second `"eu"`.
- "You will run into an error if the jurisdiction on your `DurableObjectNamespace` and the
  jurisdiction on `DurableObjectId` are different."
- The one exemption is one-directional: "You will not run into an error if the
  `DurableObjectNamespace` is not associated with a jurisdiction." So a jurisdictionless id
  handed to the EU subnamespace is the failing direction; the documented pattern is the reverse —
  mint from the subnamespace and `get` from either.

So the verdict is not "silently ignores the jurisdiction". Every check for a hint in
`EU_LOCATION_HINTS` threw at `get()`, which sits ahead of `fetchMonitor`'s `try`, so it
propagated as an infrastructure fault and became a `Job.RetryError` — a redelivery loop that
could never commit a result. That was `eeur` and `enam` monitors before this change. Confirmed by
reverting the fix under the test suite: three tests fail, all with `RetryError`.

The fix is to choose the namespace first and mint the id from it, which is one statement moved:

```ts
let namespace = EU_LOCATION_HINTS.has(monitor.location_hint)
	? env.GEO_FETCH.jurisdiction("eu")
	: env.GEO_FETCH;
let id = namespace.idFromName(
	`${monitor.location_hint}:${shardFor(monitor.id, SHARDS_PER_REGION)}`,
);
let stub = namespace.get(id, { locationHint });
```

The test fake for `env.GEO_FETCH` now models the documented rule — ids carry the jurisdiction of
the namespace that minted them, and `get` throws on a mismatch — rather than accepting any id.
That is what makes this regression visible from any test that probes a European region, and it is
why the ADR-009 sharding test using `weur` also fails against the old code. A dedicated test
pins the corrected behaviour directly: an `eeur` monitor's id carries jurisdiction `"eu"`, its
name is still the sharded `eeur:<0-7>`, and the check commits a result.

Since a monitor's object id in a European region changes (a jurisdictional id is a different id),
those monitors get a fresh `GeoFetchDO` instance — immaterial, because the object is stateless
and the previous id could not be reached at all.

### Not changed

- The open question is left open. `weur` and `eeur` keep the pin; whether a jurisdiction is the
  right mechanism at all still needs the product/compliance answer, and dropping the pin is the
  change that needs it.
- No cost-model movement: no D1 statement was added, removed or reshaped, and the ADR-019 §4
  budget (5 statements, 5 rows, no `SCAN`) is unchanged and still passing.
- The affected-accounts and changelog concerns in Consequences are moot — the app has one user,
  the owner, and breaking changes are acceptable.
