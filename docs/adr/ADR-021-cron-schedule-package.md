# ADR-021: Cron Schedule Package

## Status

**Accepted** - 2026-07-29

## Background

Cron expressions are a user-facing feature of the uptime product: a cron job monitor is configured with a schedule, and the monitor is considered late when the next expected run passes without a ping. The uptime app parses those expressions with `cron-parser` directly inside its data models.

The library is small and replaceable, its errors are thrown rather than returned, and the part the product actually needs beyond parsing, turning a schedule into text a user can read in their language, does not exist in it at all.

## Context

### Current State

| Location                                             | Usage                                        |
| ---------------------------------------------------- | -------------------------------------------- |
| `apps/uptime/app/data/cron-job.ts`                   | `CronExpressionParser` for next expected run |
| `apps/uptime/app/data/monitor.ts`                    | Occurrence counting for the usage projection |
| `apps/uptime/app/http/controllers/actions/cron-jobs` | Validation of user-submitted expressions     |
| `apps/uptime/app/http/controllers/api/cron-job*.ts`  | Validation on the public API                 |

The Remix v3 port replaced the React Router app in place, so there is one stack, not two: everything above lives under `apps/uptime/app/data/…` and `apps/uptime/app/http/…`.

### Issues Identified

| Issue                               | Impact                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Parsing throws on invalid input     | Validation paths wrap it in try/catch instead of using the repository's `Result` |
| Decided inside data models          | Scheduling semantics are chosen per model, not once                              |
| No human description                | The UI shows raw expressions, or hardcodes English text next to them             |
| Time zone handling is per call site | A schedule configured in a user's zone and evaluated in UTC can be off by hours  |

## Decision

Create `@pkg/cron`: a `Schedule` value object with `Result`-based parsing, time-zone-aware occurrence computation, and a structured description suited to translation.

### 1. Parsing Returns A Result

```ts
let result = Schedule.parse("*/15 * * * *");
if (isFailure(result)) return validationError(result.error);
let schedule = result.data;
```

`Schedule.parse()` accepts the standard five-field syntax (minute, hour, day of month, month, day of week) with ranges, lists, steps, names for months and weekdays, and the common macros (`@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`). Anything outside that set fails with a `InvalidCronExpression` carrying the offending field and position, so validation messages can point at the mistake.

### 2. Occurrences Are Time-Zone Aware

```ts
schedule.next({ from, timeZone }); // Date
schedule.next({ from, timeZone, count: 5 }); // Date[]
schedule.prev({ from, timeZone });
schedule.matches(date, { timeZone });
```

The time zone is an explicit argument, matching the convention in `@pkg/dates` (ADR-020). A schedule is stored with the zone the user configured it in; evaluation happens in that zone and returns instants, so DST transitions do not silently shift a daily 09:00 job.

Two DST rules follow from that, and both are chosen so a dead man's switch never expects nothing:

- **A wall time the clock skips still runs**, carried past the jump rather than dropped. This matches Vixie cron, and it means a weekly schedule landing in a spring-forward gap fires an hour late instead of going a week without a run.
- **A repeated wall time fires on the first pass only**, and `prev()` reports the same instant `next()` does. A schedule pinned to a wall-clock hour keeps that local time; one firing every hour keeps its spacing and runs in both passes, because those are different intentions.

### 3. Descriptions Are Structured Data

`describe()` returns a descriptor, and the app's i18n layer supplies the wording:

```ts
schedule.describe();
// { kind: "daily", at: [{ hour: 9, minute: 0 }] }
// { kind: "interval", unit: "minute", every: 15 }
// { kind: "weekly", weekdays: [1, 3, 5], at: [{ hour: 9, minute: 0 }] }
// { kind: "expression" }  // no simpler description available
```

Apps map `kind` to an i18n key and interpolate the numeric fields. `kind: "expression"` is the fallback for schedules with no concise description, and the app shows the raw expression.

`schedule.toString()` returns the normalized expression, for storage and logs only.

### 4. Lateness Helpers

The product question is not only "when is the next run" but "is this monitor late":

```ts
schedule.isDue(lastRun, { now, timeZone, grace });
schedule.expectedBy(lastRun, { timeZone, grace });
```

`grace` accepts a `@pkg/duration` value (ADR-027), which is exactly the tolerance the cron job monitor already models.

## Consequences

### Positive

- **Validation composes with `Result`** - no try/catch around schedule parsing in actions, API handlers, or repositories.
- **One scheduling semantic** - the next expected run, the lateness question, and the usage projection all compute it the same way.
- **Translatable descriptions** - the UI can explain a schedule in the user's language without the package shipping copy.
- **Explicit time zones** - the off-by-DST class of bug becomes visible in the type signature.
- **A small dependency is retired** - `cron-parser` disappears from the app.

### Negative

- **Cron parsing is subtle** - the day-of-month and day-of-week interaction (either-or, not both) and step-with-range edge cases need thorough tests to reach parity.
- **Feature parity is a deliberate cut** - non-standard extensions the library supports are not implemented, so any expression relying on them must be rejected with a clear error.
- **Description coverage is partial by design** - some valid schedules will fall back to the raw expression.

