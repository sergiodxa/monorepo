# ADR-032: Uptime Reports as CSV Downloads

## Status

**Accepted** - 2026-09-29. Builds on [`@sdxc/csv`](../ADR-101-csv-package.md) and reads the daily
roll-up described in [ADR-001](./ADR-001-analytics-engine-migration.md).

## Background

Uptime is marketed to agencies (`/for/agencies`, "A status page per client"). An agency's
recurring job is telling each client how their sites did last month, usually in a monthly report
built in a spreadsheet. Uptime shows that history in three places: the dashboard's 90-day bars,
the public status page, and the daily and weekly digests ([ADR-024](./ADR-024-team-digest-emails.md)).
None of them produces a file the agency can keep, merge with other data, or forward. Today the
report starts with screenshots or retyped numbers.

The data needed already exists. `monitor_daily_stats` holds one row per monitor per UTC day for
every monitor type and is never swept, so it covers a team's whole history. This ADR turns that
data into two CSV reports, downloadable from the app and readable through `/api/v1`.

## Context

### What a report can read

| Source                                    | Covers                                  | Kept for                             | Fit for a report                          |
| ----------------------------------------- | --------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `monitor_daily_stats`                     | HTTP, DNS, TCP, cron, flow; one row/day | never swept (ADR-001 plans 365 days) | yes: whole days, every type, full history |
| `monitor_results`                         | HTTP checks                             | 7 days                               | no: shorter than a month                  |
| `dns_`, `tcp_`, `flow_monitor_results`    | per-check rows                          | 90 days                              | no: misses a quarter and a year           |
| Analytics Engine `uptime_monitor_results` | HTTP per check                          | about 3 months                       | no: HTTP only, platform-bounded           |
| `alert_events`                            | alert deliveries                        | 90 days                              | no: see incidents below                   |

### Findings that shape the reports

| Finding                                                                                                                               | Consequence                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| There is no incident record. `alert_events` has one row per alert channel per state change, and only for monitors an alert covers     | an incident report built on it would list the same outage once per channel, and nothing for unalerted monitors |
| `monitor_daily_stats` has no `team_id`                                                                                                | reports reach a team's rows through the monitor tables, as `app/data/team-digest.ts` already does              |
| The HTTP roll-up counts `degraded` checks as failures; the dashboard's 24-hour figure counts them as up                               | a report states which definition it uses and ships the raw counts it came from                                 |
| Maintenance windows suppress alerts but do not change uptime anywhere                                                                 | a daily row cannot split its checks into inside and outside a window, so adjusted uptime needs per-check data  |
| `formatUptime` rounds to 1 decimal, the uptime bar to 2                                                                               | the file holds the unrounded figure and the spreadsheet does the formatting                                    |
| `backfill-daily-stats` only rolls up yesterday                                                                                        | a day without a row stays without one; a report counts days with data instead of assuming 100%                 |
| Status pages hold the monitors an agency shows one client                                                                             | "monitors on status page X" is the client filter, with no new grouping model                                   |
| Locales are `en`, `es`, `de`, `fr`, `it`, `ja`; Excel in the four decimal-comma ones splits a `.csv` on `;` and reads `99.95` as text | a spreadsheet download follows the reader's locale; scripts get plain RFC 4180                                 |
| The only download in the app is the account export (`actions/account.ts`, JSON, `no-store`)                                           | reports follow its headers, but as `GET`, since producing one changes nothing                                  |

## Decision

Add two reports, both built from `monitor_daily_stats`, served as CSV from a new team page and
from `/api/v1`:

1. **Uptime summary**: one row per monitor over the chosen range
2. **Daily uptime**: one row per monitor per UTC day in the range

An incident report waits for an incident record (Phase 5).

### Report contents

Both reports share their filters:

| Filter   | Values                                                                                      | Default         |
| -------- | ------------------------------------------------------------------------------------------- | --------------- |
| Range    | whole UTC days, `from` and `to` inclusive, at most 366 days, ending yesterday at the latest | last full month |
| Monitors | every monitor in the team, the monitors attached to one status page, or one monitor type    | every monitor   |

