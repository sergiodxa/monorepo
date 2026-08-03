# ADR-023: Migration Plan — TenantDO and MonitorDO

## Status

**Accepted** — 2026-08-02. The decision is taken; nothing is implemented yet. This is the
execution plan for it.

[ADR-022](./ADR-022-tenant-and-monitor-durable-objects.md) is the analysis and the cost
model. It is not repeated here — every "why" below is a pointer into it. This document is
the "what, in what order, behind which flag, and how do we get back".

### What this overrides

ADR-022 §21.2 recommended building `MonitorDO` alone and leaving the monitor catalog in D1,
on the grounds that `TenantDO` costs $210.35/month against $209.24 at 1,000 monitors — no
cost benefit — while carrying the two-object lifecycle, the projections, the leases, the
orphan GC and the loss of every cross-tenant query.

**That recommendation is overridden. The full two-object design is being built.** The
argument for it is not cost, and this plan does not pretend otherwise: it is tenant-level
blast-radius isolation, a strongly-consistent per-team read model, and cheap usage counters.
Those are real, they are just not the things the cost model measures.

The consequence is accepted explicitly, so it is not rediscovered in month three: this plan
is roughly twice the work of the deferred variant, and §10's risk register carries the four
risks that exist only because `TenantDO` exists.

### What carries forward from ADR-022 unchanged

These are requirements of this plan, not suggestions. Each is priced in ADR-022.

| Carried forward                                                                 | Where       | Why it survives the decision                                         |
| ------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `checked_at` is the `INTEGER PRIMARY KEY` of every result table                 | §19.4       | One written row per insert; time-range queries become rowid scans    |
| No mutable current-state row — derive status from the newest result             | §6.1, §19.4 | Saves $43.20/month per 1,000 monitors for one row read per check     |
| Project on change, and otherwise at most 1-in-15 checks                         | §6.4, §19.5 | Projecting per check adds **45%** to the whole architecture          |
| Alerts and maintenance windows are RPC'd **up** on demand, not projected down   | §6.3        | Alerts fire rarely; config edits touch every monitor                 |
| `GeoFetchDO` stays; four of its five callers survive                            | §3a         | Ad-hoc ping, quick-check, and both trial probe paths have no monitor |
| The public trial stays in global D1                                             | §5a         | It has no tenant; it is bounded by four product-side knobs           |
| Liveness watchdog, entitlement fan-out, bulk-restore tool are **preconditions** | §21.5       | Each is a regression the design otherwise ships with                 |

---

## 1. Sequencing decision: `TenantDO` first, `MonitorDO` second

Not the order ADR-022's phase list assumed, and the reason is a dependency, not a preference.

`MonitorDO`'s lease is validated against its tenant's catalog. Its activation handshake is
driven by the tenant. Its projections land in the tenant. If `MonitorDO` ships first, all
three have to be built twice — once against D1, once against `TenantDO` — and the second
build happens while monitors are live on the first.

`TenantDO`, by contrast, can be introduced **as a pure projection of D1**: dual-written,
read by nothing, verified by a comparison job. That proves placement, the RPC surface, the
read model and the boot path with zero user-visible risk, and it is reversible by deleting
objects nothing reads.

So:

```text
Track A  independent quick wins            (no dependency on anything below)
Track B  global D1 control plane           registry, routes, lifecycle columns
Track C  TenantDO as a shadow projection   dual-write, compare, then read
Track D  TenantDO becomes authoritative    catalog, alerts, status pages, usage
Track E  MonitorDO shadow, then cutover    per type: HTTP, TCP, DNS, cron
Track F  cleanup, GC, watchdog enforcement
```

Tracks A and B are parallelisable. C must precede D; D must precede E's cutover (E's
scaffolding can start during D).

---

## 2. Target state

### 2.1 Bindings and classes