### Neutral

- **Cloudflare's own cron triggers are unaffected** - those schedules live in `wrangler.jsonc`; this package models user-configured schedules.
- **The normalized expression is stable** - stored expressions do not need migrating.

## Implementation Plan

### Phase 1: Parser

**Priority:** High
**Estimated Effort:** 4 hours

1. Field parser with ranges, lists, steps, names, and macros; `InvalidCronExpression` with field and position.
2. Tests including the day-of-month and day-of-week either-or rule.

### Phase 2: Occurrences

**Priority:** High
**Estimated Effort:** 4 hours

1. `next`, `prev`, `matches` with explicit time zones.
2. DST transition tests: a run whose wall time the clock skips is carried past the jump, and a repeated hour does not double-fire.
3. Parity tests against the schedules currently stored by the uptime product.

### Phase 3: Description, Lateness, Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. `describe()` descriptors and `isDue` / `expectedBy`.
2. Replace `cron-parser` in the app; add i18n keys for descriptor kinds.
3. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Keep `cron-parser`, Wrap It In A Package

A thin package that wraps the library with `Result` and a descriptor.

**Rejected because**: the wrapper would carry the dependency into every consumer while still owning the description, lateness, and time zone logic, which is most of the work.

### 2. English Descriptions In The Package

Return ready-made strings such as "Every 15 minutes".

**Rejected because**: user-facing copy in a package cannot be translated by the app's i18n layer, and the uptime product ships in several languages.

### 3. Store Schedules As Structured Data Instead Of Expressions

Replace cron expressions in the product with a structured schedule builder.

**Rejected because**: cron expressions are what users of a dead-man's-switch monitor expect to paste in, and existing monitors already store them. A structured builder could be layered on top later and compiled to an expression.

## References

- [POSIX crontab specification](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/crontab.html)
- [ADR-020: Dates Package With Intl-Only Formatting](./ADR-020-dates-package-with-intl-only-formatting.md)
- [ADR-027: Duration Package](./ADR-027-duration-package.md)

## Current Progress

- [x] Phase 1: Parser
- [x] Phase 2: Occurrences
- [x] Phase 3: Description, Lateness, Adoption

## Adoption Outcome

`cron-parser` is gone from `apps/uptime`; it remains a devDependency of `packages/cron` only, for the parity test that compares the two libraries and is deleted together with it once nothing depends on the library.

What the adoption did, and where it departed from the plan above:

- **`describeCronExpression` was deleted, not translated.** Around sixty lines of hand-rolled English in the data layer (weekday names, a `@midnight` branch `cron-parser` could never have stored, and a fallback that formatted an ISO date into prose) became a `switch` on `describe().kind` in `apps/uptime/app/lib/cron-text.ts`. That module is the only place a descriptor becomes text, so a new descriptor kind is one `case` plus one key per locale.
- **Weekday names, month names and list separators come from `Intl`, not from the locale files.** The descriptor numbers the fields as cron does, so the app asks the platform for the names rather than carrying 19 more strings per language. Times of day render as a zero-padded 24-hour clock, which also means the old "at midnight" wording is now "at 00:00": keeping it would have meant a second key, and a second branch, for every kind that names a time.
- **`validateCronExpression` was deleted rather than ported.** It existed only to turn a throw into a boolean. The actions and the API handlers now call `Schedule.parse` directly and branch on the `Result`. The web surface flashes `cron.error.<reason>` from the locale files; the API returns the failure's own message, which names the reason, the field, and the character index, replacing a bare "Invalid cron expression".
- **Expressions are stored normalized.** Every write persists `toString()`, so a schedule has one spelling in the database and in logs, and untrimmed input cannot be stored. No migration is needed: all seven expressions stored in production already normalize to themselves.
- **`calculateNextExpected` returns `number | null`.** An expression that no longer parses, or a `timezone` the runtime does not know (the column is free-form text), leaves the monitor unscheduled instead of throwing or storing `NaN`.
- **The usage projection walks occurrences one at a time.** `next({ count })` has no horizon, so asking for the safety cap up front would step a daily job over a century of runs; the loop stops at the end of the month, and the cap drops from 100,000 to 45,000 now that a sub-minute schedule cannot be stored.

## Notes

- Parity testing must run against the real stored expressions before the library is removed; a difference in next-run computation changes which monitors alert.
- Seconds fields are not supported. Sub-minute schedules are outside what the monitoring product offers, and accepting them would imply a guarantee the runtime cannot keep.
- `Schedule` is immutable and cheap to keep in memory; repositories can parse once and reuse across a request.
- The lateness helpers (`isDue` / `expectedBy`) are unused by the app so far: the sweep compares the stored `next_expected_at` against the grace period in SQL-loaded rows, and never re-parses the expression. They stay because that comparison is the same arithmetic, and the sweep is the natural place to converge on them.
