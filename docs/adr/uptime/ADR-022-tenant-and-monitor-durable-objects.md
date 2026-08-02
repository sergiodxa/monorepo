# ADR-022: Tenant and Monitor Durable Objects

## Status

**Analysis** — 2026-08-02. No code, schema, configuration or infrastructure change has been
made. Everything below is a proposal and a cost model; §21 is the recommendation and §22 is
the plan that would follow approval. Nothing in either has been implemented.

Supersedes nothing. Depends on, and in one place contradicts,
[ADR-009](./ADR-009-shard-the-geofetch-durable-object-namespace.md), which explicitly
rejected one Durable Object per monitor on cost grounds — §19.6 re-prices that rejection
against the SQLite storage backend, which did not exist as a consideration when ADR-009 was
written.

---

## 1. Executive summary

The proposal is to move tenant-operational state into one SQLite-backed `TenantDO` per team,
and monitor configuration, execution and results into one SQLite-backed `MonitorDO` per
monitor, leaving a small global D1 database as a control plane and routing index. The stated
motivation is horizontal data isolation and storage scaling: D1 caps a single database at
10 GB, while each SQLite-backed Durable Object gets its own 10 GB and the account-wide total
is unlimited on Workers Paid.

**The motivation is real and nearer than it looks.** The 10 GB wall is usually described as
distant because `monitor_results` is purged after 7 days. But three other tables already
carry long windows against the same 10 GB:

| Table                                       | Retention    | Bytes/row (incl. indexes) | 10 GB reached at                   |
| ------------------------------------------- | ------------ | ------------------------: | ---------------------------------- |
| `monitor_results`                           | 7 days       |                      ~200 | ~4,960 1-minute HTTP monitors      |
| `dns_monitor_results` `tcp_monitor_results` | **90 days**  |                      ~200 | **~386** 1-minute monitors         |
| `cron_job_pings`                            | **365 days** |                      ~200 | **~95** every-minute cron monitors |

Ninety-five every-minute cron monitors is a wall a single mid-sized customer could walk into.
That is the strongest argument in the proposal's favour, and it is stronger than the argument
that was actually made for it.

**On cost, the proposal wins, but not for the reason it appears to.** Modelled against the
implementation at `83f6c75d` and Cloudflare's published Workers Paid overage rates (verified
2026-08-02), the proposed architecture is **2.7× cheaper per check** than the current one:
$4.95 versus $13.51 per million checks, gross of included allowances. Almost all of that
saving is one line — **rows written**. The current HTTP path writes 11 D1 rows per check; a
`MonitorDO` as proposed writes 4. It is not the Durable Object that saves the money, it is
the per-monitor schema: a table that holds one monitor's results needs no `monitor_id`
column, no `monitor_id` index, and no text primary key, so `checked_at` can be the rowid and
an insert costs exactly one written row.

**Three findings complicate the recommendation.**

1. **`TenantDO` buys nothing on cost.** Modelled side by side, `TenantDO + MonitorDO` costs
   $213.65/month at 1,000 one-minute monitors and `MonitorDO` alone with the catalog left in
   D1 costs $212.54 — a 0.5% difference. The `TenantDO` is a correctness-and-isolation
   argument, not a scaling one, and it carries the entire cost of the proposal's hardest
   parts: two-object lifecycle, projections, leases, orphan GC, and the loss of every
   cross-tenant query.
2. **A cheaper architecture exists.** One scheduler object per (region, shard) that owns many
   monitors — a `RegionShardDO` — comes in at $3.33 per million checks, a further 33% below
   the proposal, because it amortises the `setAlarm()` write and the billed duration window
   across every monitor it owns. It reintroduces shared state, which is the thing the
   proposal exists to remove, so it is not recommended — but it must be priced, because
   "per-monitor objects are the cheap option" is not true.
3. **The proposal has a silent-failure hole.** Durable Object alarms retry six times with
   exponential backoff and then stop. Today, a monitor whose check fails is re-enqueued by
   the global scheduler on the next minute regardless; under the proposal, a monitor whose
   alarm chain breaks stops being monitored and **nothing in the system notices**. A liveness
   watchdog is not an optional refinement, it is a precondition.

**Recommendation (§21): adopt the direction, invert the order, and change the write shape.**
Build `MonitorDO` first with the catalog left in D1; make `checked_at` the `INTEGER PRIMARY
KEY`; derive current status from the newest result row rather than maintaining a mutable
state row; project to the read model on change and at most once every N checks, never per
check. Treat `TenantDO` as a separate, later decision with its own trigger conditions. Do not
start either until the liveness watchdog, the entitlement fan-out, and the backup story are
designed, because all three are regressions the proposal does not currently address.

---

## 2. Existing architecture

Read from the implementation, not from the docs.

### 2.1 Storage and bindings

`wrangler.jsonc` declares one D1 database (`ping`), one KV namespace, two Queues (`ping` and
`ping-dlq`), two Analytics Engine datasets (`uptime_monitor_results`, `uptime_costs`), one
Durable Object class (`GeoFetchDO`), and one rate-limiter binding. Compatibility date
`2026-04-10`, `nodejs_compat`, smart placement.

Seven cron triggers: `* * * * *`, `*/10 * * * *`, and five daily ones (00:00 cleanup, 01:00
aggregation, 02:00 subscription reconciliation, 03:00 cost reporting, 06:00 SSL).

### 2.2 The five monitor types

| Type     | Scheduling                                                                                                      | Probe                                                                                 | Results land in                            |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| **HTTP** | Per-monitor: `Monitor.findDue` claim → one queue message per due monitor                                        | `stub.fetch` through `GeoFetchDO`, region-pinned                                      | `monitor_results` (7 d) + Analytics Engine |
| **TCP**  | Sweep every minute; `TcpMonitor.claimDue` inside it                                                             | `connect()` from `cloudflare:sockets`, in the Worker                                  | `tcp_monitor_results` (90 d) + AE          |
| **DNS**  | Sweep every minute; `DnsMonitor.claimDue`                                                                       | DoH `GET` to `cloudflare-dns.com`, in the Worker                                      | `dns_monitor_results` (90 d) + AE          |
| **SSL**  | Daily sweep at 06:00 over `monitors.ssl_monitoring_enabled`                                                     | **None.** `calculateSslStatus` re-derives status from a hand-entered `ssl_expires_at` | `monitors.ssl_status` only                 |
| **Cron** | Two halves: inbound `POST /api/v1/cron-jobs/:id/ping` (API-key authenticated) and a per-minute evaluation sweep | n/a — reception, not probing                                                          | `cron_job_pings` (365 d) + AE              |

The standalone `ssl_monitors` table exists in the schema and in migrations but **nothing
reads or writes it** — SSL monitoring runs entirely off the `monitors.ssl_*` columns. It is
dead weight in any placement discussion.

### 2.3 Scheduling: `next_due_at` claims

`app/lib/scheduling.ts` `claimDue()` is one statement shared by all three claiming tables:

```sql
UPDATE <table>
   SET next_due_at = next_due_at + (interval_seconds * 1000)
         * (((? - next_due_at) / (interval_seconds * 1000)) + 1),
       updated_at  = ?
 WHERE next_due_at IS NOT NULL AND next_due_at <= ?
RETURNING <columns>
```

Four properties matter and must survive any migration:

- **The cadence is anchored to the schedule, not to completion.** The next due time advances
  from its own previous value by whole intervals, so a slow probe cannot push its own cadence
  out.
- **It stops at the first value past `scheduledAt`**, so a monitor left unscheduled for an
  hour gets one check, not sixty. No catch-up storm.
- **Claim and read are one statement**, so two concurrent cron deliveries cannot both take
  the same monitor — the loser's `next_due_at <= ?` guard no longer matches.
- **`next_due_at IS NULL` is the single meaning of "not scheduled"**, and it is also the
  entitlement switch: `Subscription.setEntitlement` nulls or restores it in bulk when a Polar
  webhook lands, so a revoked subscription stops monitoring instantly with one UPDATE per
  table.

Backstop: `Monitor.scheduledJobId(monitorId, scheduledAt)` buckets the job id to the minute,
so a delivery that races the claim collides on the `monitor_results` primary key instead of
double-probing. The every-minute cron is observed to deliver more than once per minute
(~7 s apart), which the model below calls `K = 2`.

### 2.4 `GeoFetchDO`

A stateless proxy: `fetch()` the target, time it, return the response with `X-Response-Time`,
`X-Probe-Outcome`, and `X-DO-Wall-Time` headers. No storage, no alarms. The id is
`idFromName("${location_hint}:${shardFor(monitor.id, 8)}")`, minted from the EU
subnamespace for `weur`/`eeur` (ADR-013), and fetched with `get(id, { locationHint })`. Nine
hints × 8 shards = at most 72 objects platform-wide.

The sharding decision (ADR-009) is explicitly a trade: a shared object amortises billed
duration across concurrent probes, so **per-check duration falls as regional density rises**.
That is the property one-object-per-monitor destroys, and §19.6 prices it.

### 2.5 Results, aggregation, analytics

Every completed check writes an Analytics Engine data point (`uptime_monitor_results`:
`blob1` monitor, `blob2` type, `blob3` status; `index1` team). `AggregateDailyStatsJob` rolls
yesterday up into `monitor_daily_stats` — HTTP from an AE query, DNS/TCP/cron from D1 `GROUP
BY`s. The dashboard reads AE through a KV cache; `monitors.last_status` /`last_checked_at` /
`last_response_time_ms` are a cache on the row so transition detection and list rows cost no
query (ADR-011).

Analytics Engine statistically samples under load, so every aggregate weights by
`_sample_interval`. Its retention is three months, which happens to coincide with the 90-day
window the proposal wants.

### 2.6 Alerts, maintenance, status pages

`dispatchAlerts` is one pipeline for all types: check for a suppressing maintenance window,
resolve applicable alerts (monitor-specific + team-wide), skip any in cooldown
(`cooldown_minutes`, default 15) or at the per-incident cap (`MAX_CONSECUTIVE_SENDS = 10`),
deliver email/webhook/Slack/Discord, record every outcome to `alert_events`. Cooldown is
keyed `(alert_id, monitor_id, event_type, sent_at)` — **per monitor**, which turns out to
matter for placement. The team-wide alert _history_ page is not per monitor: it reads
`AlertEvent.listByAlertIds` across the team.

Status pages are public, keyed by a globally unique `slug`, cached 60 s with a 5-minute
stale-while-revalidate. `status_pages.custom_domain` is stored and editable through the API
but **no code routes on it** — custom-domain status pages are not implemented.

### 2.7 Access, keys, billing

`requireTeam` resolves `:team` (id or slug) and the viewer's membership, 404-ing on either
miss. `requireApiKey(scope)` hashes the bearer token, looks it up by `key_hash`, checks
expiry and scope, and exposes `ctx.apiTeam`. **The cron ping endpoint is API-key
authenticated** (`cron-jobs:ping`), scoped to the key's own team — there is no public
heartbeat token in this codebase.

