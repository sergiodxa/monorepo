# ADR-021: An Ad-Hoc Ping API, and Metering Every Ping to Polar

## Status

**Accepted** — implemented 2026-08-01. Adds a monitor-less probe endpoint,
`POST /api/v1/ping`, and closes the gap
[ADR-007](./ADR-007-report-infrastructure-cost-to-polar-cost-insights.md) §6 recorded in
passing: the `ping` meter that
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md) §3 said was "not wired up yet"
still is not, so the revenue half of the pricing model has never been collected.

The two halves ship together on purpose. A new billable surface that does not bill is a
worse outcome than either change alone, and the metering work is the same three lines
wherever a ping happens — writing it for the new endpoint and not for the four existing
ping types would leave the meter reading a number that is neither zero nor the truth.

## Context

Two facts, both true today, that only look unrelated.

**There is no way to check something you are not monitoring.** Every probe in the product
hangs off a stored monitor: a row, an interval, a result history, an alert policy. That is
right for a production endpoint watched for months, and wrong for the case that keeps
coming up — a CI pipeline that deploys a preview app to a freshly-minted subdomain, wants
to know the healthcheck answers before it marks the build green, and will destroy the
subdomain twenty minutes later. Expressing that with the current API means create a
monitor, wait for the scheduler to reach it, poll the results endpoint, delete the monitor:
four calls, a cron tick of latency, a monitor that exists long enough to alert on itself,
and a result history nobody will ever read.

**The `ping` meter has always been empty.** The pieces around it all exist:

| Fact                                                                                                                               | Source                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| The pricing model promises metered pings: 100,000 included in the $5/month base, then $1 per 10,000-ping block, blocks indivisible | `app/lib/pricing.ts`                                      |
| A `ping` meter id (`22fabd9b-8b03-4cc2-8981-230717267cd5`) is hardcoded, and two dashboard stat cards read it                      | `app/data/customer.ts`                                    |
| `getUsagePerMonth` filters that meter by `{ teamId }`; `getUsagePerMonthForMonitor` filters it by `{ monitorId }`                  | `Customer.getUsagePerMonth`, `getUsagePerMonthForMonitor` |
| The only event this system has ever ingested into Polar is `infra.cost.daily`                                                      | `app/jobs/report-costs.ts`                                |
| The billing subject is the **team owner**, keyed by the OIDC subject as Polar's external id                                        | `Customer.findOrCreate`                                   |
| Whether an owner is subscribed is answerable from D1 without a Polar round trip                                                    | `Subscription.isActive`                                   |

So both usage cards render `0`, permanently, for every customer; no customer has ever paid
a metered cent regardless of volume; and the pricing page describes a billing behaviour the
system does not perform. The cost side has been measured per customer since ADR-007. The
revenue side it is meant to be compared against is missing.

The two connect at the meter. The ad-hoc endpoint is, by construction, a billable check
that produces no monitor row — the one ping type that _cannot_ be inferred from stored
history after the fact. If it is not metered at the moment it happens, it is not billable at
all. That forces the design decision the existing ping types could have kept deferring, and
once it is forced there is no reason to answer it for one type only.

---

## 1. `POST /api/v1/ping`

One probe, performed synchronously, against a target described entirely by the request
body. No monitor row, no `monitor_results` row, no alert evaluation, no history. The
response is the result.

### Authentication and the new scope

`Authorization: Bearer uptime_...`, carrying a new `ping:trigger` scope in `apiKeyScopes`
(`database/schema.ts`).

It is its own scope rather than a reuse of `monitors:write` for two reasons. The first is
that it is not a write: nothing is created, so a key that may trigger probes need not also
be a key that may reconfigure or delete monitoring. The second is that this is the only
scope whose use costs the key holder money directly, with no stored object to inspect
afterwards — which is exactly the kind of authority a team should be able to grant to a CI
runner narrowly and revoke on its own.

The verb in the name is deliberate: `read`/`write` describe access to a resource, and there
is no ping resource. `trigger` describes causing an action.

### Requires an active subscription

`402` with code `SUBSCRIPTION_REQUIRED` when the team owner holds no active subscription.

The gate is `Subscription.isActive` against the D1 replica ADR-005 introduced, not a call to
Polar — the replica exists precisely so a per-request entitlement check costs one indexed
read instead of a network round trip, and this endpoint is the shape that would suffer most
from the round trip, being synchronous and latency-visible to a build.

