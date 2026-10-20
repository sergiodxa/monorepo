# ADR-037: Browser Performance Traces on Flow Monitors

## Status

**Accepted** - 2026-10-20

Closes the "screenshot / rich artifact on failure" open question from
[ADR-027](./ADR-027-flow-monitors-written-as-executable-specs.md) for one concrete
artifact: Chrome DevTools Protocol Performance traces collected by
`@sdxc/spec`'s `browser.trace.*` tools ([ADR-019](../spec/ADR-019-chrome-devtools-protocol-diagnostics.md)).

## Background

A flow that `use`s `browser` can now call `browser.trace.start` / `browser.trace.stop`
and get a chrome://tracing JSON timeline. Locally that file lands in the test
workspace. In uptime the run has **no filesystem**
(`createNoFilesystemWorkspace`), and the result row only stores assertion text —
so a customer who wrote a deliberate trace in their flow had nowhere to retrieve
it. Screenshots were deferred in ADR-027 for the same reasons (R2, retention,
redaction); traces share that shape and are opt-in in the source, which makes
them the right first artifact.

## Context

| Fact                                                                   | Consequence                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Traces are often 5–50 MB for a short interaction                       | They cannot live in D1; they need object storage                 |
| Flow results are kept 90 days (ADR-020)                                | Binary blobs must have a **shorter** window than the row         |
| The daily team digest already runs once per day at 08:00 UTC (ADR-024) | "Report ready, once per day" fits that cadence                   |
| A flow may only reach verified domains, and often signs in             | Traces can contain page content; downloads stay behind team auth |
| Opt-in via `browser.trace.start` in the source                         | Cost stays proportional to who asked for a recording             |

Retention candidates were **24 hours** and **7 days**. Twenty-four hours races the
daily email: a trace captured at 09:00 Monday is emailed Tuesday 08:00 and would
already be near expiry, and a Friday trace emailed Saturday is gone before Monday.
**Seven days** matches `monitor_results` (ADR-020), gives a week after the email
to download, and still bounds R2 growth for opt-in recordings.

## Decision

### 1. Store one Performance trace per result in R2

When a browser flow run calls `browser.trace.stop`, the Browser Run plugin writes
the JSON through the run's `ArtifactStore`. Uptime supplies a store that buffers
the bytes during the run, then after `recordCheckResult` uploads them to a
dedicated R2 binding `FLOW_TRACES` under:

```
flow-traces/<team_id>/<flow_monitor_id>/<result_id>.json
```

The result row gains a nullable `trace_key` column holding that object key (or
null when the run recorded no trace). At most one downloadable trace per result:
the last `trace.stop` of the run wins. `@sdxc/spec` writes through `artifacts`
when the workspace has no filesystem, so Workers and the CLI share one tool
surface (ADR-019).

### 2. Retention is 7 days, swept with the nightly clean

`CleanJob` (midnight UTC) deletes R2 objects whose result's `checked_at` is older
than seven days, then nulls `trace_key` on those rows. The result row itself
keeps its 90-day window. An R2 lifecycle rule on the `flow-traces/` prefix with
the same 7-day expiry is a belt-and-braces backup; the job is the source of
truth so D1 and R2 stay aligned.

### 3. Download is an authenticated GET on the flow monitor

Any team member can download a run's trace from the flow monitor detail page
(and a matching API route with the existing flow-monitor read permission):

`GET /app/:team/flows/:monitorId/results/:resultId/trace`

The handler checks team membership, loads the result, fetches the R2 object, and
streams it as `application/json` with
`Content-Disposition: attachment; filename="<monitor>-<resultId>.json"`. A
missing or expired object returns 404 with a short message that traces are kept
for seven days. The results card shows a **Download Performance trace** control
only when `trace_key` is set.

### 4. The daily team digest announces new traces