Polar subscription state is replicated into `subscriptions` by webhook and repaired daily
(ADR-005). Infrastructure cost is measured by an `AsyncLocalStorage` ledger, priced against
`app/lib/cost-rates.ts`, written to the `uptime_costs` AE dataset one data point per team per
unit of work, and reported daily to Polar Cost Insights (ADR-007).

### 2.8 What the current architecture already costs

At the production account (1 team, 5 HTTP + 9 cron monitors, ~232,000 checks/month):
**$3.88/month gross**, of which $2.74 is D1 rows written and $0.52 is queue operations. Net
of included allowances it is $0.16/month, because only Queues is over quota — and it is over
quota because of a fixed overhead that does not depend on monitor count at all:

```text
3 sweep messages per every-minute cron delivery x 43,200 minutes x K=2
  = 259,200 messages = 777,600 queue operations
  = 78% of the 1,000,000 included Queues allowance, at fourteen monitors
```

`dispatchCron` sends `checkCronJobs`, `checkTcp` and `checkDns` unconditionally on every
delivery, outside the `if (due.length > 0)` guard.

---

## 3. Proposed architecture

Three stores, with a strict rule about what may live in each.

```text
                    ┌──────────────────────────────────────────┐
   request  ───────▶│  Worker (fetch / scheduled / queue)       │
                    └───┬──────────────────┬───────────────────┘
                        │ resolve identity │ route
                        ▼                  ▼
            ┌───────────────────┐   ┌──────────────────┐
            │  Global D1        │   │  TenantDO(team)  │  one per team
            │  control plane    │   │  SQLite          │
            │  + routing index  │   │  catalog, config │
            └───────────────────┘   └────────┬─────────┘
                                             │ create / destroy / project
                                             ▼
                              ┌──────────────────────────────┐
                              │ MonitorDO(team/monitor)      │  one per monitor,
                              │ SQLite: config, results,     │  placed by locationHint
                              │ rollups, alarm, lease        │
                              └───────────┬──────────────────┘
                                          │ alarm() -> probe -> persist
                                          ▼
                                    monitored target
```

- **Global D1** holds only what must be searchable _across_ tenants: routing indexes,
  billing identities, the object registry, and the inverse membership index. It is never the
  primary store for monitor configuration, results, scheduling or alerts.
- **`TenantDO`** owns tenant-operational state and the monitor catalog. It is the read model
  for monitor lists and status pages: one local SQLite query, never a fan-out.
- **`MonitorDO`** owns one monitor end to end: full configuration, its alarm, its execution,
  its results, its rollups, its incidents, and its ownership lease. It probes directly from
  its own region, which makes `GeoFetchDO` unnecessary.

Queues are retained, but only for work that genuinely wants at-least-once delivery with
retries and a dead-letter queue: outbound email, webhook/Slack/Discord delivery, reconciliation
sweeps, and administrative batch work. Ordinary monitor execution uses no queue.

Analytics Engine is retained, but demoted: it stops being the source of user-facing monitor
history and keeps only the two jobs it is actually good at — the cost ledger (ADR-007) and
cross-tenant product analytics.

---

## 4. Responsibility boundaries

| Question                                                                                                 | Answered by        | Why not elsewhere                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| Which teams can this subject access?                                                                     | Global D1          | Needs a subject-keyed index across all tenants; no single tenant can answer it.                         |
| Does this slug / API key hash / status-page slug / invite id / custom domain resolve, and to which team? | Global D1          | Pure routing. Must be answerable before any tenant object is addressable.                               |
| Which Polar customer is this team, and is it entitled?                                                   | Global D1          | Reconciliation enumerates all subscriptions against Polar; a per-tenant store cannot be swept.          |
| Which Durable Objects should exist?                                                                      | Global D1 registry | The GC needs an enumerable expectation set that does not require contacting every tenant.               |
| What role does this subject have inside this tenant?                                                     | `TenantDO`         | Tenant-local authorisation; changing it must not require a global write.                                |
| What monitors does this team have, and what is each one's current status?                                | `TenantDO`         | The list must be one query. A fan-out over N `MonitorDO`s is the thing this design exists to avoid.     |
| Is this monitor inside a maintenance window?                                                             | `TenantDO`         | Windows are tenant-scoped and may cover all monitors.                                                   |
| Which alerts apply, and what are the channels?                                                           | `TenantDO`         | Team-wide alerts apply to every monitor; a per-monitor copy would need fan-out on every edit.           |
| What is this team's plan limit and current usage?                                                        | `TenantDO`         | Strongly consistent counters; today this is an eight-subquery D1 statement costing ~14,000 rows read.   |
| Does this monitor belong to this tenant?                                                                 | `TenantDO`         | The catalog is the authority; the `MonitorDO`'s own claim about its team is not trustworthy on its own. |
| What exactly is this monitor's configuration?                                                            | `MonitorDO`        | It is what executes; a stale projected copy must never decide a probe.                                  |
| When does this monitor check next, and did it check?                                                     | `MonitorDO`        | Its own alarm and its own execution record.                                                             |
| What happened on every check for 90 days?                                                                | `MonitorDO`        | Unbounded, per-monitor, append-only — the only data with a real scaling problem.                        |
| What is this monitor's precise current status?                                                           | `MonitorDO`        | The `TenantDO` holds a projection that may lag by the projection interval.                              |
| Deliver this email / webhook                                                                             | Queue              | Needs retries, backoff and a dead-letter queue; must not block or fail an alarm.                        |
| What did the platform cost, per team, yesterday?                                                         | Analytics Engine   | Cross-tenant aggregation with sampling correction; no tenant store can answer it.                       |
| Platform-wide product analytics                                                                          | Analytics Engine   | Same.                                                                                                   |

**The boundary rule, stated once:** global D1 answers _where to go_; `TenantDO` answers _what
exists and who may see it_; `MonitorDO` answers _what happened_. Anything that has to be
answered across tenants either lives in D1 or is a projection into Analytics Engine — never a
fan-out over Durable Objects.

---

## 5. Schema placement

Every table in `database/schema.ts`, and where it would go. "Projection" means a derived copy
whose authority lives elsewhere and which may be rebuilt from that authority.

| Table                                                   | Placement                                                                             | Notes                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `teams`                                                 | **Global D1**                                                                         | Slug routing, billing identity, admin enumeration, tenant registry.                                                                     |
| `memberships`                                           | **Global D1** (inverse index) + **TenantDO** (authoritative role)                     | D1 answers "which teams", `TenantDO` answers "what role". Duplicated on purpose — see §9.                                               |
| `invites`                                               | **TenantDO** + **Global D1** id→team index                                            | `Invite.findById` is a global lookup: the acceptance link carries only the invite id.                                                   |
| `team_domains`                                          | **Global D1**                                                                         | `Team.joinByDomain` matches a verified hostname across every team.                                                                      |
| `api_keys`                                              | **Global D1** (hash→team, prefix, scopes, expiry) + **TenantDO** (management list)    | The hash lookup happens before any tenant is known. Scopes must be in D1 or auth costs two hops.                                        |
| `user_preferences`                                      | **Global D1**                                                                         | Read by the i18n middleware before a tenant is resolved.                                                                                |
| `monitors`                                              | **MonitorDO** (authoritative) + **TenantDO** catalog row (projection)                 | Catalog row: id, object id, type, name, region, lifecycle, enabled, status, last checked, response time, display order.                 |
| `monitor_results`                                       | **MonitorDO**                                                                         | Retention 7 d → **90 d**. `checked_at` becomes the `INTEGER PRIMARY KEY`.                                                               |
| `monitor_content_checks`                                | **MonitorDO**                                                                         | Only the probe reads them.                                                                                                              |
| `dns_monitors`                                          | **MonitorDO** + **TenantDO** catalog row                                              | As `monitors`.                                                                                                                          |
| `dns_monitor_results`                                   | **MonitorDO**                                                                         | Already 90 d.                                                                                                                           |
| `tcp_monitors`                                          | **MonitorDO** + **TenantDO** catalog row                                              | As `monitors`.                                                                                                                          |
| `tcp_monitor_results`                                   | **MonitorDO**                                                                         | Already 90 d.                                                                                                                           |
| `ssl_monitors`                                          | **Removed**                                                                           | Dead table: nothing reads or writes it. SSL runs off `monitors.ssl_*`.                                                                  |
| `cron_job_monitors`                                     | **MonitorDO** + **TenantDO** catalog row                                              | The per-minute global evaluation sweep disappears; the monitor's own alarm fires at its next deadline.                                  |
| `cron_job_pings`                                        | **MonitorDO**                                                                         | 365 d and the largest personal-data surface. Redaction at 30 d stays.                                                                   |
| `alerts`                                                | **TenantDO**                                                                          | Projected down to `MonitorDO` (§6.3) so an alert decision needs no cross-object hop.                                                    |
| `alert_events`                                          | **MonitorDO** (authoritative; cooldown is per-monitor) + **TenantDO** tail projection | Cooldown keys on `(alert_id, monitor_id, event_type)`, so the whole decision is local. The team-wide history page needs the projection. |
| `maintenance_windows`                                   | **TenantDO** (authoritative) + projected down to `MonitorDO`                          | A window covering "all monitors" must reach every `MonitorDO`; see §6.3 and §20.6.                                                      |
| `status_pages`                                          | **TenantDO** + **Global D1** slug→(team, page) route                                  | Slugs are globally unique today; the uniqueness check must stay global.                                                                 |
| `status_page_monitors` and the four sibling join tables | **TenantDO**                                                                          | Read only when rendering a page the tenant owns.                                                                                        |
| `monitor_daily_stats`                                   | **MonitorDO** (own rollup) + **TenantDO** projection                                  | 365-day heatmap per monitor is 365 rows; the team-level card needs the projection.                                                      |
| `subscriptions`                                         | **Global D1**                                                                         | Daily reconciliation lists every Polar subscription and diffs it against this table.                                                    |
| _new_ `durable_object_registry`                         | **Global D1**                                                                         | Expectation set for the administrative GC (§15).                                                                                        |
| _new_ `orphan_candidates`                               | **Global D1**                                                                         | Quarantine ledger for the GC.                                                                                                           |
| _new_ `monitor_routes`                                  | **Global D1**                                                                         | `monitor_id → (team_id, type, object_id)`. Needed by admin tooling and by any route that receives a monitor id without a team.          |

Two tables the proposal's brief lists that this codebase does not need:

- **A public cron/heartbeat token index.** The ping endpoint authenticates with an API key
  scoped to a team and resolves the monitor _within that team_
  (`CronJobMonitor.findByIdForTeam`). The API-key index already covers it.
- **A custom-domain route index.** `status_pages.custom_domain` is stored but no code routes
  on it. Add the index when the feature is built, not before.

---

## 6. Read and write flows

### 6.1 The check (write path)