This mirrors the scheduler, which already gates checks on an active subscription: an
unsubscribed team's monitors are not run, so an unsubscribed team's ad-hoc pings are not run
either. `402` rather than `403` because the failure is remediable by the caller's own
account holder and says how; `403` would say "you may never do this", which is untrue.

### Rate limit: 60 requests per minute per API key

The same ceiling the cron-job ping endpoint applies per caller, for the same reason and with
the same reasoning about what a limit is for: it exists to bound a flood, not to shape
legitimate traffic. A build that pings five endpoints and retries each twice is nowhere near
it; a loop is cut to one request per second.

Keyed on the API key rather than the source address. An address is the wrong key here —
CI runners share egress addresses in bulk, so one noisy pipeline would exhaust the budget of
every unrelated customer behind the same provider. The key is also the thing being billed,
which makes the limit and the charge agree about who the caller is.

### The request body

A JSON object discriminated on `type`, with one variant per probe protocol. Every field
except the discriminator and the target has a default, so the smallest useful call is
`{"type":"http","url":"https://example.com"}`.

| `type`   | Required       | Optional, with defaults                                                                                                                                      |
| -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"http"` | `url`          | `method` (`GET`), `expectedStatus` (`200`), `timeoutSeconds` (`10`, 1–60), `degradedAfterMs` (`5000`), `region` (`wnam`), `headers`, `body`, `contentChecks` |
| `"dns"`  | `domain`       | `recordType` (`A`), `expectedValue`                                                                                                                          |
| `"tcp"`  | `host`, `port` | `timeoutMs` (`5000`, 100–60000)                                                                                                                              |

The defaults are the stored monitors' defaults, not new ones. That is the whole point: a
ping run with an empty body should behave the way a monitor created with an empty form
behaves, so a result observed ad hoc predicts what the same target will report once it is
monitored. `region` accepts the same nine location hints a monitor does
(`wnam, enam, sam, weur, eeur, apac, oc, afr, me`) and reaches the same region-pinned
probing objects, so a latency figure from the endpoint is comparable with a latency figure
from a check.

`contentChecks` are supplied inline — `{ type: "contains" | "not_contains" | "regex", value,
caseSensitive? }` — rather than referenced by id, because there is no monitor to hang them
off and because a CI caller's assertions are part of the request, not part of a stored
configuration.

### A failing target is a successful request

The single most important thing about this endpoint, and the thing every client will get
wrong if it is not said loudly:

> **A target that is down returns `200 OK`.** The failure is reported inside
> `data.ping.status`. A non-2xx response means the _request_ failed — not the target.

The alternative — mapping a `down` target onto a `502` or a `503` — is tempting because it
makes `curl --fail` work, and it is wrong. It conflates two independent axes: whether the
probe was performed, and what the probe found. A `503` from this endpoint would be
indistinguishable from the API itself being unavailable, which is precisely the case a CI
script must not treat as "your service is down". Keeping the axes separate means a script
can tell "I could not find out" from "I found out, and it is broken", and only the second
should fail a build.

So the error codes are all about the request:

| Status | Code                    | Means                                     |
| ------ | ----------------------- | ----------------------------------------- |
| 400    | `VALIDATION_ERROR`      | The body is not a valid probe description |
| 401    | `UNAUTHORIZED`          | Missing or invalid API key                |
| 402    | `SUBSCRIPTION_REQUIRED` | The team owner has no active subscription |
| 403    | `FORBIDDEN`             | The key lacks `ping:trigger`              |
| 429    | `RATE_LIMIT_EXCEEDED`   | Past the per-key budget                   |
| 500    | `INTERNAL_ERROR`        | The probe could not be performed          |

and the outcome codes are all inside the payload: `up | degraded | down` for HTTP,
`ok | changed | error` for DNS, `up | down | timeout` for TCP. Each of the three keeps the
status vocabulary its stored-monitor counterpart already uses, so one concept has one
spelling across the product. `changed` occurs only when `expectedValue` was supplied and the
resolved value did not match it; with no `expectedValue` there is nothing to have changed
from, and a successful resolution is `ok`.

### The response

The standard envelope from `app/services/api-response.ts`, `{ data, meta }`, with the result
under `data.ping`. Common fields are `id`, `type`, `status` and `checkedAt`; each type adds
its own measurements. The `id` is generated and returned but stores nothing — it exists so a
caller can correlate a build log line with a support conversation, not so the result can be
fetched again. There is no `GET /api/v1/ping/:id`, and adding one would mean storing the
history this endpoint exists to avoid.

---

## 2. Metering every ping, one event per ping

### The decision, and the one it appears to contradict

`ReportCostsJob` rolls infrastructure cost up **daily** and says why in its own docblock:
per-check ingestion would be 179,000+ Polar calls a month for a single account, and Cost
Insights can do nothing with the extra resolution.

Metering goes the other way: **one event per ping, at the moment of the ping.** The
contradiction is only apparent, because the two figures are consumed differently. Cost is
read by a human comparing months. Usage is read by a customer, on a dashboard, mid-month,
deciding whether to add monitors — and by Polar, deciding what to invoice. A usage number
that is a day stale is a usage number that is wrong when it matters most: the day a customer
crosses a block boundary is the day they look.

The cost of live ingestion is bounded four ways, and each is load-bearing:

- **Always best-effort.** Every call is `polar.ingestEventsSafe`, which returns `false`
  rather than throwing. Metering must never fail a check. A monitoring product that stops
  monitoring because its billing provider is having an incident has failed at the only thing
  it does.
- **Every event carries an `externalId`.** Polar deduplicates on it, so a queue redelivery,
  a retried sweep, or a re-run of the same job cannot double-bill. This is what makes
  best-effort safe to pair with the queue's at-least-once delivery: the safe path never
  retries, and the unsafe path — the platform retrying the whole job — is idempotent.
- **Sweeps batch.** The DNS and TCP sweeps collect every event of a sweep and hand them to
  one `ingestPings` call; the Polar client chunks at 100 events per request. A sweep of 300
  monitors therefore costs three subrequests, not 300, which keeps the change clear of the
  per-invocation subrequest ceiling that would otherwise bind long before cost did.
- **The synchronous endpoint does not wait.** The ad-hoc ping's event is ingested under
  `waitUntil`, so Polar's latency is never added to a build's.

The accepted cost is stated plainly: **a dropped event is lost revenue, with no retry.** It
is visible only as a `ping_meter.ingest_failed` log line. That is the right trade at this
volume — the alternative is a durable outbox, which is a queue, a table and a retention
policy to protect a fraction of a cent per event — but the log line is the signal that the
trade has stopped being right, and a sustained non-zero rate should be treated as revenue
loss rather than noise.

### Which pings are metered: all of them

HTTP monitor checks, DNS checks, TCP checks, received cron-job pings, and the new ad-hoc
pings. Five sources, one event name.

This is not a scope decision so much as an alignment: `pricing.ts` already promises that
usage past 100,000 pings is billed, and nothing in that promise distinguishes protocols. A
partial rollout would produce a meter whose value depends on which monitor types a customer
happens to use, which is worse than zero — zero is obviously broken, and a plausible wrong
number is not.

The consequence has to be named rather than buried in a consequences list: **this is the
change that starts charging existing customers metered usage for the first time.** A
customer running 200 one-minute monitors has been producing roughly 8.6 million pings a
month and paying $5. From the first full month after this ships they are billed for the
overage the pricing page has always described. That is a customer-communication event, not
just a deploy, and the deploy should not precede the communication.

### The event shape

```ts
{
  name: "ping",
  externalCustomerId: ownerId,          // the team owner's subject id
  externalId: /* unique per ping */,    // Polar deduplicates on this
  metadata: { teamId, type, monitorId },
}
```

Every key in `metadata` is load-bearing, and the reason is that a Polar meter is a filter
over events:

- **`teamId`** is what `Customer.getUsagePerMonth` filters by. Omit it and the team usage
  card reads zero for ever, which is the bug this ADR is fixing.
- **`monitorId`** is what `getUsagePerMonthForMonitor` filters by. Present for the four
  monitor-backed sources, absent for ad-hoc pings.
- **`type`** is not read by anything today. It is included because it is the only dimension
  that lets a support question — "why did my usage double?" — be answered from the meter
  instead of by inference from D1, and because adding a metadata key later does not
  retroactively add it to events already ingested.

`externalCustomerId` rather than a Polar customer id for the same reason ADR-007 chose it:
the app keys customers by OIDC subject and never stores the Polar id, so using the external
id keeps the ingest path free of a lookup.

The consequence of ad-hoc pings carrying no `monitorId` is worth stating: **they count
toward the team total and appear on no monitor's usage card.** The two cards therefore stop
summing to each other for teams that use the endpoint. That is correct — the pings are real
and belong to the team — but it is the kind of discrepancy that reads as a bug to whoever
notices it first, so the per-monitor card is a per-monitor figure by definition, not a share
of a total.

### The prerequisite that lives outside this repository

**The Polar `ping` meter must be configured to count events named `ping`.**

A meter is `{ filter, aggregation }`. If this one's aggregation is a `sum` over a metadata
property rather than a count of matching events, every event ingested here contributes zero
and the symptom is identical to the bug being fixed: empty cards, no metered charges,
nothing in the logs. The meter has existed, unfed, for long enough that nobody can remember
how it was set up, so verifying it is a step in shipping this, not an assumption.

The verification is cheap and should be done in this order: configure or confirm the meter,
ingest one event, read it back through `getUsagePerMonth` for that team, and only then
enable ingestion everywhere.

---

## 3. Supporting refactors

Two changes that are not the feature but are what make the feature small.

**`HttpCheck`, in `app/services/http-check.ts`.** The HTTP probe used to live in
`CheckHttpJob`'s private methods, which meant the ad-hoc endpoint could either duplicate it
or enqueue a job and wait — the first guarantees drift between the scheduled and ad-hoc
answers, the second reintroduces the latency the endpoint exists to remove. It is now a
class exposing the three steps the check actually is — `probe`, `evaluate`, `classify` —
plus `run` for callers with nothing to interleave. The job steps through them because it
reads the previous status, commits a row and dispatches alerts between them; the endpoint
calls `run`. Neither one owns the definition of what "degraded" means any more, which is the
property that matters: a change to classification changes both surfaces or neither. The DNS
and TCP checks were already factored this way, so this makes HTTP the same shape rather than
inventing one.

**`writeHttpPingResult` became `writePingResult`.** The Analytics Engine writer was
HTTP-only, with `"http"` hardcoded in its blob list, so DNS, TCP and cron results have never
appeared in the monitoring dataset at all — noted as a gap in ADR-007's context table and
fixed here as a by-product of needing one write path for the ad-hoc types. The generalized
writer takes the type as a parameter. The immediate effect is that DNS and TCP results
become queryable for the first time; the analytics surfaces that only know how to read HTTP
rows will not show them until they are taught to, so this opens the data without closing the
product gap.

---

## 4. The dashboard quick check

The same ad-hoc check, reached from the UI: a URL box above the team's stat cards,
`POST /actions/:team/run-ping`, member-level. It exists because the API surface only serves
people who already hold a key, and "does this URL answer?" is a question a signed-in user
has as often as a pipeline does.

**HTTP only, and no options.** A URL box is the shape of an HTTP question; making one field
also accept a bare domain or a `host:port` would make it mean three things depending on what
was typed. Every option the API exposes is fixed here to the same default the API applies
when it is omitted, except the method, which is `GET` rather than the monitors' `HEAD` —
a URL typed in by hand is usually a page or a healthcheck endpoint, and some of those answer
`HEAD` with a 405 that says nothing about whether the service is up.

**The result travels through the session, not the response.** The action stores it and
redirects; the card's own fragment route reads it, removes it, and renders it. That
indirection buys two things. A refresh cannot re-run — and re-bill — the check, because the
page the browser lands on is a redirect target rather than a form post. And the scripted and
unscripted paths produce identical markup, because both end at the same fragment: with
JavaScript the form island posts, then reloads its `Frame`; without it, the redirect renders
the whole dashboard and the frame resolves server-side through the same handler. Nothing
about the result is assembled in the browser.

**It is a plain session value, not a flash, and that is not a stylistic choice.** "Show it
once" is exactly what a flash is for, and a flash is what this was written with first. It
does not work here. A _delivered_ flash marks the session dirty in `Session`'s constructor,
and `session-middleware` calls `sessionStorage.save()` as soon as the handler returns — which,
for a streaming HTML response, is before the body's frames have resolved. On the no-JavaScript
path the dashboard _document_ request is a second reader of that session, and its save would
clear the flash before the fragment that needs it ever ran. The card would have rendered empty
on every unscripted submit, and no test of the fragment in isolation would have shown it,
because in isolation the fragment is the only reader.

A plain value inverts the dependency: the document request never touches the key, so it stays
clean and `KVSessionStorage.save` no-ops for it (it writes only when dirty), and the fragment
removes the value itself. The result is correct under any ordering of the two requests rather
than under one particular interleaving. `dashboard-quick-ping-frame.test.ts` exercises the
document request with real frame resolution — not the stubbed `resolveFrame` the other page
tests use — because a stub is what would hide this class of bug; the same test was checked
against the old implementation and fails there, which is the only way to know a regression
test regresses on anything.

One residual edge, bounded and left as is. The invariant above — the document request stays
clean — holds only while nothing _else_ dirties it. The dashboard reads the `toast` flash, so
a toast pending at the same moment as a quick-check value makes that request dirty, and it
would then save a snapshot taken before the fragment's `unset`. The value survives and the
card shows the same result once more. That needs a toast and a quick-check result to be
in flight together, which takes an unrelated action landing between the check and the render,
and the worst outcome is a duplicated render of a correct result — nothing is re-probed and
nothing is re-billed, since the meter event was ingested by the action, not by the card.
Trading a cosmetic edge for a KV-backed one-shot store keyed outside the session is not worth
it; the note exists so this is recognised rather than rediscovered.

**Its own `Frame`, for a different reason than the dashboard's other frames.** The stat
cards are frames so the shell does not block on their slowest fetch. This one is a frame so
that submitting it swaps one card instead of refetching every frame above it to show one
URL's result.

The result is shown exactly once — reading the flash consumes it — because a result that
lingered would go on describing a check that happened an unknown length of time ago.

---

## 5. Cost

The metering itself is close to free and lands where it should. Polar ingestion is an
outbound subrequest, which Workers does not bill per call; what it costs is a slot in the
per-invocation subrequest budget, which is why the sweeps batch. The ad-hoc endpoint's own
cost is one Worker request, one entitlement read against the D1 replica, one rate-limiter
call, one Durable Object probe for HTTP, and one Analytics Engine data point — materially
the same as a scheduled check minus the queue operations and the `monitor_results` write, so
it is _cheaper_ to serve than the monitored equivalent while being billed identically. That
asymmetry is fine and slightly in the platform's favour; it is recorded here so a future
cost reconciliation does not read it as an instrumentation gap.

The cost ledger picks all of this up without changes, because the recording sites it already
instruments are the ones this path uses.

**One exception, recorded rather than hidden: an HTTP monitor check now costs six D1
statements instead of five.** A Polar event is billed to a customer, and the customer's
external id is the team owner's subject id, but `CheckHttpJob` holds only `team_id` — so it
reads the owner. The DNS and TCP sweeps amortise that lookup over a whole sweep (one query,
however many monitors were claimed); a per-monitor job cannot. The ADR-019 §4 budget assertion
was raised from five to six deliberately, not relaxed by accident: the plan still uses an
index and the no-table-scan assertion is untouched, so what grew is one point lookup, about
1e-7 cents per check. The alternative — folding the owner into the monitor read with a joined
raw query — would trade a typed `findOne` in the hottest job for a hand-shaped row type, which
is a worse trade at this price. If the statement count ever needs to come back down, that join
is the lever.

---

## Consequences

- **The pricing model becomes real.** What `pricing.ts` describes and what customers are
  charged are the same thing for the first time. Both usage cards start showing a number
  that moves.
- **Existing customers are billed metered usage for the first time.** Nothing about their
  configuration changed; what changed is that the meter is now fed. This needs to be
  communicated ahead of the deploy, and it is the single largest risk in this ADR — the
  technical work is small and the billing consequence is not.
- **CI gets a first-class integration.** Probing an ephemeral preview deployment no longer
  requires creating and destroying a monitor, and the probe runs from the same regions and
  with the same classification rules as monitoring does, so a green build means the same
  thing a green monitor does.
- **Callers must branch on `data.ping.status`, not on the HTTP status.** This is documented
  prominently in the API reference, and it is the one thing an integration can get wrong in
  a way that silently passes builds for months.
- **A dropped Polar event is unrecoverable revenue.** Best-effort ingestion has no retry and
  no outbox; `ping_meter.ingest_failed` is the only trace. A durable outbox is the answer if
  that rate is ever non-trivial, and it is deliberately not the answer today.
- **Ad-hoc pings are attributable to a team but not to a monitor.** The per-team and
  per-monitor usage figures no longer reconcile for teams that use the endpoint.
- **The meter's configuration is now load-bearing and lives outside this repository.** A
  misconfigured aggregation produces exactly the symptoms of the bug this fixes, so it
  should be verified before ingestion is enabled and re-verified if usage ever reads zero.
- **DNS and TCP results reach Analytics Engine for the first time**, which changes the
  dataset's volume and mix. Existing queries filter by type and are unaffected; the retention
  and cost figures for the dataset are not.
- **HTTP classification has one implementation.** The scheduled and ad-hoc answers cannot
  diverge, which is a precondition for the endpoint being useful as a predictor of what
  monitoring will report.