Last month is the default because it is the period an agency reports on. The range ends at
yesterday because today's roll-up has not run yet.

**Uptime summary** columns:

| Column                 | Value                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `monitor`              | the monitor's name                                                                  |
| `type`                 | `http`, `dns`, `tcp`, `cron`, `flow`                                                |
| `target`               | URL, hostname, `host:port`, or the cron job's schedule                              |
| `days_with_data`       | days in the range that have a roll-up row                                           |
| `total_checks`         | sum over those days                                                                 |
| `successful_checks`    | sum                                                                                 |
| `failed_checks`        | sum                                                                                 |
| `uptime_percent`       | `successful_checks / total_checks × 100`, unrounded; empty when there are no checks |
| `avg_response_time_ms` | check-weighted mean of the daily averages; empty for cron                           |
| `max_response_time_ms` | largest daily maximum                                                               |
| `days_down`            | days whose roll-up status is `down`                                                 |
| `days_degraded`        | days whose roll-up status is `degraded`                                             |
| `maintenance_minutes`  | minutes of maintenance windows covering the monitor in the range, overlaps merged   |

**Daily uptime** columns are `date`, `monitor`, `type`, `total_checks`, `successful_checks`,
`failed_checks`, `uptime_percent`, `avg_response_time_ms`, `max_response_time_ms`, `status` and
`maintenance_minutes`. There is one row per roll-up row, so a day without data has no row.

Rules both reports follow:

- **Uptime is check-weighted**, the way the digests compute it (`teamUptime` in
  `send-team-digests.ts`). A monitor down for one of thirty days at a one-minute interval has the
  same figure in the digest, the dashboard bar and the report.
- **Checks are classified as the roll-up classifies them.** For HTTP, `degraded` counts as failed.
  The raw counts are in every row, so a client can see the basis. Aligning the dashboard's 24-hour
  figure with the roll-up is a separate change.
- **Maintenance is reported and does not change uptime.** `maintenance_minutes` comes from the
  maintenance windows scoped to the monitor, expanded with `@sdxc/icalendar/rrule` the way
  `isActiveAt` expands them. Uptime excluding maintenance needs per-check data, which the Durable
  Object design in [ADR-023](./ADR-023-migrate-to-tenant-and-monitor-durable-objects.md) keeps.
- **Current monitors only.** A report lists the monitors the team has now. Deleting a monitor
  removes it from future reports.
- **Days are UTC**, and the date column's header says so, since the roll-up has no other day.

### Two dialects

| Dialect         | Used by                              | Delimiter                                 | Numbers                                         | Headers                       | BOM |
| --------------- | ------------------------------------ | ----------------------------------------- | ----------------------------------------------- | ----------------------------- | --- |
| **Spreadsheet** | the app download, by default         | `;` when the locale's decimal mark is `,` | the locale's decimal mark, no grouping, as text | translated (`ctx.intl.t`)     | yes |
| **Standard**    | the app download on request, the API | `,`                                       | `.` decimal mark, as `number` cells             | the column keys above, stable | no  |

`app/lib/report-dialect.ts` derives the spreadsheet dialect from `ctx.locale` with
`Intl.NumberFormat(locale).formatToParts(1.5)`. `,` is the decimal mark for `es`, `de`, `fr` and
`it`, which then get `;`, while `en` and `ja` get `,`. A new locale gets the right dialect with no
table to update. Spreadsheet numbers are strings, so `@sdxc/csv` writes them as they are. Formula
neutralization only affects string cells that start with `-`, and no report column holds a
negative number.

### Routes

In `routes/web.ts`, under `app.team`:

```ts
/** The report builder: range, monitors, report and dialect, submitted as a GET form. */
reports: get("/app/:team/reports"),
/** The CSV itself; `report` is `uptime-summary` or `uptime-daily`. */
reportDownload: get("/app/:team/reports/:report.csv"),
```

The builder page is a plain `GET` `<form>` whose action is the download route, so submitting it
downloads the file with no JavaScript. The range fields are `<input type="date">` with presets as
links that fill the query string, the monitor filter is a `<select>` listing the team's status
pages and monitor types, and the dialect is a pair of radios. `AppShell` gains a "Reports" entry.