```text
MonitorDO.alarm()
 1. read local state: lifecycle, lease, next_due_at, last executed slot     [~3 rows read]
 2. if lifecycle is not `active` or the lease has expired -> §13, return
 3. if the slot has already been executed (alarm retry) -> re-arm, return
 4. probe from this object's own region (fetch / connect / DoH)
 5. INSERT INTO results VALUES (checked_at, ...)                            [1 row written]
 6. detect the transition against the newest previous row                    [1 row read]
 7. next_due_at = advance(next_due_at, interval) until > now
    ctx.storage.setAlarm(next_due_at)                                        [1 row written]
 8. once a day: DELETE FROM results WHERE checked_at < cutoff   [1 row written per row]
                upsert the daily rollup                                      [1 row written]
 9. ctx.waitUntil(projectIfDue())          -> TenantDO RPC, only when warranted
10. ctx.waitUntil(enqueueNotification())   -> Queue, only on a transition
```

Steps 5 and 7 are the only unconditional writes. Step 8 amortises to one write per check.

**Why the state row disappears.** The proposal lists "current status / last checked time /
last response time / last observed value" as stored `MonitorDO` fields. They are all
derivable from `SELECT * FROM results ORDER BY rowid DESC LIMIT 1`, which is one row read on
a table whose rowid _is_ the timestamp. Maintaining them as a separate mutable row costs one
written row per check — **25% of the whole architecture's dominant cost line**, $43.20/month
at 1,000 one-minute monitors — to avoid one row read costing $0.00004. Persist only the state
that is not derivable: lifecycle, lease, `next_due_at`, the executed-slot marker, and the
notification transition state. Update those only when they change.

### 6.2 Monitor list and status page (read path)

```text
GET /:team                     GET /status/:slug
  Worker                         Worker
  -> D1: slug -> team_id         -> D1: slug -> (team_id, page_id)
  -> D1: membership              -> TenantDO(team_id).statusPage(page_id)
  -> TenantDO(team_id).list()       -> one local SELECT joining the page's
     -> one local SELECT over          attachment tables to the catalog
        the catalog                 -> rendered, cached 60 s + SWR 300 s
```

No `MonitorDO` is contacted. A monitor detail page — the chart, the recent-results table, the
uptime bar — reads that one `MonitorDO` directly, which is one extra hop and the only place a
`MonitorDO` is on a request path.

### 6.3 Tenant configuration change (fan-out down)

Alerts and maintenance windows are tenant-scoped but are read on the alert path, which runs
inside `MonitorDO`. Two options, and the choice is not obvious:

| Option                                  | Cost per check                                                       | Cost per config edit                                 | Staleness               |
| --------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------- |
| **RPC up to `TenantDO` on every alert** | 1 DO request + ~135 ms duration, **only when an alert is warranted** | 0                                                    | none                    |
| **Project down to every `MonitorDO`**   | 0                                                                    | N DO requests + N writes, N = monitors in the tenant | until the fan-out lands |

Alerts fire rarely (0 on a healthy check, by design), and configuration edits are rarer still
but touch every monitor. **RPC up is the right default**: it costs nothing in the steady
state, is never stale, and needs no fan-out consistency story. Project down only if
measurement shows alert-path latency matters, and then only for the "suppress everything"
maintenance-window case, which is the one that can be represented as a single boolean plus a
time range.

This is a correction to the proposal, which implies the `MonitorDO` holds its own copy.

### 6.4 Projection up to `TenantDO`

Immediately on: status change, enable/disable, configuration change, entering an error or
terminal lifecycle state. Otherwise at most once every N checks (N = 15 modelled).

Always after the local write has committed, always under `ctx.waitUntil`, and never allowed
to fail the check: a failed projection leaves the catalog showing the previous status until
the next projection, which is a stale badge, not a lost check. §19.5 prices the difference
between projecting every check and projecting every fifteenth: **$95/month at 1,000 monitors,
a 45% increase on the whole architecture**. Projecting on every check is not a defensible
default.

---

## 7. Durable Object identity and placement

**Name.** `MonitorDO`: `${teamId}/${monitorId}`. Deterministic, human-readable in logs,
collision-free, and re-derivable from the catalog row without storing anything. Store the
`idFromName` result as a string too, because `idFromString` is what the administrative GC
needs and what survives a rename of the naming scheme.

`TenantDO`: `${teamId}`.

**Placement.** A location hint is honoured _only on the first `get()` that creates the
object_, and an object never moves afterwards. Two consequences:

1. **Every code path that can be the first to touch a `MonitorDO` must pass the correct
   `locationHint`.** Not just creation — a migration backfill, an admin tool, or a GC probe
   that reaches an object before its creator does will pin it to the wrong region
   permanently. The safe shape is one accessor function that is the only place `get()` is
   called, and that takes the monitor's region as a required argument.
2. **Region becomes immutable.** That matches the proposal. Changing a monitor's region is
   creating a new monitor, and the product should say so.

The jurisdiction branch survives unchanged: `weur`/`eeur` mint from `jurisdiction("eu")`, and
the id must be minted from the same namespace it is fetched from (ADR-013). Under the
proposal that branch becomes _more_ significant, because the object now has storage — an EU
jurisdiction pin on a `MonitorDO` is a real data-residency statement, unlike the current
stateless proxy where ADR-013 left the question open. **This makes the open question in
ADR-013 answerable and mandatory: a monitor pinned to `eu` will store 90 days of results in
the EU, and one that is not, will not.**

**`TenantDO` placement is the unsolved half.** The proposal says nothing about it. A
`TenantDO` created without a hint lands near whoever created it — the owner's signup colo.
A tenant whose monitors are all in `apac` and whose `TenantDO` is in `wnam` pays a
cross-Pacific round trip on every projection, forever, with no way to move it. Options:

- Hint the `TenantDO` to the owner's colo at signup (best for dashboard latency).
- Hint it to the modal region of the tenant's monitors (best for projection cost) — but that
  is unknown at creation.
- Accept the default and make projections rare enough that the RTT does not matter, which is
  what §6.4 already recommends.

The third is the only one that works without a decision that cannot be revised. It is another
argument for a low projection frequency.

---

## 8. Scheduling and alarm semantics

### 8.1 What must be preserved

| Guarantee today                               | How it must be preserved                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| No duplicate logical execution per interval   | An `executed_slot` marker: the alarm records the scheduled slot it executed and short-circuits on a repeat.      |
| Idempotent retry                              | Same marker; plus `alarmInfo.isRetry` / `retryCount` to distinguish a retry from a fresh slot.                   |
| Stable cadence anchored to the schedule       | `next = advance(previous_next, interval)` — the same closed form as `claimDue`, computed locally.                |
| Delayed alarms do not cause a catch-up storm  | Advance by whole intervals **until strictly past now**, then stop. One check, not sixty.                         |
| Slow checks do not push their own cadence out | Compute and `setAlarm` the next slot from the _previous slot_, not from completion time.                         |
| Safe enable/disable                           | Disable: `deleteAlarm()` + lifecycle `disabled`. Enable: lifecycle `active` + `setAlarm(now)`.                   |
| No alarm resurrection after deletion          | `destroy()` sets lifecycle `deleted` _before_ `deleteAll()`; the alarm handler returns immediately on `deleted`. |
| No retry storm on terminal state              | The handler never throws on a terminal state; it returns without re-arming.                                      |

**Anchor from the previous scheduled slot, not from completion.** This is the property
ADR-003 was written to obtain and it is the easiest one to lose in a rewrite: the natural
shape inside an alarm handler is `setAlarm(Date.now() + interval)`, which reintroduces exactly
the drift ADR-003 removed — each check's own latency added to the next interval, turning a
1-minute monitor into a 1-minute-plus-probe-latency monitor.

### 8.2 At-least-once delivery

Alarms are guaranteed at-least-once with automatic retry on a thrown handler: exponential
backoff from a 2-second delay, **up to 6 retries**. Two consequences:

1. **A retry re-enters the handler after the probe may already have run.** The commit point
   is the result insert; everything before it must be safe to redo and everything after it
   must be idempotent. The `executed_slot` marker written in the same transaction as the
   insert is what makes a retry cheap: it reads the marker, sees the slot is done, re-arms,
   and returns without probing.
2. **After 6 retries the alarm is gone and the monitor is silent.** Cloudflare's own guidance
   is to catch inside the handler and set a new alarm before returning. That is necessary but
   not sufficient — a bug in the catch path, an object that fails to construct, or a storage
   error during `setAlarm` itself all end the chain. See §16.1.

### 8.3 Cron monitors get cheaper, not just different

Today, `CheckCronJobsJob` evaluates _every actionable cron monitor every minute_, regardless
of that monitor's schedule. A daily cron job is examined 43,200 times a month to notice one
missed run. Under the proposal, a cron `MonitorDO` sets its alarm at
`next_expected_at + grace_period`, so it wakes **once per expected occurrence**. For a daily
job that is 30 wake-ups a month instead of 43,200. This is the single largest structural
efficiency the proposal gains that has nothing to do with storage, and the brief does not
mention it.

---

## 9. Authorization and routing

```text
session cookie ──▶ subject id
                     └─▶ D1 memberships(subject_id)  ─▶ [team ids]
                            └─▶ D1 teams(slug|id)    ─▶ team id
                                   └─▶ TenantDO(team).authorize(subject) ─▶ role
API key ──▶ sha256 ─▶ D1 api_keys(key_hash) ─▶ (team id, scopes, expiry)
                            └─▶ TenantDO(team)
status page ──▶ D1 status_page_routes(slug) ─▶ (team id, page id)
                            └─▶ TenantDO(team).statusPage(page)
cron ping ──▶ API key ─▶ team ─▶ TenantDO(team).resolveMonitor(id) ─▶ MonitorDO
invite link ──▶ D1 invite_routes(invite_id) ─▶ team id ─▶ TenantDO(team)
```

**What must be duplicated, and what must not.**

- `memberships` is duplicated: D1 holds `(subject_id, team_id)` as the inverse index — the
  only way to answer "which teams" without enumerating tenants — and the `TenantDO` holds the
  role, which is the authorisation decision. Duplicating the _edge_ is unavoidable;
  duplicating the _role_ would create two authorities for one answer. Write order: `TenantDO`
  first (authority), then the D1 index (discovery). A crashed write leaves a team the user
  can access but cannot find, which is repairable by a sweep; the reverse would leave a team
  they can find but not enter, which reads as a bug.
- API-key **scopes** belong in D1 alongside the hash, even though the key is a tenant
  resource. Putting them in the `TenantDO` makes every API request two hops before it can be
  rejected, which is exactly backwards: a request that fails authorisation should cost less
  than one that succeeds. The `TenantDO` keeps the management view (name, prefix, last used)
  and D1 keeps the decision inputs.
- Status-page slugs must stay globally unique, so the uniqueness check is a D1 write against
  a unique index, taken _before_ the `TenantDO` accepts the page.

**Never enumerate tenants.** Any feature phrased as "across all teams, find …" must be
answered by a D1 projection or Analytics Engine. There is no supported way to iterate
`TenantDO`s cheaply, and the namespace listing API (§15) is an administrative tool, not a
query engine.

---

## 10. Monitor creation lifecycle

There is no distributed transaction between two Durable Objects, so creation is a state
machine whose every step is idempotent and re-drivable.