```jsonc
"durable_objects": {
  "bindings": [
    { "name": "GEO_FETCH", "class_name": "GeoFetchDO" },   // unchanged, stays
    { "name": "TENANT",    "class_name": "TenantDO" },
    { "name": "MONITOR",   "class_name": "MonitorDO" },
  ],
},
"migrations": [
  { "tag": "add-ping-do",    "new_classes": ["PingDO"] },                    // existing
  { "tag": "rename-ping-do", "renamed_classes": [{ "from": "PingDO", "to": "GeoFetchDO" }] },
  { "tag": "add-tenant-do",  "new_sqlite_classes": ["TenantDO"] },           // new
  { "tag": "add-monitor-do", "new_sqlite_classes": ["MonitorDO"] },          // new
]
```

`new_sqlite_classes`, not `new_classes` — a class created on the key-value backend cannot be
converted to SQLite afterwards. Getting this wrong on the first deploy is unrecoverable
without renaming the class, so it is a review checklist item, not a detail.

The existing two migration tags stay listed verbatim. They are already applied server-side
under the `ping` script name, so redeclaring them is a no-op and removing them is not.

### 2.2 What lives where

ADR-022 §5 is the authoritative placement table, including the five trial tables that do not
move and the dead `ssl_monitors` table that gets dropped. Nothing in this plan changes it.

---

## 3. Building blocks that already exist

This is not a from-scratch build. Four pieces are already available and the plan uses them
rather than inventing parallels.