No second email product. The existing daily digest (ADR-024) gains an optional
section listing yesterday's flow runs that produced a still-available trace, each
with the monitor name and a link to the download (or the monitor detail page).
The section is omitted when yesterday produced none, so teams without browser
traces see no change. Unsubscribe and membership stamps stay as they are.

### 5. Opt-in only; no auto-capture on failure

A trace is recorded only when the flow source calls `browser.trace.start` /
`browser.trace.stop`. Auto-capturing every failing browser run is deferred with
screenshots — it would multiply R2 cost and the redaction surface without an
explicit ask in the source.

### 6. R2 cost rides the infra ledger into Polar Cost Insights

R2 is platform cost, not a customer meter — there is no `flow_trace` usage event
and no change to `ping` / `flow_run`. The cost ledger (ADR-007) gains three
append-only resources priced from `@sdxc/cloudflare-pricing/r2`:

| Resource | When recorded |
| -------- | ------------- |
| `r2ClassAOperations` | Each successful `PutObject` in `storeFlowTrace` |
| `r2ClassBOperations` | Each `GetObject` in `readFlowTrace` (including misses) |
| `r2StorageGbDay` | Daily `reportCosts` listing of live `flow-traces/` objects, apportioned by team |

Deletes are free on R2 Standard and are not recorded. The Analytics Engine point
was already full (nineteen resources + priced total = twenty doubles), so R2
quantities ride a second point tagged `blob4 = "r2"`; the daily report merges
both queries before pricing. The rate card version bumps when these resources
are appended.

## Consequences

### Positive

- Customers who instrument a flow get a downloadable chrome://tracing file.
- Retention and the daily digest reuse existing jobs and email habits.
- Cost stays opt-in and time-bounded.
- Per-team R2 spend shows up in Polar Cost Insights next to the rest of the infra ledger.

### Negative

- A new R2 binding and a schema column to migrate.
- Traces can hold sensitive page content; auth on download is mandatory, and
  docs must say traces are short-lived.
- Large uploads count against the Worker subrequest / CPU budget of the check.
- A second Analytics Engine data point per flush when any R2 quantity is non-zero.

### Neutral

- `browser.metrics` and `browser.cdp` stay in-run only; they are not stored.
- Screenshots remain a separate open question; this ADR does not invent a
  general artifact framework beyond traces.

## Implementation Plan

1. `@sdxc/spec`: when `workspace.resolve` refuses a path, `browser.trace.stop`
   writes through `context.artifacts` and returns `{ path, event_count }` with
   `path` naming the artifact key.
2. Uptime migration: `trace_key` on `flow_monitor_results`.
3. `FLOW_TRACES` R2 binding; `flowTraces()` initializer over `@sdxc/file-storage-r2`.
4. `runFlowCheck` accepts / builds an artifact buffer; `recordCheckResult` uploads
   and stores the key.
5. Download route + results-card button; locale strings.
6. `CleanJob` deletes expired objects and nulls keys.
7. Daily digest section for yesterday's traces.
8. Cost ledger R2 resources + overflow AE point; daily storage listing.

## Alternatives Considered

- **24-hour retention.** Rejected: races the daily email and weekend reading.
- **A dedicated "traces ready" email.** Rejected for v1: duplicates ADR-024's
  cadence and unsubscribe surface; a digest section is enough.
- **Store the JSON in D1.** Rejected: size.
- **Signed public URLs.** Rejected: traces often follow a sign-in; keep downloads
  behind the team session / API key.

## References

- [ADR-019 (spec)](../spec/ADR-019-chrome-devtools-protocol-diagnostics.md) — CDP diagnostics tools
- [ADR-020](./ADR-020-retention-for-every-result-table.md) — result retention
- [ADR-024](./ADR-024-team-digest-emails.md) — daily digests
- [ADR-027](./ADR-027-flow-monitors-written-as-executable-specs.md) — flow monitors; deferred screenshots
- [ADR-036](./ADR-036-social-cards.md) — R2 + `@sdxc/file-storage-r2` precedent