```text
1. TenantDO.createMonitor(input)
     validate against plan limits (local, strongly consistent)
     monitorId = uuid
     objectName = `${teamId}/${monitorId}`
     objectId   = env.MONITOR.idFromName(objectName).toString()      // no get() yet
     INSERT catalog row (lifecycle = 'creating', created_at, object_id, object_name, region)
     -- returns to the caller here; the rest is driven by the TenantDO alarm if it fails
2. TenantDO -> D1: INSERT durable_object_registry + monitor_routes   (idempotent upsert)
3. TenantDO -> MonitorDO.initialize({config, teamId, monitorId, lease: SHORT})
     first get() and therefore the ONLY chance to set locationHint
     MonitorDO: write config, lifecycle = 'creating', lease = now + 15 min, NO alarm
4. TenantDO: UPDATE catalog SET lifecycle = 'active'
5. TenantDO -> MonitorDO.activate({lease: NORMAL})
     MonitorDO: lifecycle = 'active', lease = now + 7 days, setAlarm(now)
```

Failure between any two steps:

| Fails after | Observable state                                     | Recovery                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1           | Catalog row `creating`, no object                    | `TenantDO` alarm retries from step 2. `idFromName` is deterministic, so retrying mints the same id.                                                                                        |
| 2           | Registry row, no object                              | Retry from step 3.                                                                                                                                                                         |
| 3           | Object exists, `creating`, short lease, **no alarm** | Retry from step 4. If the tenant never retries, the object never checks and its 15-minute lease expires — it self-deletes. This is the partial failure the short initial lease exists for. |
| 4           | Catalog `active`, object `creating`                  | Retry step 5. The object is inert until activated, so nothing runs early.                                                                                                                  |
| 5           | Catalog `active`, object `creating`, lease expiring  | The object's own lease check contacts the `TenantDO`, learns it is `active`, self-activates. Two paths to the same state, both idempotent.                                                 |

**`idFromName` before `get`.** Minting the id without calling `get()` is what lets step 1
commit a catalog row that names an object that does not yet exist. It also means the
`locationHint` must be attached at step 3 and nowhere else.

Lifecycle states, as proposed and unchanged: `creating`, `active`, `disabled`, `deleting`,
`failed`, `deleted`.

---

## 11. Monitor deletion lifecycle

```text
1. TenantDO: UPDATE catalog SET lifecycle = 'deleting'
2. TenantDO -> MonitorDO.destroy()
     MonitorDO: lifecycle = 'deleted' (persisted first, so a concurrent alarm returns)
                ctx.storage.deleteAlarm()
                ctx.storage.deleteAll()
                return { ok: true }
3. TenantDO: DELETE catalog row (or tombstone it for a retention window)
4. TenantDO -> D1: DELETE registry + route rows
```

`destroy()` must be idempotent: an object that has already been destroyed has no storage, so
it reconstructs empty, finds no lifecycle row, and returns `{ ok: true }` — "there is nothing
here" and "I deleted it" are the same answer to the caller.