`reportDownload` runs `requireUser` and `requireTeam`, and any member can download. A report
shows nothing a member cannot already see on the dashboard. It is not gated on the subscription
either, the same as the account export, because the history belongs to the team. The query is
parsed with `remix/data-schema`: dates as `YYYY-MM-DD`, `from <= to`, `to` no later than
yesterday, at most 366 days, and a `status_page` or `monitor_type` belonging to the team. A bad
query re-renders the builder with the error instead of downloading an error page.

The response comes from `csv(streamify(...), init)` in `@sdxc/http/response`, with
`Content-Disposition: attachment(filename)` and `Cache-Control: no-store`. The filename is
`<team-slug>-<report>-<range>.csv`, with a whole month written as `2026-08` and any other range as
`2026-08-03_2026-09-01`. It does not change with the locale, so a client receiving the same report
every month gets files that sort together.

### API

`routes/api-groups.ts` gains `GET /api/v1/reports/uptime-summary` and
`GET /api/v1/reports/uptime-daily` with query parameters `from`, `to`, `status_page_id` and
`monitor_type`, behind a new scope `reports:read`, appended at the end of `apiKeyScopes`.

The response format follows `Accept` through `@sdxc/http/negotiate`:

- `text/csv` streams the standard dialect for the whole range, unpaginated
- JSON returns the same rows in the `/api/v1` envelope. The summary is one page, since its size is
  the monitor count; the daily report pages with the cursor pagination of
  [ADR-030](./ADR-030-cursor-pagination-for-api-v1.md), keyed on `(monitor, date)`

Both are documented in `app/http/openapi/`, and `openapi.snapshot.json` is regenerated.

### Reading the rows

`app/data/report.ts` holds the reads, on `ctx.db` like every other data module:

```ts
export namespace Report {
	export interface Filter {
		from: string; // YYYY-MM-DD, inclusive
		to: string;
		statusPageId?: string;
		monitorType?: MonitorType;
	}
}

/** The team's monitors matching the filter, ordered by type then name. */
export function listMonitors(
	db: Database,
	team: Team,
	filter: Report.Filter,
): Promise<ReportMonitor[]>;

/** One aggregate per monitor, in a grouped query per chunk of monitors. */
export function summaryRows(db: Database, team: Team, filter: Report.Filter): Promise<SummaryRow[]>;

/** Daily rows, one monitor at a time, so memory holds one monitor's range. */
export function dailyRows(db: Database, team: Team, filter: Report.Filter): AsyncIterable<DailyRow>;
```

`dailyRows` queries `monitor_daily_stats` by `(monitor_id, monitor_type, date)` for each monitor,
which is the existing index, and yields rows as they arrive. At 200 monitors over 366 days that is
about 73,000 rows, sent as a stream instead of held in memory. `summaryRows` sums in SQL, in chunks
that keep each query under D1's bound-parameter limit. Maintenance minutes come from one read of
the team's windows, expanded once per range.

The download's handler is then:

```ts
let rows = Report.dailyRows(ctx.db, ctx.team, filter);
let dialect = reportDialect(ctx.locale, query.dialect);

return csv(streamify(rows, { columns: dailyColumns(dialect, t), ...dialect.csv }), {
	headers: {
		"Content-Disposition": attachment(reportFilename(ctx.team, "uptime-daily", filter)),
		"Cache-Control": "no-store",
	},
});
```

### Retention

Reports can cover up to 366 days, starting as far back as the team's earliest roll-up row. ADR-001
plans a 365-day retention for `monitor_daily_stats` that nothing enforces today. If that sweep
lands, it must keep at least 13 months, so "the same month last year" stays reportable, and the
builder's earliest selectable date follows it.

## Consequences

### Positive

- **Agencies get a file per client per month** - filter by the client's status page, pick last
  month, and the download opens in the agency's spreadsheet with the client's monitors only
- **The numbers agree with the rest of the product** - the report, the digests and the uptime
  bars all compute uptime from the same roll-up
- **Opens correctly in every supported locale** - a German or Spanish Excel gets columns and
  numbers, not one column of text
- **Scripts get a stable contract** - the API's standard dialect has fixed column keys, and the
  JSON form has the same rows for integrations that do not want CSV