| Piece                        | What it gives us                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pkg/data-table-sqlstorage` | A `remix/data-table` `DatabaseAdapter` over `ctx.storage.sql`. The same models, queries and migration scripts run in a Durable Object as in D1. **Transactions are real and atomic** here, unlike D1 — savepoints included. `executeScript` runs multi-statement migration SQL. |
| `@pkg/cloudflare-mocks`      | `createSqlStorage()` backed by `bun:sqlite`, so a `MonitorDO`'s SQL is executed for real in unit tests — a malformed statement fails in the test, not in production. Also real KV, D1 and queue mocks with `ack`/`retry` semantics.                                             |
| `@pkg/jobs`                  | The `Job` base class, retry/non-retry error types, and the usage tracker the cost ledger hooks (ADR-007, ADR-019).                                                                                                                                                              |
| `remix/data-table`           | Schema definitions shared between D1 and DO SQLite, which is what makes the dual-write phases cheap: one schema module, two adapters.                                                                                                                                           |

The house shape for a per-tenant Durable Object is also already settled and should be
followed rather than re-litigated:

- **Boot inside `ctx.blockConcurrencyWhile`** in the constructor: ensure the meta table, load
  config, run pending schema migrations, re-arm the alarm. No request is served mid-boot.
- **A small RPC surface**, not a `fetch` router: `initialize`, `activate`, `updateConfig`,
  `describe`, `destroy`, plus whatever the object is for.
- **`getByName(name, { locationHint })`** to address the object, with `stub.id.toString()`
  captured into the registry for the GC's `idFromString` path.
- **`getStats()` returning `ctx.storage.sql.databaseSize`**, which is how per-object storage
  becomes a measurement instead of ADR-007's modelled `D1_MEAN_ROW_BYTES` guess.

---

## 4. Schemas

### 4.1 Global D1 — additions

Three migrations, in this order.

**`20260803100000_do_registry.sql`**

```sql
CREATE TABLE durable_object_registry (
  object_id       TEXT PRIMARY KEY NOT NULL,
  namespace       TEXT NOT NULL,          -- 'tenant' | 'monitor'
  object_type     TEXT NOT NULL,
  object_name     TEXT NOT NULL,          -- teamId, or `${teamId}/${monitorId}`
  team_id         TEXT,
  monitor_id      TEXT,
  lifecycle_state TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX durable_object_registry_team_idx ON durable_object_registry (team_id);
CREATE INDEX durable_object_registry_lifecycle_idx
  ON durable_object_registry (lifecycle_state, updated_at);

CREATE TABLE orphan_candidates (
  namespace           TEXT NOT NULL,
  object_id           TEXT NOT NULL,
  first_seen_at       INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL,
  inspected_team_id   TEXT,
  inspected_monitor_id TEXT,
  lease_expires_at    INTEGER,
  status              TEXT NOT NULL,      -- seen | quarantined | confirmed | deleted | cleared
  PRIMARY KEY (namespace, object_id)
);
CREATE INDEX orphan_candidates_status_idx ON orphan_candidates (status, last_seen_at);
```

Per ADR-010, no `*_id_unique` index on a column already declared `PRIMARY KEY`. The
lifecycle index leads with the state because every read is "find the ones stuck in X".

**`20260803100100_monitor_routes.sql`** — `monitor_id → (team_id, type, object_id)`, plus a
`teams.lifecycle_state` column defaulted to `'active'` and a `status_page_routes` projection
of `slug → (team_id, status_page_id)` so the public page resolves without touching a tenant
object it may not be allowed to reach.

**`20260803100200_tenant_liveness.sql`** — the watchdog's read model:
`monitor_liveness (monitor_id PK, team_id, interval_seconds, last_alarm_at, expected_by)`,
indexed on `expected_by`. This is written by the projection path and read by one daily job.
It exists so the watchdog never has to enumerate Durable Objects (§7 Track F).

### 4.2 Global D1 — removals

Only in Track F, and only after a full retention window: the four monitor result tables and
their indexes, and `ssl_monitors` (dead — nothing reads or writes it).

### 4.3 `TenantDO` SQLite schema

```sql
-- Single-row control record. Written by the control plane, read on boot.
CREATE TABLE tenant_meta (
  team_id         TEXT PRIMARY KEY NOT NULL,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,              -- active | suspended | deleting | deleted
  plan_limits     TEXT NOT NULL,              -- JSON: entitlement projection
  schema_version  INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE members (
  subject_id TEXT PRIMARY KEY NOT NULL,
  role       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- The read model. One local SELECT answers the monitor list and every status page.
CREATE TABLE monitor_catalog (
  monitor_id       TEXT PRIMARY KEY NOT NULL,
  object_id        TEXT NOT NULL,
  object_name      TEXT NOT NULL,
  type             TEXT NOT NULL,             -- http | tcp | dns | cron
  name             TEXT NOT NULL,
  region           TEXT NOT NULL,
  lifecycle_state  TEXT NOT NULL,
  enabled          INTEGER NOT NULL DEFAULT 1,
  display_order    INTEGER NOT NULL DEFAULT 0,
  -- projected from MonitorDO; may lag by the projection interval
  status           TEXT,
  last_checked_at  INTEGER,
  response_time_ms INTEGER,
  last_alarm_at    INTEGER,
  projected_at     INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX monitor_catalog_type_order_idx ON monitor_catalog (type, display_order);
CREATE INDEX monitor_catalog_lifecycle_idx  ON monitor_catalog (lifecycle_state);

-- Tenant configuration: one table each, shapes mirroring database/schema.ts.
CREATE TABLE alerts               (...);
CREATE TABLE maintenance_windows  (...);
CREATE TABLE status_pages         (...);
CREATE TABLE status_page_items    (status_page_id, monitor_id, kind, display_name, "order",
                                   PRIMARY KEY (status_page_id, monitor_id, kind));
CREATE TABLE invites              (...);
CREATE TABLE api_key_meta         (...);   -- management view only; the hash index is in D1

-- Counters, replacing an 8-subquery D1 statement that reads ~14,000 rows per view.
CREATE TABLE usage_counters (
  period      TEXT PRIMARY KEY NOT NULL,     -- 'YYYY-MM'
  pings       INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

-- Pending work, so the alarm can be deleted whenever this table is empty.
CREATE TABLE pending_operations (
  id          TEXT PRIMARY KEY NOT NULL,
  kind        TEXT NOT NULL,                 -- create | destroy | pause | resume | delete-tenant
  monitor_id  TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  next_try_at INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX pending_operations_next_try_idx ON pending_operations (next_try_at);
```

The five `status_page_*` join tables collapse into one `status_page_items` with a `kind`
discriminator. Inside a tenant they are the same relation with the same columns; keeping four
of them was a consequence of four separate D1 migrations, not a design.

### 4.4 `MonitorDO` SQLite schema

```sql
CREATE TABLE monitor_meta (
  monitor_id        TEXT PRIMARY KEY NOT NULL,
  team_id           TEXT NOT NULL,
  type              TEXT NOT NULL,
  region            TEXT NOT NULL,
  object_name       TEXT NOT NULL,
  lifecycle_state   TEXT NOT NULL,       -- creating | active | disabled | deleting | failed | deleted
  config            TEXT NOT NULL,       -- JSON, per-type
  interval_seconds  INTEGER NOT NULL,
  next_due_at       INTEGER,             -- NULL = not scheduled; same meaning as today
  executed_slot     INTEGER,             -- last scheduled slot actually executed
  lease_expires_at  INTEGER NOT NULL,
  last_owner_validation_at INTEGER,
  schema_version    INTEGER NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

-- checked_at IS the rowid. No monitor_id column, no secondary index, no autoindex.
-- One written row per insert; a time range is a rowid scan. (ADR-022 §19.4)
CREATE TABLE results (
  checked_at       INTEGER PRIMARY KEY NOT NULL,
  status           INTEGER NOT NULL,     -- small enum, not text
  response_time_ms INTEGER,
  response_status  INTEGER,
  detail           TEXT                  -- NULL on the happy path
);

CREATE TABLE daily_rollups (
  date               TEXT PRIMARY KEY NOT NULL,
  total_checks       INTEGER NOT NULL,
  successful_checks  INTEGER NOT NULL,
  avg_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  p95_response_time_ms INTEGER
);

CREATE TABLE incidents (
  started_at  INTEGER PRIMARY KEY NOT NULL,
  ended_at    INTEGER,
  status      TEXT NOT NULL
);

-- Per-alert cooldown state. Cooldown keys on (alert_id, monitor_id, event_type)
-- today, so the whole decision is local and needs no tenant round trip.
CREATE TABLE alert_state (
  alert_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  last_sent_at INTEGER NOT NULL,
  consecutive  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (alert_id, event_type)
);
```

**There is deliberately no `current_state` table.** Status, last-checked and last-response
come from `SELECT * FROM results ORDER BY rowid DESC LIMIT 1`. This is the single largest
cost decision in the schema (ADR-022 §19.4) and the easiest to undo by accident, so it gets
a comment in the migration and an assertion in the test suite: _a completed check writes
exactly two rows — the result and the alarm._

### 4.5 Schema migrations inside an object

A versioned, ordered, replayable chain, applied in `blockConcurrencyWhile` on boot:

```text
migrations = [ { version: 1, sql: "..." }, { version: 2, sql: "..." }, ... ]
on boot: while schema_version < latest: apply next in a transaction; bump; commit
```

Transactions are atomic in DO SQLite, so a failed migration rolls back rather than leaving a
half-migrated object. Two rules that follow from ADR-022 §20.6:

- **Never "add the column if it is missing".** A disabled monitor can miss six months of
  migrations and must apply all of them, in order, on its next wake.
- **A migration that throws is an alarm that throws**, and six of those end the monitor
  permanently. The boot path catches, records `lifecycle_state = 'failed'`, projects that to
  the tenant, and re-arms — it never lets a migration error escape into the alarm's retry
  budget.

---

## 5. RPC surfaces

Small and explicit. Every method is idempotent; every one that mutates takes enough
information to be safely re-driven.

### `TenantDO`

```text
initialize(meta)                       -> void      control plane -> tenant, idempotent
updateMeta(patch)                      -> void
authorize(subjectId)                   -> role | null
listMonitors(filter?)                  -> CatalogRow[]        one local SELECT
getStatusPage(pageId)                  -> StatusPageView      one local SELECT
createMonitor(input)                   -> { monitorId }       drives §6 of ADR-022
destroyMonitor(monitorId)              -> void
setMonitorEnabled(monitorId, enabled)  -> void
projectMonitor(summary)                -> void      MonitorDO -> tenant, last-write-wins
validateOwnership(monitorId)           -> { state, leaseUntil } | null
alertPolicyFor(monitorId, eventType)   -> { alerts, suppressed }   RPC'd up on demand
recordPings(count, period)             -> void      usage counter
pauseAll() / resumeAll()               -> void      entitlement fan-out
beginDeletion()                        -> void
describe()                             -> AdminMetadata        for the GC
getStats()                             -> { databaseSize }
```

`projectMonitor` is **last-write-wins on `projected_at`**, not an append. An out-of-order
projection from a slow region must not overwrite a newer status with an older one.

### `MonitorDO`

```text
initialize(config, lease)   -> void   writes config, NO alarm — the object starts inert
activate(lease)             -> void   lifecycle=active, setAlarm(now)
updateConfig(patch)         -> void   may re-anchor next_due_at, per nextDueAtPatch's rules
pause() / resume()          -> void
runNow()                    -> Result  the manual "check now" button
readResults(range, limit)   -> Result[]  detail page, chart, uptime bar
destroy()                   -> void   lifecycle=deleted, deleteAlarm(), deleteAll()
describe()                  -> AdminMetadata
getStats()                  -> { databaseSize, rowCount }
alarm()                     -> the check (ADR-022 §6.1)
```

`initialize` not arming the alarm is load-bearing: it is what makes "the tenant crashed
between initialize and activate" a self-cleaning state rather than an orphan that probes
forever (ADR-022 §13).

---

## 6. Flags and kill switches

Every cutover step is a flag, and every flag is readable without a deploy.

| Flag                            | Scope       | Default | Controls                                                        |
| ------------------------------- | ----------- | ------- | --------------------------------------------------------------- |
| `tenant_do.dual_write`          | global      | off     | Writes tenant config to `TenantDO` as well as D1                |
| `tenant_do.read`                | per team    | off     | Monitor list and status pages read the tenant, not D1           |
| `monitor_do.shadow`             | per monitor | off     | Arms the alarm in shadow mode: probe and store, no side effects |
| `monitor_do.authoritative`      | per monitor | off     | Alerts, metering and projection move to the object              |
| `monitor_do.results_dual_write` | global      | **on**  | Keeps writing `monitor_results` in D1 so phase E is reversible  |
| `watchdog.enforce`              | global      | off     | The watchdog re-arms rather than only reporting                 |
| `gc.enforce`                    | global      | off     | The GC destroys confirmed orphans rather than only quarantining |

`monitor_do.results_dual_write` defaults **on** and is the last thing turned off. It costs
the old 8 rows per check for the duration of the cutover and is what makes Track E's rollback
lossless rather than approximately lossless.

---

## 7. The plan

### Track A — independent quick wins (ship now, no dependency)

Nothing here depends on any Durable Object. It is separated so it is not held hostage by a
multi-month programme.

| #   | Work                                                                                                                                                                                                                                  | Exit criterion                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| A1  | Guard the three sweep messages in `dispatchCron` so they are sent only when the sweep has something to do — or move them to their own coarser triggers. 777,600 queue ops/month, 78% of the included allowance, at any monitor count. | Queue operations fall below the included allowance. |
| A2  | Drop the dead `ssl_monitors` table and its two indexes.                                                                                                                                                                               | Migration applied; no code referenced it.           |
| A3  | Decide the trial's two ceilings: a per-day signup cap and a shorter `converts_until`. 3,000 included emails against ~10 per signup; 4.4 GB of `trial_watch_results` at the rate limiter's permitted ceiling (ADR-022 §19.8).          | A number, written down, enforced.                   |

### Track B — global control plane

| #   | Work                                                                                      | Exit criterion                             |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| B1  | The three migrations in §4.1.                                                             | Applied; columns inert.                    |
| B2  | Registry write helpers + a reconciliation read that lists expected objects per namespace. | Unit-tested against a real D1 mock.        |
| B3  | `status_page_routes` and `monitor_routes` backfilled from the live tables.                | Row counts match; a comparison job says 0. |

### Track C — `TenantDO` as a shadow projection

The object exists, is written to, and is read by nothing.

| #   | Work                                                                                                                                                                                           | Exit criterion                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| C1  | `TenantDO` class: boot in `blockConcurrencyWhile`, schema v1, migration chain, `describe`, `getStats`, no alarm.                                                                               | Deployed; zero invocations.                            |
| C2  | Placement decision (ADR-022 §7): hint the object to the owner's colo at creation, and record the hint in the registry so it is auditable. **Irreversible per object** — review before merging. | Written down and implemented in one accessor function. |
| C3  | Provisioner: create a `TenantDO` per existing team, backfill meta, members, catalog, alerts, maintenance windows, status pages, api-key meta. Bounded batches, resumable.                      | Every team has an object; registry rows match.         |
| C4  | Dual-write behind `tenant_do.dual_write`: every tenant-config write goes to D1 (authoritative) and the object (best effort). Divergence logged, never fatal.                                   | Flag on in production for two weeks.                   |
| C5  | Comparison job: diff every tenant's object against D1 daily; report field-level drift.                                                                                                         | Drift is zero for seven consecutive days.              |

**Rollback:** clear `tenant_do.dual_write`. The objects become inert; D1 never stopped being
authoritative.

### Track D — `TenantDO` becomes authoritative

| #   | Work                                                                                                                                                                                                                                                                                                                            | Exit criterion                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| D1  | Flip reads behind `tenant_do.read`, per team: monitor list, status page, alerts, maintenance windows, team settings.                                                                                                                                                                                                            | p95 page latency no worse than the D1 path.                               |
| D2  | **Status-page snapshot to KV.** The tenant writes a rendered snapshot on change; the public page reads the snapshot and never touches the object. This is the hot-object mitigation (ADR-022 §20.2) and it is not optional — an incident is when everyone reloads the status page and when every monitor is projecting at once. | Load test: 1,000 rps against a status page touches the object zero times. |
| D3  | Usage counters move to `recordPings`; retire `countConsumedPingsByTeam`'s eight sub-counts.                                                                                                                                                                                                                                     | Dashboard usage card matches the old figure within 1%.                    |
| D4  | Writes flip: `TenantDO` becomes authoritative for tenant config. D1 keeps only the routing projections (§4.1) and the tables ADR-022 §5 leaves global.                                                                                                                                                                          | D1 tenant-config tables are read by nothing but the comparison job.       |
| D5  | **Entitlement fan-out**: the Polar webhook calls `pauseAll()`/`resumeAll()`, retried from `pending_operations`. The lease is the backstop, not the mechanism (ADR-022 §20.7).                                                                                                                                                   | Revoking a subscription stops checks within one minute, not seven days.   |
| D6  | Tenant deletion state machine (ADR-022 §12), with the D1 tombstone.                                                                                                                                                                                                                                                             | A test tenant with 200 monitors deletes cleanly and is not resurrectable. |

**Rollback:** D1 through D3 are read-path flags. D4 is the first hard step — after it, D1 is
stale. Keep the comparison job running in reverse (object → D1) for one release so D4 has a
restore path.

### Track E — `MonitorDO`, per monitor type

Run the whole sequence for HTTP first. Then TCP, then DNS, then cron. Cron last: its
scheduling semantics change most (ADR-022 §8.3 — from 43,200 evaluations a month per monitor
to one per expected occurrence).

| #   | Work                                                                                                                                                                                                            | Exit criterion                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| E0  | **Preconditions, built before anything is armed**: the liveness watchdog (§4.1's `monitor_liveness` + a daily job), and the bulk-restore tool (ADR-022 §20.9).                                                  | The watchdog demonstrably re-arms a deliberately broken alarm chain.     |
| E1  | `MonitorDO` class, schema v1, migration chain, the §5 RPC surface, `alarm()` per ADR-022 §6.1.                                                                                                                  | Deployed; zero invocations.                                              |
| E2  | Creation and deletion lifecycle (ADR-022 §10, §11) driven by `TenantDO`, with `pending_operations` as the retry driver. `destroy()` calls `deleteAlarm()` explicitly as well as `deleteAll()`.                  | Kill the tenant between every pair of steps; the state machine recovers. |
| E3  | Backfill: one object per monitor, **correct `locationHint`**, config and retained results. One accessor function is the only place `get`/`getByName` is called, and it takes the region as a required argument. | Every monitor has an object; none is armed.                              |
| E4  | Shadow scheduling behind `monitor_do.shadow`, opt-in, time-boxed. **Doubles probe traffic against customer endpoints** — opt-in per monitor, and not for rate-limited targets.                                  | Two weeks of shadow data.                                                |
| E5  | Comparison job: status agreement, latency delta, missed slots, and **measured cost per check against ADR-022 §19**.                                                                                             | Agreement boring; measured cost within 20% of the model.                 |
| E6  | Cut over behind `monitor_do.authoritative`: internal monitors, then one tenant, then a percentage. Results still dual-written to D1.                                                                            | No regression in alerting, metering or the dashboard.                    |
| E7  | `next_due_at = NULL` for cut-over monitors. Double-probing stops.                                                                                                                                               | Probe volume halves; cadence unchanged.                                  |
| E8  | Reads move: detail page, chart, uptime bar, heatmap read the object; the list keeps reading the tenant catalog.                                                                                                 | Analytics Engine no longer serves user-facing history.                   |
| E9  | Trial-to-monitor conversion creates a `MonitorDO` through the same state machine. This puts a Durable Object lifecycle step on the sign-in path (ADR-022 §20.11).                                               | A conversion that fails mid-way retries and completes.                   |

**Rollback:** E4–E6 are per-monitor flags and the D1 scheduler is still current, so flipping
back resumes on the next minute. E7 needs one `UPDATE monitors SET next_due_at = ?`. Nothing
here is lossy while `monitor_do.results_dual_write` is on.

### Track F — cleanup and enforcement

| #   | Work                                                                                                                                                                                                                                            | Exit criterion                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| F1  | Lease validation in enforcing mode (ADR-022 §13): 24-hour validation, 7-day lease, transient failures never shrink it.                                                                                                                          | An object whose tenant is gone stops on its own.               |
| F2  | Administrative GC (ADR-022 §15) behind `gc.enforce`: enumerate, diff, quarantine, re-check after ≥7 days and ≥2 confirming reads, then destroy. Weekly, resumable cursor.                                                                       | A deliberately orphaned object is quarantined, then reclaimed. |
| F3  | Remove `CheckHttpJob`'s use of `GeoFetchDO`. **The class stays** — ad-hoc ping, quick-check and both trial probe paths still need it. Keep one `HttpCheck` with two transports (ADR-022 §20.11).                                                | Scheduled monitors no longer touch it; four callers still do.  |
| F4  | Turn off `monitor_do.results_dual_write`.                                                                                                                                                                                                       | One release of soak.                                           |
| F5  | Remove the per-minute cron trigger, the check queue messages, the four result tables and their indexes. Keep the hourly trial sweep, the trial tables and both daily trial jobs. **Only after a full 90-day retention window on the new path.** | Point of no return, taken deliberately.                        |

---

## 8. Testing

The bar: a bug that would reach production must fail a test, not a code review.

- **Unit** — `MonitorDO` and `TenantDO` against `createSqlStorage()` from `@pkg/cloudflare-mocks`,
  so SQL is really executed. Run with `bun run test` at the root (or `bun test --isolate`);
  a bare `bun test` leaks module mocks between files and invents failures.
- **The write-shape assertion.** A test that counts rows written per completed check and
  fails if it is not exactly two. This is the cost model's load-bearing claim and the easiest
  thing to regress silently.
- **Cadence.** Property-style: for a monitor with interval _i_, delayed by _d_, the next
  alarm is anchored to the previous scheduled slot and is the first slot strictly in the
  future — never completion-time + interval, never a catch-up storm.
- **Idempotency.** Every RPC called twice; every lifecycle step interrupted at each seam.
  Alarm re-entry with `alarmInfo.isRetry` must short-circuit on `executed_slot` and not
  re-probe.
- **Migration chain.** An object at v1 boots to vN through every intermediate step; a
  throwing migration leaves it `failed` and re-armed, not silently stopped.
- **The two probe transports agree** (ADR-022 §20.11). Same target, same classification from
  `MonitorDO.alarm()` and from the `GeoFetchDO` path. This is what keeps the trial's promise
  honest after the split.
- **Comparison jobs are tests in production.** C5 and E5 are the real verification; the exit
  criteria above are written as thresholds on them, not as opinions.

## 9. Observability and cost instrumentation

- Every log line inside an object carries `teamId` and `monitorId`. There is no shared
  database to join on afterwards.
- The cost ledger (ADR-007) must be re-implemented inside the objects. It gets _better_
  there: `SqlStorageCursor` exposes `rowsRead`/`rowsWritten` directly, and `databaseSize`
  replaces the modelled `D1_MEAN_ROW_BYTES` with a measurement. Bump `RATE_CARD_VERSION` when
  the resource set changes.
- Track the four numbers the model is most exposed on: rows written per check, billed
  duration per alarm, projection rate, and lease-validation RPC volume.

## 10. Risk register

Only the risks this plan owns. ADR-022 §20 is the full analysis.

| Risk                                                         | Severity | Mitigation                                                                   |
| ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------- |
| Alarm chain breaks; monitoring stops silently                | Critical | E0's watchdog, built before anything is armed. Non-negotiable.               |
| `TenantDO` hot on a status page during an incident           | High     | D2's KV snapshot; projection on change + 1-in-15.                            |
| Wrong `locationHint` on first `get()` — permanent            | High     | One accessor function, region a required argument; audited in the registry.  |
| `new_classes` instead of `new_sqlite_classes`                | High     | Review checklist item on the wrangler migration tag; unrecoverable if wrong. |
| D4 leaves D1 stale with no restore path                      | High     | Reverse comparison job for one release.                                      |
| Entitlement enforcement latency (7-day lease)                | Medium   | D5's fan-out; lease is the backstop only.                                    |
| Schema migration stalls on long-disabled monitors            | Medium   | Ordered replayable chain; `failed` state is projected and visible.           |
| Bulk restore needed and does not exist                       | Medium   | E0 builds it. PITR is per object with no bulk path.                          |
| Shadow mode doubles probe traffic against customer endpoints | Medium   | Opt-in per monitor, time-boxed, excluded for rate-limited targets.           |
| Cross-tenant queries lost (support, admin, team-wide cards)  | Medium   | Enumerate them before D4 and give each a D1 projection or an AE query.       |

## 11. Open questions — close these in Track A/B

1. Is `DROP TABLE` billed as rows written? If not, day-partitioned result tables remove a
   quarter of the cost line.
2. Is `deleteAll()` billed per row? Bounds monitor deletion at ≤$0.13 worst case.
3. Maximum `limit` on the namespace listing API. Sets the GC's cadence and cursor design.
4. Real alarm-handler wall time and cold-wake cost — the model assumes 30 ms + 10 ms.
5. Fresh-object `databaseSize`: the per-object floor, which matters at six-figure counts.
6. Do D1 and Durable Object included allowances bill separately? Confirm on an invoice.
7. Does the EU jurisdiction pin (ADR-013) now become a data-residency commitment? A
   `MonitorDO` has storage; `GeoFetchDO` did not. This is a product/compliance answer, and
   the migration makes it unavoidable.

---

## Consequences

- Two new Durable Object classes, three namespaces including the surviving `GeoFetchDO`, and
  a global D1 reduced to routing, billing, the object registry and the public trial.
- Per-check cost on the paid path falls from ~$13.43 to ~$3.87 per million (ADR-022 §19.4),
  and the 10 GB wall stops applying to monitor results.
- The programme is roughly twice the deferred variant, and four of §10's risks exist only
  because `TenantDO` does. That was the decision; this plan carries it rather than relitigating
  it.
- Track A is worth doing whatever happens to the rest, and should not wait for it.
- Nothing before D4 is a one-way door. D4, F4 and F5 are; each has a soak period in front of
  it for that reason.