**Alarm deletion semantics for this repository's compatibility date.** `deleteAll()` deletes
the alarm for Workers with a compatibility date of **2026-02-24 or later**; before that it did
not, and `deleteAlarm()` was required separately
([changelog](https://developers.cloudflare.com/changelog/post/2026-02-24-deleteall-deletes-alarms/)).
`wrangler.jsonc` declares `2026-04-10`, so `deleteAll()` alone is sufficient here. **Call
`deleteAlarm()` explicitly anyway.** It costs one write on a path that runs once per monitor
lifetime, it makes the ordering legible without knowing the compatibility date, and it removes
a silent dependency between a config value and a correctness property.

If step 2 fails, the catalog stays `deleting` and the `TenantDO` alarm retries with backoff.
A monitor stuck in `deleting` past a threshold is escalated to the orphan-candidate table
rather than being silently forgotten.

**Cost of deletion.** Whether `deleteAll()` is billed as one operation or as one row written
per deleted row is **not documented**. Worst case, a 90-day one-minute monitor is 129,600
rows written = **$0.13 per deletion**. Bounded and acceptable, but it should be measured
before any bulk migration that deletes objects.

---

## 12. Tenant deletion lifecycle

Today `Team.deleteById` is ~25 sequential D1 statements in one Worker invocation. Under the
proposal it becomes a driven, resumable process, because deleting 500 monitors is 500 RPCs.

```text
1. Global D1: teams.lifecycle = 'deleting'   (blocks routing to a new monitor)
2. TenantDO.beginDeletion()
     lifecycle = 'deleting'; every create path rejects from here on
     mark every catalog row 'deleting'
     setAlarm(now)
3. TenantDO.alarm() while monitors remain:
     take the next batch of <= 50 'deleting' monitors
     Promise.allSettled(destroy())
     delete the rows that succeeded, count failures, persist progress
     setAlarm(now + backoff)          -- bounded batches, resumable, no 15-min overrun
4. When no monitors remain:
     TenantDO: ctx.storage.deleteAll(); deleteAlarm()
5. Global D1: delete registry rows; replace the team row with a tombstone
```

The **tombstone** is what prevents resurrection: a request that arrives after step 4 with a
cached team id must not create a fresh, empty `TenantDO` for a deleted tenant. A tombstone
row in D1 with `lifecycle = 'deleted'` answers that; the absence of a row would not, because
`idFromName` will happily manufacture a new object.

Batch size 50 and a 15-minute alarm wall time are the two bounds. At 50 destroys per alarm
and one alarm per few seconds, a 5,000-monitor tenant drains in minutes; a tenant whose
monitors are unreachable retries with backoff and surfaces in the GC.

---

## 13. Lease design

Stored on the `MonitorDO`:

```text
monitorId, teamId, objectId, objectName,
lifecycleState, leaseExpiresAt, lastOwnerValidationAt, createdAt
```

| Parameter                         | Value                                                   | Reasoning                                                                                                          |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Initial lease (before activation) | 15 minutes                                              | Short enough that a creation that failed between steps 3 and 5 self-cleans quickly; long enough to absorb a retry. |
| Normal lease                      | 7 days                                                  | Proposal's value. Bounds "how long can an orphan keep running" to a week.                                          |
| Validation interval               | 24 hours                                                | One `TenantDO` RPC per monitor per day. Modelled cost at 1,000 monitors: **$0.04/month** — free.                   |
| Transient failure policy          | Do not shrink the lease                                 | One failed RPC is a network blip, not a deletion. Retry on the next validation.                                    |
| Explicit `deleting`/missing       | Stop immediately, self-destroy                          | The tenant is the authority and has spoken.                                                                        |
| Lease expired, cannot renew       | Stop scheduling, then self-destroy after a grace period | The invariant below.                                                                                               |

**The invariant:** _a `MonitorDO` must not be able to stay alive indefinitely by renewing its
own alarm._ Enforced by making the alarm handler's first act a lease check: if
`leaseExpiresAt < now`, do not probe, attempt one renewal, and if that fails, stop re-arming.
An object that cannot reach its tenant for seven consecutive days stops on its own.

**A newly created object begins inert.** `initialize()` writes configuration and the short
lease but **sets no alarm**. Only `activate()` arms it. This is what makes the
"tenant crashed after initialising the object" case safe: an unactivated object never probes,
never bills, and expires.

**One thing the lease does not solve.** The lease protects against a monitor outliving its
tenant. It does not protect against the opposite — a monitor that has stopped and whose
tenant does not know. That is §16.1.

---

## 14. Orphan prevention

Four layers, in the order they should be trusted:

1. **Explicit deletion** (§11) — the normal path, covering everything but a crash.
2. **Ownership leases** (§13) — the primary safety net. Bounds an orphan's life to 7 days
   plus a grace period, with no external system involved.
3. **Tenant-driven reconciliation** — the `TenantDO` alarm, when it has pending work, diffs
   its catalog against the registry and retries stuck lifecycle states. Crucially, the alarm
   is **deleted when no work remains**: a permanent hourly tenant alarm at 10,000 tenants is
   7.2M alarm invocations and 7.2M written rows a month for nothing, which is $18/month of
   pure idle.
4. **Administrative GC** (§15) — the final layer, for objects no tenant knows about at all
   and therefore no lease can be revoked from.

The ordering matters because layers 2 and 4 have different failure modes. The lease is
self-contained and cannot produce a false positive that deletes live data — the object
checks with its own tenant. The GC compares against an external registry and _can_ produce a
false positive, which is why it quarantines rather than deletes.

---

## 15. Administrative garbage collection

```text
1. GET /accounts/{id}/workers/durable_objects/namespaces/{ns}/objects?cursor=…
   -> [{ id, hasStoredData }]
2. diff against durable_object_registry (global D1)
3. unknown id -> upsert orphan_candidates (status='seen', first_seen_at, last_seen_at)
4. MonitorDO(idFromString(id)).describe()   -> teamId, monitorId, lifecycle, leaseExpiresAt
5. verify: does the tenant exist? does its catalog know this monitor? has the lease expired?
6. status='quarantined'; do not delete
7. re-check after >= 7 days AND >= 2 consecutive confirming reads
8. confirmed orphan -> destroy(); status='deleted', record the outcome
```

The two tables in the brief (`durable_object_registry`, `orphan_candidates`) are the right
shape. Four operational caveats the brief does not cover:

- **The listing only reports objects with stored data.** Each entry carries
  `{ id, hasStoredData }`. An object that was created but crashed before its first write may
  not appear at all — so enumeration cannot prove absence, only presence. The lease remains
  the primary mechanism precisely because of this.
- **Page size.** The documented example shows `per_page: 20` and the maximum is not stated.
  At 20 per page, 100,000 monitors is 5,000 API calls per sweep, against Cloudflare's global
  API budget of 1,200 requests per 5 minutes per user — roughly 21 minutes of wall clock and
  a real risk of throttling. Verify the maximum `limit` before committing to a sweep cadence;
  plan for weekly, not hourly, and for a resumable cursor persisted between runs.
- **`describe()` on a candidate creates the object if it does not exist.** `idFromString` +
  `get` will instantiate. The `describe()` handler must therefore be able to answer "I have
  no state" without writing anything, and the GC must treat an empty object as "already
  gone", not as "a new orphan".
- **Eventual consistency.** There is no documented freshness guarantee on the listing. A
  just-created object may not appear; a just-deleted one may linger. Steps 6–7 exist for this.

Run the same sweep against both namespaces. `TenantDO` orphans are rarer and more dangerous —
an orphaned `TenantDO` still answers lease-validation RPCs and will therefore keep every one
of its monitors alive.

---

## 16. Failure modes and recovery

### 16.1 The one that must be designed first: a broken alarm chain

Today, a monitor whose check job fails is claimed again on the next cron minute. The
scheduler is external, so a failing monitor cannot remove itself from the schedule. Under the
proposal the schedule _is_ the monitor, and there are at least four ways for it to end:

- Six consecutive alarm-handler throws exhaust the retries.
- A throw inside the catch-and-re-arm path.
- A `setAlarm()` that fails because storage is unavailable at exactly that moment.
- An object that cannot construct at all — a deploy that ships a constructor bug for one
  code path, a corrupt row, a schema migration that throws.

In every case, **the monitor stops and no alert fires, because the thing that would have
detected the outage is the thing that stopped.** For an uptime-monitoring product this is the
worst possible failure: silent, and indistinguishable from "everything is fine".

**Required mitigation — a liveness watchdog.** Every projection carries a `last_alarm_at`. A
cheap daily job scans the global D1 catalog projection (or the `TenantDO`s that have monitors)
for `last_alarm_at < now - 3 x interval` and re-arms those monitors, alerting the operator on
a nonzero count. This is a small amount of work, it re-creates the "external scheduler as a
backstop" property the current architecture gets for free, and **the proposal should not be
implemented without it**.

### 16.2 Other modes

| Failure                                         | Today                                                                    | Proposed                                                            | Mitigation                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| D1 unavailable                                  | All monitoring stops                                                     | Monitoring continues; login and routing stop                        | **Improvement.** Checks and results are unaffected.                                              |
| One tenant's target hangs for `timeout_seconds` | Holds a shared `GeoFetchDO` shard, degrading other tenants in the region | Holds only its own object                                           | **Improvement.** Blast radius = 1 monitor.                                                       |
| Alarm fires while a previous run is still going | n/a                                                                      | Durable Objects serialise; the second alarm queues behind the first | Guard on `executed_slot`; a check slower than its interval skips slots rather than stacking.     |
| Projection RPC fails                            | n/a                                                                      | Catalog badge is stale                                              | Never fail the check on it; next projection repairs. Watchdog catches a permanently failing one. |
| `TenantDO` unreachable during lease validation  | n/a                                                                      | Monitor keeps running on the existing lease                         | Correct direction: never stop monitoring because of a transient RPC failure.                     |
| Subscription revoked                            | One bulk `UPDATE` nulls `next_due_at`; instant                           | `TenantDO` must fan out `pause()` to every monitor                  | **Regression.** See §20.7 — the lease alone gives up to 7 days of unpaid monitoring.             |
| Deploy ships a bad `MonitorDO` constructor      | n/a                                                                      | Every monitor stops at once                                         | Watchdog + gradual rollout. There is no equivalent single point in the current design.           |
| Object storage corrupted                        | n/a                                                                      | One monitor's history lost                                          | PITR (30 days, per object) — see §20.9.                                                          |

---

## 17. Migration strategy

Thirteen phases, each independently deployable and independently revertible. Phases 1–5 are
additive and change no behaviour.

| #   | Phase                                        | What lands                                                                                                                                                                                                                                            | Reversible by                                                                    |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | **Classes and schemas**                      | `MonitorDO` (and later `TenantDO`) classes, SQLite schemas, `wrangler.jsonc` DO migration tag. No traffic.                                                                                                                                            | Removing the binding.                                                            |
| 2   | **Registry and lifecycle**                   | `durable_object_registry`, `orphan_candidates`, `monitor_routes`; `lifecycle_state` and `object_id` columns on the monitor tables, defaulted to `active`/NULL.                                                                                        | Dropping the tables; the columns are inert.                                      |
| 3   | **Dual-write configuration**                 | Every monitor create/edit writes D1 (authoritative) and, best-effort, the `MonitorDO`. Divergence is logged, not fatal.                                                                                                                               | Turning off the second write.                                                    |
| 4   | **Backfill configuration**                   | A bounded batch job creates a `MonitorDO` per existing monitor **with the correct `locationHint`** and populates configuration. Nothing is armed.                                                                                                     | Destroying the objects; D1 untouched.                                            |
| 5   | **Backfill results**                         | Copy retained results into each `MonitorDO`. HTTP has only 7 days in D1 — the older 83 days do not exist as rows and can either be left absent or reconstructed, sampled, from Analytics Engine. **Say which, in the UI, for the transition window.** | Same.                                                                            |
| 6   | **Shadow scheduling**                        | Arm alarms with `shadow = true`: probe, store locally, **no alerts, no metering, no projection**. Both systems check every monitor; the target sees 2× traffic.                                                                                       | Clearing the flag; alarms deleted.                                               |
| 7   | **Compare**                                  | A daily job diffs shadow results against `monitor_results`/AE per monitor: status agreement rate, latency delta, missing slots. Promote nothing until agreement is boring.                                                                            | n/a — read-only.                                                                 |
| 8   | **Cut over selected monitors**               | Per-monitor flag. `MonitorDO` becomes authoritative: alerts, metering and projection on. Start with internal monitors, then one tenant, then a percentage.                                                                                            | Flip the flag back; D1 scheduling resumes from `next_due_at`.                    |
| 9   | **Stop D1 scheduling for migrated monitors** | `next_due_at = NULL` for cut-over monitors, so `claimDue` skips them. This is the moment double-probing stops.                                                                                                                                        | Restore `next_due_at = now`.                                                     |
| 10  | **Move reads**                               | Monitor detail, charts and history read the `MonitorDO`; lists read the projection.                                                                                                                                                                   | Feature flag on the read path.                                                   |
| 11  | **Remove `GeoFetchDO` usage**                | Only after every HTTP monitor is cut over. Keep the class deployed and unused for one release.                                                                                                                                                        | Re-point `HttpCheck.probe`.                                                      |
| 12  | **Remove obsolete machinery**                | `checkHttp`/`checkTcp`/`checkDns`/`checkCronJobs` queue messages, the per-minute cron trigger, the result tables, their indexes, and the AE history queries. Only after a full retention window has passed on the new path.                           | Not cheaply. This is the point of no return; everything before it is reversible. |
| 13  | **GC and reconciliation**                    | Enable the administrative sweep, the watchdog, and the lease validation in enforcing mode.                                                                                                                                                            | Disable the sweep.                                                               |

**Phase 5 is the honest problem.** HTTP monitors have 7 days of rows and 3 months of sampled
Analytics Engine points. There is no lossless backfill of an 83-day history that was never
stored at full fidelity. Either the uptime bar shows a gap for the first 83 days after
cut-over, or it is reconstructed from sampled aggregates and is approximate. Both are
acceptable; silently mixing them is not.

**Phase 6 doubles probe traffic against customer endpoints** for its duration. Some monitored
endpoints are rate-limited. Shadow mode must be opt-in per monitor and time-boxed.

---

## 18. Rollback strategy

| Rolling back from | Action                                                                                                  | Data loss                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2               | Remove binding / drop tables.                                                                           | None.                                                                                                                                                      |
| 3                 | Stop the second write.                                                                                  | None. D1 remained authoritative.                                                                                                                           |
| 4–5               | Destroy the objects, or leave them inert. Inert objects cost storage only.                              | None.                                                                                                                                                      |
| 6–7               | Clear the shadow flag; alarms delete themselves on next fire.                                           | Shadow results, which nothing read.                                                                                                                        |
| 8                 | Flip the per-monitor flag. D1 `next_due_at` is still current, so `claimDue` resumes on the next minute. | Results recorded only in the `MonitorDO` during the window — keep dual-writing results to `monitor_results` through phase 8 so this is genuinely lossless. |
| 9                 | `UPDATE monitors SET next_due_at = ?` for the affected rows.                                            | At most one interval of checks.                                                                                                                            |
| 10                | Read-path flag.                                                                                         | None.                                                                                                                                                      |
| 11                | Re-point the probe.                                                                                     | None.                                                                                                                                                      |
| 12                | **No cheap rollback.** Dropped tables and removed queue consumers are a forward-only step.              | This is why phase 12 waits for a full retention window.                                                                                                    |

The rollback that matters is phase 8, and it is only genuinely free if results are still
being written to D1 during it. That costs the old 8 rows per check for the duration of the
cut-over window and is worth every one of them.

---

## 19. Detailed cost model

### 19.1 Rate card

Workers Paid overage rates, verified **2026-08-02** against Cloudflare's pricing pages.

| Resource                                                    | Included / month |           Overage |          Unit price used |
| ----------------------------------------------------------- | ---------------: | ----------------: | -----------------------: |
| Workers requests                                            |             10 M |         $0.30 / M |                   3.0e-7 |
| Workers CPU                                                 |          30 M ms |      $0.02 / M ms |                   2.0e-8 |
| Queues operations                                           |              1 M |         $0.40 / M |                   4.0e-7 |
| D1 rows read                                                |             25 B |        $0.001 / M |                   1.0e-9 |
| D1 rows written                                             |             50 M |         $1.00 / M |                   1.0e-6 |
| D1 stored data                                              |             5 GB |     $0.75 / GB-mo |                     0.75 |
| KV reads                                                    |             10 M |         $0.50 / M |                   5.0e-7 |
| KV writes/deletes/lists                                     |              1 M |         $5.00 / M |                   5.0e-6 |
| **DO requests** (incl. alarm invocations and RPC sessions)  |              1 M |         $0.15 / M |                   1.5e-7 |
| **DO duration**                                             |     400,000 GB-s |   $12.50 / M GB-s | 1.5625e-9 / ms at 128 MB |
| **DO SQLite rows read**                                     |             25 B |        $0.001 / M |                   1.0e-9 |
| **DO SQLite rows written** (incl. `setAlarm()` and deletes) |             50 M |         $1.00 / M |                   1.0e-6 |
| **DO SQLite stored data**                                   |       5 GB-month | **$0.20 / GB-mo** |                     0.20 |
| Analytics Engine data points                                |             10 M |         $0.25 / M |                   2.5e-7 |
| Analytics Engine read queries                               |              1 M |         $1.00 / M |                   1.0e-6 |
| Resend outbound email                                       |                — |     $0.90 / 1,000 |                   9.0e-4 |

Three facts from these pages that shape everything below:

- **`setAlarm()` is billed as a row written, and so is every delete.** One alarm per check is
  one written row per check, at the same $1.00 per million as a result insert.
- **DO SQLite storage is $0.20/GB-month — 3.75× cheaper than D1's $0.75.**
- **Analytics Engine is not billed today** ("Currently, you will not be billed for your use of
  Workers Analytics Engine"). Every AE figure is a future liability.
- D1 and Durable Object storage have **separate** included allowances. Moving writes from one
  to the other frees D1's 50 M and consumes DO's 50 M.

### 19.2 Modelled quantities and assumptions

Operation counts are read from the implementation. These are the numbers that are modelled,
and each one is an explicit assumption:

| Symbol              |                Value | What it is                                                                       |
| ------------------- | -------------------: | -------------------------------------------------------------------------------- |
| `K`                 |                    2 | every-minute cron deliveries per minute (documented in `Monitor.scheduledJobId`) |
| `B`                 |                   10 | queue consumer batch size ceiling                                                |
| probe               |               250 ms | typical cross-region HEAD probe                                                  |
| spread              |             5,000 ms | queue delivery spread per minute, for `GeoFetchDO` duration amortisation         |
| DO wake             |                30 ms | `MonitorDO` cold construction + SQL init                                         |
| DO local            |                10 ms | local writes per alarm                                                           |
| projection RTT      |               120 ms | mean `MonitorDO` → `TenantDO` round trip, mixed same- and cross-region           |
| Worker CPU          |         8 / 3 / 1 ms | `fetch` / `queue` job / `scheduled`, from `app/lib/cost-rates.ts`                |
| D1 row bytes        |                  200 | `D1_MEAN_ROW_BYTES`, including indexes                                           |
| DO result row bytes | 45 (120 pessimistic) | 4 small integers, rowid = `checked_at`, no secondary index                       |

D1 rows written per statement come from the **live** index set after ADR-010 and ADR-003:
`monitor_results` insert = 4 (table + `id` autoindex + `completed_at_idx` + the 4-column
composite); the claim = 2 (row + `next_due_at_idx`); the cached-status update = 1 (no indexed
column). Eleven per HTTP check, including the eventual delete.

### 19.3 Headline comparison

Gross of included allowances — the scale-invariant figure, and the one that stays true as the
platform grows.

| Scenario                          | Monitors | Checks/mo | Current | Current, `monitor_results` dropped | **Proposed** | MonitorDO only | RegionShardDO |
| --------------------------------- | -------: | --------: | ------: | ---------------------------------: | -----------: | -------------: | ------------: |
| Production today                  |       14 |   232,444 |   $3.88 |                              $2.49 |    **$1.21** |          $1.20 |         $2.50 |
| 10 HTTP @ 1 min                   |       10 |   432,000 |   $6.30 |                              $2.82 |    **$2.14** |          $2.13 |         $3.22 |
| 100 HTTP @ 1 min                  |      100 |    4.32 M |  $59.53 |                             $24.80 |   **$21.37** |         $21.25 |        $17.08 |
| 1,000 HTTP @ 1 min                |    1,000 |    43.2 M | $583.47 |                            $236.23 |  **$213.65** |        $212.54 |       $143.65 |
| Mixed realistic                   |      450 |    10.6 M | $147.36 |                             $88.33 |   **$53.71** |         $53.44 |        $39.29 |
| Large tenant, 500 monitors        |      500 |    21.6 M | $292.63 |                            $119.01 |  **$106.42** |        $105.88 |        $75.00 |
| 500 small tenants, 1,000 monitors |    1,000 |    43.2 M | $589.51 |                            $242.27 |  **$213.92** |        $212.80 |       $143.71 |
| Flapping, 100 @ 10% transitions   |      100 |    4.32 M |  $78.64 |                             $43.92 |   **$40.58** |         $40.31 |        $35.27 |

Net of the account-wide included allowances:

| Scenario                   | Current | Proposed | RegionShardDO |
| -------------------------- | ------: | -------: | ------------: |
| Production today           | $0.1625 |  $0.0378 |       $0.1047 |
| 10 HTTP @ 1 min            | $0.4889 |  $0.0540 |       $0.1117 |
| 100 HTTP @ 1 min           |   $6.14 |    $1.09 |       $0.6004 |
| 1,000 HTTP @ 1 min         | $516.83 |  $156.27 |        $87.10 |
| Mixed realistic            |  $84.88 |    $3.91 |         $2.42 |
| Large tenant, 500 monitors | $231.83 |   $50.45 |        $18.98 |
| Flapping, 100 @ 10%        |  $24.23 |   $18.75 |        $18.20 |

Per unit:

| Scenario            | Current $/monitor/mo | Proposed $/monitor/mo | Current $/1M checks | Proposed $/1M checks | RegionShardDO $/1M |
| ------------------- | -------------------: | --------------------: | ------------------: | -------------------: | -----------------: |
| Production today    |              $0.2774 |               $0.0863 |              $16.71 |                $5.20 |             $10.76 |
| 10 HTTP @ 1 min     |              $0.6296 |               $0.2138 |              $14.57 |                $4.95 |              $7.45 |
| 100 HTTP @ 1 min    |              $0.5953 |               $0.2137 |              $13.78 |                $4.95 |              $3.95 |
| 1,000 HTTP @ 1 min  |              $0.5835 |               $0.2136 |              $13.51 |                $4.95 |              $3.33 |
| Mixed realistic     |              $0.3275 |               $0.1193 |              $13.88 |                $5.06 |              $3.70 |
| Large tenant, 500   |              $0.5853 |               $0.2128 |              $13.55 |                $4.93 |              $3.47 |
| Flapping, 100 @ 10% |              $0.7864 |               $0.4058 |              $18.20 |                $9.39 |              $8.16 |

Per-check cost is **flat in volume** in both architectures. There is no economy of scale to
grow into; the only lever is the per-check operation count.

### 19.4 Where the money actually goes

At 1,000 one-minute monitors (43.2 M checks/month):

| Component                             |     Current |    Proposed | Note                                                     |
| ------------------------------------- | ----------: | ----------: | -------------------------------------------------------- |
| D1 rows written (475 M)               |     $475.38 |       $0.00 | 81% of the current total                                 |
| DO SQLite rows written (179 M)        |       $0.00 |     $178.68 | **84% of the proposed total**                            |
| DO duration                           |       $8.51 |      $20.21 | 2.4× — ADR-009's objection, quantified                   |
| DO requests                           |       $6.48 |       $6.96 | alarm invocations replace queue messages                 |
| Queue operations (130 M)              |      $52.17 |       $0.02 | eliminated                                               |
| Analytics Engine data points (99.6 M) |      $24.90 |       $0.05 | future liability today, real if AE billing starts        |
| Email (6,000)                         |       $5.40 |       $5.40 | unchanged; the one line no architecture touches          |
| D1 rows read (3.2 B)                  |       $3.23 |       $0.00 | never mattered                                           |
| Storage                               |       $1.57 |       $1.17 | 2.1 GB D1 → 5.9 GB DO at 90-day retention, and _cheaper_ |
| Workers requests + CPU                |       $4.03 |       $0.09 |                                                          |
| **Total**                             | **$583.47** | **$213.65** |                                                          |

Proposed, broken down by line inside the dominant component:

```text
setAlarm() writes                            $43.20      (1 row per check)
result inserts                               $43.20      (1 row per check)
current-state updates                        $43.20      (1 row per check)  <- removable
retention deletes                            $43.20      (1 row per check)  <- reducible
DO alarm requests                             $6.48
DO duration (probe inside the alarm)         $19.58
TenantDO projections (1 per 15 checks)        $6.80
lease validation (1/monitor/day)              $0.04
DO storage (5.9 GB @ $0.20/GB-mo)             $1.18
```

**Rows written per check is the whole game.** The ladder, at $1.00 per million:

| Rows | $/1M checks | Design                                                                    |
| ---: | ----------: | ------------------------------------------------------------------------- |
|   11 |      $11.00 | Current D1: claim 2 + insert 4 + status 1 + delete 4                      |
|    4 |       $4.00 | `MonitorDO` **as proposed**: setAlarm 1 + insert 1 + state 1 + delete 1   |
|    3 |       $3.00 | Current D1 with `monitor_results` dropped (ADR-002 §15 change 3)          |
|    3 |       $3.00 | `MonitorDO`, status derived from the newest row — **no state row**        |
|    2 |       $2.00 | `MonitorDO` + partitioned retention (`DROP TABLE` per day) — _unverified_ |
|    2 |       $2.00 | `RegionShardDO`: insert 1 + delete 1, alarm amortised                     |
|    1 |       $1.00 | `RegionShardDO` + partitioned retention — _unverified_                    |

Two of these are worth pursuing and one needs measuring:

- **Drop the mutable state row** (§6.1). Saves $43.20/month at 1,000 monitors, costs one row
  read per check. Unambiguously correct.
- **`checked_at` as `INTEGER PRIMARY KEY`.** In a per-monitor database, results are
  single-monitor and append-only, so the rowid _is_ time order. No `monitor_id` column, no
  `monitor_id` index, no text primary key and therefore no `sqlite_autoindex`. An insert is
  one written row and a time-range query is a rowid range scan — the cheapest thing SQLite
  can do. Checks are ≥60 s apart so collisions are impossible in practice; on the rare
  collision, increment by 1 ms.
- **Partitioned retention.** Whether `DROP TABLE` is billed as rows written is not documented.
  If it is not, day-partitioned result tables cut deletes from one write per check to
  approximately zero — another $43.20/month at 1,000 monitors. **Measure before designing
  around it.**

Applying the first two takes the proposal from $4.00 to $3.00 per million checks on the
dominant line, i.e. **$213.65 → $170.45/month** at 1,000 monitors, and per-check cost from
$4.95 to $3.95 per million.

### 19.5 Projection frequency sensitivity

| Scenario                   | Project 1-in-15 | Project every check |  Delta | Increase |
| -------------------------- | --------------: | ------------------: | -----: | -------: |
| Production today           |           $1.21 |               $1.59 |  $0.38 |     +32% |
| 100 HTTP @ 1 min           |          $21.37 |              $30.90 |  $9.54 |     +45% |
| 1,000 HTTP @ 1 min         |         $213.65 |             $309.00 | $95.35 |     +45% |
| Large tenant, 500 monitors |         $106.42 |             $154.10 | $47.68 |     +45% |

Projecting on every check adds **45%** to the whole architecture. The cost is not the two
written rows in the `TenantDO`; it is the 120 ms of billed duration on _both_ objects while
the RPC is in flight — the caller cannot hibernate while an RPC is outstanding, including
under `ctx.waitUntil`. This is the single most expensive mistake available in the design, and
it is the shape the brief's flow diagram implies.

### 19.6 Durable Object duration: re-pricing ADR-009's rejection

ADR-009 rejected one object per monitor because a shared object amortises duration across
concurrent probes: "four monitors probing through the same object over a 250 ms window cost
250 ms of duration in total, not 1,000 ms." That is still true, and the model reproduces it:

| Monitors | Current (8 shards/region, amortised) | Proposed (one object each) | Ratio |
| -------: | -----------------------------------: | -------------------------: | ----: |
|       10 |                               $0.169 |                     $0.198 | 1.17× |
|      100 |                                $1.69 |                      $2.02 | 1.20× |
|    1,000 |                                $8.51 |                     $20.21 | 2.37× |

ADR-009 was right about the direction and right that the gap widens with density. It was
wrong about the conclusion, for a reason that did not exist when it was written: it priced
duration against an architecture with no per-object storage. **At 1,000 monitors the extra
duration is $11.70/month and the rows-written saving is $296.70/month.** The trade is 25:1 in
favour of per-monitor objects.

Two duration facts worth stating precisely:

- **A pending alarm does not prevent hibernation.** The documented conditions are: no
  `setTimeout`/`setInterval`, no in-progress awaited `fetch()`, no WebSocket API, no
  request/event being processed, no active outbound socket. A pending alarm is none of these.
  An object idle and eligible for hibernation "is not billed for duration, even before the
  runtime has hibernated" — so the 10-second pre-hibernation window is free and a monitor on
  a 1-minute alarm is billed only for the ~290 ms it is actually working. Had this not been
  true, a continuously-resident object would cost 0.125 GB × 2,592,000 s × $12.50/M GB-s =
  **$4.05/month per monitor**, and the whole proposal would be dead.
- **A timeout is the expensive check.** `timeout_seconds` defaults to 10, and the object is
  billed for the whole window: 10,000 ms × 1.5625e-9 = **$1.56e-5 per timed-out check**. A
  monitor down for a full month at 1-minute intervals costs $0.68 in duration alone. That is
  true today as well; what changes is that it is charged to one object instead of degrading a
  shared shard.
- **TCP checks need care.** An active outbound `connect()` socket blocks hibernation and, per
  the docs, can hold an object in memory for up to 15 minutes per connection. Every socket
  must be explicitly closed in a `finally`.

### 19.7 Storage

Per monitor, 90 days of retained results:

| Interval | Rows / 90 d | MonitorDO @45 B | @120 B (pessimistic) | D1 today @200 B | Headroom to the 10 GB per-object cap |
| -------- | ----------: | --------------: | -------------------: | --------------: | -----------------------------------: |
| 60 s     |     129,600 |         5.83 MB |             15.55 MB |        25.92 MB |                                 643× |
| 300 s    |      25,920 |         1.17 MB |              3.11 MB |         5.18 MB |                               3,215× |
| 3,600 s  |       2,160 |         0.10 MB |              0.26 MB |         0.43 MB |                              38,580× |

The per-object cap is not a constraint under any realistic configuration: a one-minute monitor
would need roughly **158 years** of retained checks to reach 10 GB at the pessimistic row size.

The account-wide picture inverts. At 1,000 one-minute monitors, 90 days:

- D1: 26 GB → **impossible**, 2.6× over the hard per-database limit.
- Durable Objects: 5.9 GB spread over 1,000 objects → $1.17/month, and no single object above
  6 MB.

One overhead to remember: every SQLite-backed object has a minimum on-disk footprint of a few
pages. At 1,000 objects that is tens of megabytes and irrelevant; at 1,000,000 objects it is
gigabytes of pure overhead before any data. Worth measuring `databaseSize` on a fresh object
before projecting six-figure monitor counts.

### 19.8 What exhausts first

| Scenario         | Current                 | Proposed                |
| ---------------- | ----------------------- | ----------------------- |
| Production today | **Queues, 131% of 1 M** | DO requests, 31% of 1 M |
| 10 monitors      | Queues, 209%            | DO requests, 46%        |
| 100 monitors     | Queues, 1,375%          | DO requests, 464%       |
| 1,000 monitors   | Queues, 13,042%         | DO requests, 4,638%     |

Queues is the first allowance the current platform exhausts, and it exhausts on **fixed
overhead**: 777,600 operations a month for the three sweep messages sent on every cron
delivery, at any monitor count. That is 78% of the included allowance before a single monitor
exists. The proposal eliminates it entirely.

DO requests become the first exhausted allowance under the proposal, but at $0.15/M this is
the cheapest line in the architecture — $6.96/month at 43.2 M checks. Exhausting an allowance
early is only interesting when the overage is expensive, and here it is not.

A line worth watching that neither architecture makes obvious: **Analytics Engine data points
from the cost ledger itself**. The ledger writes one point per team per unit of work, and the
per-minute scheduler apportions across every team with a monitor due:

| Tenants                   | Cost-ledger AE points/month | % of the 10 M included |
| ------------------------- | --------------------------: | ---------------------: |
| 1                         |                     345,600 |                     3% |
| 100                       |                   4,622,400 |                    46% |
| 500 (capped at 250/point) |                  11,102,400 |                   111% |

At 500 tenants the _measurement_ of cost exceeds its own allowance. AE is unbilled today, so
this is a future liability; the proposal reduces it by ~99% as a side effect of removing the
per-minute fan-out.

### 19.9 Garbage collection, leases and deletion

| Item                                         |                                             1,000 monitors, monthly |
| -------------------------------------------- | ------------------------------------------------------------------: |
| Lease validation (1 RPC/monitor/day)         |                                                               $0.04 |
| Retention deletes (1 row/check)              |                                                              $43.20 |
| Namespace enumeration, weekly, 1,000 objects |                                                         ~free (API) |
| `destroy()` of a 90-day 1-minute monitor     | ≤ $0.13 **per deletion**, worst case if `deleteAll()` bills per row |

Lease and GC overhead is immaterial. Retention deletes are not — they are a quarter of the
whole architecture, which is the strongest argument for measuring the partitioned-retention
option.

### 19.10 Model limitations

- Worker CPU and Durable Object duration are **modelled, not measured**. The runtime exposes
  no CPU API. `X-DO-Wall-Time` is a documented _lower bound_ on billed duration. CPU is ≤2% of
  every total; duration is 9% of the proposed total, so a 2× error there moves the total by
  9%, not by a factor.
- `K = 2` is documented in a code comment, not instrumented. It multiplies current-architecture
  queue operations and scheduler reads, and nothing in the proposal.
- Row-byte estimates for both stores are modelled. `ctx.storage.sql.databaseSize` would make
  the Durable Object side exact — which is itself an argument for the proposal, since
  `D1_MEAN_ROW_BYTES` is the one quantity ADR-007's ledger currently has to guess.
- Polar and Resend subscription fees, the $5 Workers Paid account fee, founder time and
  support are excluded from every figure.
- The model assumes D1 and Durable Object included allowances are separate line items. They
  are documented on separate pricing pages with separate inclusions; confirm on a real invoice
  before relying on the _net_ column.

---

## 20. Risks and tradeoffs

### 20.1 Where a shared D1 query is better

Every one of these is one indexed statement today and becomes a projection to maintain or a
fan-out to avoid:

| Query today                                                  | Under the proposal                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Team-wide "slowest endpoint" and "p99 response time" cards   | Fan-out over N `MonitorDO`s, or a `TenantDO` projection each monitor must push, or keep Analytics Engine |
| Team-wide alert history (`listByAlertIds`)                   | Per-monitor events + a `TenantDO` tail projection                                                        |
| "Which team owns the monitor with this URL?" (support)       | Impossible without a global projection                                                                   |
| "Which tenants are over their plan limit?" (admin)           | Impossible without a global projection                                                                   |
| `countConsumedPingsByTeam` (8 sub-counts, ~14,000 rows read) | **Improvement** — becomes a `TenantDO` counter                                                           |
| Daily reconciliation against Polar                           | Stays in D1, unchanged                                                                                   |
| Status-page slug uniqueness                                  | Stays in D1, unchanged                                                                                   |

The general rule: **every cross-tenant answer becomes either a D1 projection that must be kept
in sync, or a query nobody can run.** The proposal's brief lists "optional global analytics
projections that genuinely require cross-tenant queries" — the list above is what "genuinely"
turns out to mean, and it is longer than optional.

### 20.2 `TenantDO` as a hot object

A Durable Object is a single-threaded actor with a soft limit of 1,000 requests/second.

- A 500-monitor tenant projecting 1-in-15 is 0.6 requests/second. Fine.
- The same tenant projecting **every check** is 8.3 requests/second, plus page views. Still
  fine, but for no benefit (§19.5).
- A 5,000-monitor tenant projecting every check is 83 requests/second, and every one of them
  is serialised behind whatever else the object is doing.
- **The dangerous case is the public status page.** Traffic spikes exactly when the origin is
  least able to absorb it — an incident is when everyone reloads. Today that page is served
  from D1 + a KV cache + a 60 s HTTP cache policy with 300 s stale-while-revalidate. Routing
  it through a single-threaded `TenantDO` puts the tenant's entire read model behind one actor
  during its worst minute, and the same object is simultaneously absorbing a burst of
  status-change projections from every monitor that just went down. **The cache policy in
  front of the status page is not an optimisation under this design; it is load-bearing.**

Mitigation, in order: keep the HTTP cache policy; project on change, not on schedule; consider
having the `TenantDO` write a rendered snapshot to KV on change so the public page never
touches it at all.

### 20.3 Cross-region RPC

Quantified in §19.5: projecting every check costs +45% on the total, almost entirely in billed
duration on both objects while the RPC is outstanding. Beyond cost:

- A `TenantDO`'s location is fixed at creation and cannot be moved. A tenant whose monitors
  live in `apac` and whose object landed in `wnam` pays a cross-Pacific round trip forever.
- Awaiting the projection inside the alarm handler adds the RTT to every check's wall time and
  therefore to its billed duration. Use `ctx.waitUntil`, and accept that it is still billed —
  the object cannot hibernate with an RPC in flight.

### 20.4 Storing all results in the `MonitorDO`

- **Per-object capacity is a non-issue** (§19.7): 643× headroom at the pessimistic row size.
- **Cross-monitor queries are the real loss.** "The slowest endpoint in my team over 24 hours"
  is one Analytics Engine query today and a fan-out tomorrow.
- **Bulk export becomes fan-out.** A GDPR data-export request for a tenant means contacting
  every one of its monitors.
- **Ad-hoc SQL is gone.** `wrangler d1 execute DB --remote --command "SELECT …"` has no
  equivalent. Every diagnostic query needs an admin RPC method shipped in advance, and there
  is no way to ask a question you did not anticipate.

### 20.5 Namespace enumeration

Covered in §15: `hasStoredData` only, default 20 per page with an undocumented maximum, no
freshness guarantee, subject to the account API rate limit, and `describe()` on a candidate
instantiates it. Enumeration proves presence, never absence. Design the GC as a slow
reconciler, never as a source of truth.

### 20.6 Schema migration across many independently activated objects

Active monitors migrate within one interval — every object wakes at least once a minute, runs
its migration guard, and moves on. The problems are the objects that _do not_ wake:

- **Disabled monitors** have no alarm. A monitor disabled for six months misses six months of
  schema migrations and must apply all of them at once when re-enabled. Migrations must
  therefore be a versioned, ordered, replayable chain — not "add a column if missing".
- **A migration that throws** is an alarm that throws, which after six retries is a monitor
  that stops permanently (§16.1).
- **There is no way to ask "how many objects are on version N".** The only answer is a
  projection each object pushes, which means the migration must itself be observable through
  the projection it is migrating.

Versus D1, where a migration is one file, applied once, verifiable in one query. This is a
genuine and permanent increase in operational complexity, and it is the cost that is easiest
to underestimate at design time.

### 20.7 Entitlement enforcement latency

Today, revoking a subscription nulls `next_due_at` for every one of the owner's monitors in
one bulk UPDATE per table. Monitoring stops on the next minute.

Under the proposal, the `TenantDO` must fan out `pause()` to every monitor. If that fan-out
fails or is partial, the lease is the backstop — which means **up to seven days of monitoring
for a revoked subscription**. That is a real revenue leak and a behavioural regression. The
mitigations are a shortened lease for suspended tenants (the `TenantDO` can answer "suspended"
on the next validation) and a retrying fan-out driven by the `TenantDO` alarm. Neither restores
the current "instant, atomic, one statement" property.

### 20.8 Observability and debugging

- Logs become per-object. Correlating a tenant's monitors requires the team id and monitor id
  in every log line, everywhere, from day one.
- `durableObjectsInvocationsAdaptiveGroups` gives per-namespace aggregates; per-object
  attribution is what the application must supply.
- **The cost ledger has to be rebuilt inside the Durable Object.** ADR-007's
  `AsyncLocalStorage` ledger and the D1 statement observer both live in the Worker. A
  `MonitorDO` alarm is a different execution context with a different storage API. The good
  news is that it is _better_ instrumented: `SqlStorageCursor` exposes `rowsRead`/`rowsWritten`
  directly, and `ctx.storage.sql.databaseSize` gives exact stored bytes per monitor — which
  replaces the modelled `D1_MEAN_ROW_BYTES` guess with a measurement. Per-customer cost
  reporting gets _more_ accurate, not less.

### 20.9 Backup and restore

This is the most under-discussed risk in the brief.

| Capability                      | D1 today                       | Durable Object SQLite                                        |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Point-in-time recovery          | Time Travel, 30 days, whole DB | PITR, 30 days, **per object**, via bookmarks                 |
| Restore granularity             | One command, whole database    | One object at a time, `onNextSessionRestoreBookmark`         |
| Bulk restore after a bad deploy | One command                    | **N commands.** 1,000 monitors is 1,000 individual restores. |
| Export                          | `wrangler d1 export`           | No bulk export. Fan-out through an admin RPC.                |
| "Restore the platform to 10:00" | One operation                  | No such operation exists                                     |

A logic bug that corrupts one column across every monitor is a single Time Travel restore
today and an N-object scripted recovery under the proposal. Before committing, write and test
the bulk-restore tool. It is not something to discover during an incident.

### 20.10 Features that become substantially harder

Ranked by how much work they need:

1. Team-wide analytics cards (slowest endpoint, p99, aggregate uptime) — need projections or
   Analytics Engine retained.
2. Team-wide alert history — needs a `TenantDO` tail projection.
3. Bulk restore and export (§20.9).
4. Cross-tenant support and admin queries (§20.1).
5. Instant entitlement enforcement (§20.7).
6. Schema evolution (§20.6).
7. Deleting a team (§12) — from 25 statements to a driven state machine.

And two that get **easier**:

1. Per-team usage counting — a `TenantDO` counter replaces an eight-subquery statement that
   reads ~14,000 rows per dashboard view.
2. Cron-monitor evaluation — from 43,200 evaluations a month per monitor to one per expected
   occurrence (§8.3).

---

## 21. Final recommendation

**Adopt the direction. Change three things about it, and reorder the work.**

### 21.1 Adopt: per-monitor SQLite objects for results and execution

The storage argument holds, and holds sooner than the brief claims: `cron_job_pings` at 365
days puts the 10 GB wall at roughly 95 every-minute cron monitors, and the 90-day DNS/TCP
tables put it at roughly 386. The cost argument holds too — 2.7× cheaper per check, and 3.4×
after the two corrections in §21.3. The isolation argument holds: a hung target degrades one
monitor instead of a regional shard, and D1 being unavailable stops logins rather than
monitoring.

### 21.2 Defer `TenantDO`; keep the catalog in D1 for now

`MonitorDO` alone with the catalog in D1 costs **$212.54/month** at 1,000 monitors against the
full proposal's **$213.65** — the `TenantDO` buys nothing on cost, and it carries the entire
weight of the two-object lifecycle, the projections, the lease-versus-catalog authority
question, the hot-object risk on the status page, and the loss of every cross-tenant query.
Meanwhile D1 without the result tables is small and stays small: at 1,000 tenants × 500
monitors, configuration is roughly 500,000 rows, well under 500 MB.

`TenantDO` remains the right long-term shape, and there are conditions that would justify it:

- The global D1 exceeds ~5 GB of _configuration_ (not results), or
- Per-tenant usage counters and plan-limit enforcement become a measured bottleneck, or
- Tenant-level blast-radius isolation becomes a contractual requirement, or
- Monitor-list latency from D1 becomes a measured product problem that read replicas do not
  fix.

None is true today. Revisit when one becomes true — and note that D1 supports read replication
through the Sessions API while a single `TenantDO` does not, so for a globally distributed
user base D1 may well be the _faster_ read path.

### 21.3 Change the write shape

Three corrections, worth $86/month at 1,000 monitors and more at scale:

1. **`checked_at INTEGER PRIMARY KEY`** for the result table. Rowid = timestamp; no
   `monitor_id` column, no secondary index, no autoindex. One written row per insert.
2. **No mutable current-state row.** Derive status, last checked and last response time from
   `ORDER BY rowid DESC LIMIT 1`. Persist only lifecycle, lease, `next_due_at`, the executed
   slot, and notification transition state — and write them only when they change.
3. **Project on change, and otherwise at most once every N checks.** Never per check; §19.5
   prices that at +45%.

And one to measure before designing around: **day-partitioned result tables with `DROP TABLE`
retention**, which removes another quarter of the cost line if `DROP TABLE` is not billed per
row.

### 21.4 Do not start until three things are designed

- **The liveness watchdog** (§16.1). Without it, the product's core failure mode is silent.
- **The entitlement fan-out** (§20.7). A seven-day lease is not an acceptable billing control.
- **The bulk-restore tool** (§20.9). Write it before you need it.

### 21.5 Reject `RegionShardDO`, on the record

It is the cheapest option modelled — $3.33 per million checks against the proposal's $4.95 —
because it amortises the `setAlarm()` write and the duration window across every monitor it
owns. It is rejected because it reintroduces exactly what this work exists to remove: shared
storage with a shared 10 GB cap, shared blast radius, and a rebalancing problem when a shard
fills. But it should be rejected knowingly, not by assuming per-monitor objects are cheapest.
They are not.

### 21.6 The cost verdict, stated plainly

At today's production scale the entire argument is worth **$3.88 → $1.21 per month gross**, or
$0.16 → $0.04 net. **Cost is not the reason to do this.** The reasons are the 10 GB wall,
tenant isolation, exact un-sampled history, and the removal of a per-minute global scan. The
cost model's real contribution is negative: it establishes that the change does not _cost_
anything, which is what makes the other arguments decisive.

---

## 22. Phased implementation plan

No implementation until this analysis is reviewed and approved.

| Phase  | Scope                                                                                                                                                                                                                                                                                                                                              | Exit criterion                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **0**  | **Measure.** `databaseSize` on a fresh and a filled object; is `DROP TABLE` billed per row; is `deleteAll()` billed per row; maximum `limit` on the namespace listing API; real alarm-handler wall time. Also: fix the unconditional sweep messages in `dispatchCron`, which is 78% of the Queues allowance and independent of this whole project. | Every "unverified" in §19 is resolved or explicitly accepted.              |
| **1**  | `MonitorDO` class, SQLite schema, versioned migration chain, admin `describe()`. No traffic.                                                                                                                                                                                                                                                       | Deployed, zero invocations.                                                |
| **2**  | Global schema additions: `durable_object_registry`, `orphan_candidates`, `monitor_routes`, `lifecycle_state`, `object_id`.                                                                                                                                                                                                                         | Migration applied; columns inert.                                          |
| **3**  | Creation/deletion lifecycle and lease, driven from the existing D1 monitor tables. Dual-write configuration.                                                                                                                                                                                                                                       | An object can be created, activated, described and destroyed idempotently. |
| **4**  | **Liveness watchdog, entitlement fan-out, bulk-restore tool.** Built before anything depends on them.                                                                                                                                                                                                                                              | Watchdog demonstrably re-arms a deliberately broken alarm chain.           |
| **5**  | Backfill: one `MonitorDO` per existing monitor, correct `locationHint`, configuration and retained results.                                                                                                                                                                                                                                        | Every monitor has an object; none is armed.                                |
| **6**  | Shadow scheduling for HTTP only, opt-in per monitor, time-boxed. No alerts, no metering, no projection.                                                                                                                                                                                                                                            | Two weeks of shadow data.                                                  |
| **7**  | Comparison job: status agreement, latency delta, missed slots, cost per check measured against the model.                                                                                                                                                                                                                                          | Agreement is boring; measured cost within 20% of §19.                      |
| **8**  | Cut over HTTP, per monitor: internal first, then one tenant, then a percentage. Results still dual-written.                                                                                                                                                                                                                                        | No regression in alerting, metering or the dashboard.                      |
| **9**  | `next_due_at = NULL` for cut-over monitors. Double-probing stops.                                                                                                                                                                                                                                                                                  | Probe volume halves; cadence unchanged.                                    |
| **10** | TCP, then DNS, then cron monitors through the same 6–9 sequence. Cron last — it is the one whose scheduling semantics change most (§8.3).                                                                                                                                                                                                          | All types on `MonitorDO`.                                                  |
| **11** | Move reads: detail pages, charts, uptime bar, heatmap. Keep the list on the D1 projection.                                                                                                                                                                                                                                                         | Analytics Engine no longer serves user-facing history.                     |
| **12** | Remove `GeoFetchDO` usage; keep the class deployed and unused for one release.                                                                                                                                                                                                                                                                     | No probe path references it.                                               |
| **13** | Remove the per-minute cron trigger, the check queue messages, the result tables and their indexes, and the dead `ssl_monitors` table. **Only after a full 90-day retention window on the new path.**                                                                                                                                               | Point of no return, taken deliberately.                                    |
| **14** | Administrative GC and lease validation in enforcing mode.                                                                                                                                                                                                                                                                                          | A deliberately orphaned object is quarantined, then reclaimed.             |
| **15** | Re-evaluate `TenantDO` against the §21.2 trigger conditions.                                                                                                                                                                                                                                                                                       | A decision, with numbers, either way.                                      |

Phases 1–7 change no user-visible behaviour and are individually revertible. Phase 13 is the
only forward-only step.

---

## Consequences

- **If accepted as recommended:** monitor results, execution and scheduling move into
  per-monitor SQLite Durable Objects; the global D1 keeps every table it has except the four
  result tables and the dead `ssl_monitors`; `GeoFetchDO`, the per-minute cron trigger and the
  check queue messages retire; per-check infrastructure cost falls from ~$13.51 to ~$3.95 per
  million; the 10 GB wall stops being a platform limit and becomes a per-monitor one with
  three orders of magnitude of headroom.
- **Accepted in full as briefed:** everything above, plus one `TenantDO` per team, plus the
  cross-tenant query loss, the hot-object risk on status pages, and the two-object lifecycle —
  for no cost benefit and a real increase in the number of ways the system can be
  half-consistent.
- **Rejected:** the 10 GB wall arrives at roughly 95 every-minute cron monitors or 386
  90-day DNS/TCP monitors, whichever comes first, and the answer at that point is either
  shortening retention (a product regression) or D1-per-tenant (which moves the wall to
  10 GB per tenant without fixing the 11-rows-per-check write amplification).
- Independently of the decision: `dispatchCron` sends three sweep messages on every cron
  delivery whether or not anything is due, which is 777,600 queue operations a month — 78% of
  the included allowance — at any monitor count. That is worth fixing this week regardless of
  which architecture wins.