- **No new storage** - reports read what the roll-up already writes

### Negative

- **Day granularity only** - the shortest outage a report can show is "a day with failed checks",
  and a report cannot say when during the day it happened
- **Uptime includes maintenance** - an agency whose client contract excludes scheduled maintenance
  has to adjust the figure itself using `maintenance_minutes`
- **HTTP degraded counts as down** - a monitor that was only slow shows lower uptime in the report
  than in the dashboard's 24-hour figure until the two definitions are aligned
- **D1 reads scale with monitors times days** - a year's daily report for a large team reads tens
  of thousands of rows per download

### Neutral

- **No incident report yet** - it arrives with an incident record, not as a reading of alert
  deliveries
- **Deleted monitors drop out** - reports describe the current team, not its history of monitors
- **Unauthenticated status pages are unchanged** - reports are for the team, not for the public
  status page's readers

## Implementation Plan

### Phase 1: Packages

**Priority:** High
**Estimated Effort:** 5 hours

`@sdxc/csv`, plus the stream-capable `csv` builder and `attachment` in `@sdxc/http/response`, as
described in [ADR-101](../ADR-101-csv-package.md). Each is its own commit.

### Phase 2: Report data

**Priority:** High
**Estimated Effort:** 4 hours

1. Tests first, on `@sdxc/cloudflare-mocks/sqlite`: every monitor type in both reports, a range
   crossing a month boundary, a day without a roll-up row, a monitor with no checks, the status
   page and type filters, another team's monitors never appearing, overlapping maintenance windows
   counted once, a recurring window expanded inside the range
2. `app/data/report.ts` (`listMonitors`, `summaryRows`, `dailyRows`)
3. The uptime percentage computed in `app/lib/uptime-report.ts` beside `formatUptime`, so the
   digests and reports share one division

### Phase 3: Download and builder page

**Priority:** High
**Estimated Effort:** 4 hours

| File                                               | Change                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `routes/web.ts`                                    | `reports` and `reportDownload` under `app.team`                   |
| `app/http/validators/report.ts`                    | the query schema                                                  |
| `app/lib/report-dialect.ts`                        | locale to dialect; column definitions for both reports            |
| `app/http/controllers/app/team/reports.tsx`        | new: the builder page                                             |
| `app/http/controllers/app/team/report-download.ts` | new: the streamed CSV                                             |
| `bootstrap/app.tsx`                                | map both controllers                                              |
| `resources/layouts/app-shell.tsx`                  | "Reports" navigation entry                                        |
| `app/locales/*.ts`                                 | `reports.*` in all six locales: page copy, column headers, errors |

Tests parse each download back with `@sdxc/csv`, in both dialects and in a `;` locale, and assert
the headers, filename and `no-store`.

### Phase 4: API

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `reports:read` in `apiKeyScopes` and the API-key form
2. `/api/v1/reports/uptime-summary` and `/uptime-daily` with CSV and JSON by `Accept`
3. OpenAPI documents and the snapshot

### Phase 5: Incidents

**Priority:** Low
**Estimated Effort:** to be sized in its own ADR

An incident record, opened when a monitor's `last_status` leaves `up` and closed when it returns,
written where the check jobs already update `last_status`. Once it exists, an incident report
(monitor, start, end, duration, the status it reached) joins the two above with the same filters
and dialects.

### Phase 6: Monthly report email

**Priority:** Low
**Estimated Effort:** 3 hours

An opt-in email to a team's admins on the first of the month, with last month's uptime summary
attached in the admin's spreadsheet dialect, and switched off in account preferences like the
digests. `@sdxc/mail` attaches only a calendar part today, so it first gains a general
`attachments` option.

## Alternatives Considered

### 1. Build reports from per-check results

**Rejected because**: HTTP results are kept 7 days, the other types 90, and Analytics Engine about
three months for HTTP only. None covers the month-over-month and yearly ranges an agency reports
on, and extending those retentions multiplies the largest tables.

### 2. Report incidents from `alert_events`

**Rejected because**: rows are deliveries, one per alert channel, retained 90 days, and absent for
monitors no alert covers. The same outage would appear once per channel, or not at all.

### 3. Prorate maintenance out of daily rows

Subtract `maintenance_minutes` from the day's checks in proportion.

**Rejected because**: it invents numbers. A monitor down only outside the window, or only inside
it, would be reported the same way. The figure has to come from checks tagged with whether a
window covered them.

### 4. Always write RFC 4180 with commas

**Rejected because**: Excel in four of the six supported locales opens it as a single column, and
the people receiving these files are the agency's clients, who will not run an import wizard.

### 5. PDF reports

A branded PDF is what some agencies hand to clients.

**Deferred because**: a spreadsheet is what an agency brands, merges and edits before sending,
and CSV is the input to that. A PDF needs rendering in a Worker (Browser Rendering or a layout
engine), which is a separate decision once agencies ask for it.

### 6. Generate reports in a job and store them in R2

**Rejected for now**: a year of daily rows streams within one request, so a queue, a bucket and
a "your report is ready" email would add infrastructure for no gain at current sizes. It becomes
the design if reports ever span multiple years of per-check data.

## References

- [ADR-101: CSV Package](../ADR-101-csv-package.md)
- [ADR-001: Analytics Engine Migration](./ADR-001-analytics-engine-migration.md)
- [ADR-020: Retention for Every Result Table](./ADR-020-retention-for-every-result-table.md)
- [ADR-023: Migrate to Tenant and Monitor Durable Objects](./ADR-023-migrate-to-tenant-and-monitor-durable-objects.md)
- [ADR-024: Team Digest Emails](./ADR-024-team-digest-emails.md)
- [ADR-030: Cursor Pagination for API v1](./ADR-030-cursor-pagination-for-api-v1.md)
- [RFC 4180 - Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180)

## Notes

- Implementation: `Report` is the default export of `app/data/report.ts`, static reads merged
  with a types-only namespace, and each read takes `teamId` like the other data modules.
- Implementation: monitors come out in the product's type order (HTTP, DNS, TCP, cron, flow),
  then by name. Disabled monitors are included, since a monitor paused mid-month has history for
  the days it ran.
- Implementation: rows also carry `monitorId`, which tells same-named monitors apart and keys the
  daily report's API cursor; the CSV leaves it out.
- Implementation: `target` is `url` for HTTP, `domain` for DNS, `host:port` for TCP (an IPv6 host
  bracketed), and `cron_expression` for cron. It is empty for flows, whose only description is a
  spec source that may hold credentials.
- Implementation: a recurring window counts both its one-off range and its pattern's occurrences,
  as `isActiveAt` does; occurrences start at the first one after `created_at`, and
  `ended_early_at` shortens the one-off range only. Minutes are rounded per row, so daily rows can
  sum to a minute more or less than the summary.
- Implementation: routes are `routes.app.team.reports.index` and `.download`. The builder's
  monitor filter is one `<select>` whose value is `all`, `status-page:<id>` or `type:<type>`, and
  the page answers 400 with the problem when a download sent a query back. Presets are links that
  keep the chosen monitors and format.
- Implementation: a query without `from` and `to` means last month, for the download as for the
  builder, so a bookmarked download URL without dates always fetches the previous month.
- Implementation: `app/lib/report-csv.ts` writes both reports for the download and the API; the
  spreadsheet dialect also translates the monitor type and daily status cells.
- Implementation: the API answers CSV only when `text/csv` is preferred over JSON; `*/*` and no
  `Accept` get JSON, and both carry `Vary: Accept`. A query with one of `from` and `to`, or a
  broken range rule, is a 400 `validation-error`; a status page the team does not own is a 404.
- Implementation: the daily JSON cursor holds the boundary row's values (type position, monitor
  name, monitor id, day), so a monitor deleted between pages leaves the rest of the walk in place.
  A page skips the rows of earlier monitors as it streams them; letting `dailyRows` start at a
  monitor would make deep pages cheaper.

## Current Progress

- [x] Phase 1: Packages
- [x] Phase 2: Report data
- [x] Phase 3: Download and builder page
- [x] Phase 4: API
- [ ] Phase 5: Incidents
- [ ] Phase 6: Monthly report email
