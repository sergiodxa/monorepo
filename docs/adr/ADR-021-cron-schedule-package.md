# ADR-021: Cron Schedule Package

## Status

**Proposed** - 2026-07-29

## Background

Cron expressions are a user-facing feature of the uptime product: a cron job monitor is configured with a schedule, and the monitor is considered late when the next expected run passes without a ping. Both the React Router app and its Remix v3 port parse those expressions with `cron-parser` directly inside data models.

The library is small and replaceable, its errors are thrown rather than returned, and the part the product actually needs beyond parsing, turning a schedule into text a user can read in their language, does not exist in it at all.

## Context

### Current State

| Location                                         | Usage                                        |
| ------------------------------------------------ | -------------------------------------------- |
| `apps/r3-uptime/app/data/cron-job.ts`            | `CronExpressionParser` for next expected run |
| `apps/r3-uptime/app/data/monitor.ts`             | Schedule parsing for monitor scheduling      |
| `apps/uptime/app/models/cron-job-monitor.ts`     | Same computation on the React Router stack   |
| `apps/uptime/app/models/monitor.ts`              | Same                                         |
| `apps/uptime` create and update cron job actions | Validation of user-submitted expressions     |
| `apps/uptime/app/routes/api/v1.cron-jobs*`       | Validation on the public API                 |

### Issues Identified

| Issue                                     | Impact                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Parsing throws on invalid input           | Validation paths wrap it in try/catch instead of using the repository's `Result` |
| Duplicated in two apps and in data models | Scheduling semantics are decided per model, not once                             |
| No human description                      | The UI shows raw expressions, or hardcodes English text next to them             |
| Time zone handling is per call site       | A schedule configured in a user's zone and evaluated in UTC can be off by hours  |

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
- **One scheduling semantic** - both stacks compute the next expected run the same way during the port and after it.
- **Translatable descriptions** - the UI can explain a schedule in the user's language without the package shipping copy.
- **Explicit time zones** - the off-by-DST class of bug becomes visible in the type signature.
- **A small dependency is retired** - `cron-parser` disappears from both apps.

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
2. DST transition tests (spring forward skips, fall back does not double-fire).
3. Parity tests against the schedules currently stored by the uptime product.

### Phase 3: Description, Lateness, Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. `describe()` descriptors and `isDue` / `expectedBy`.
2. Replace `cron-parser` in both apps; add i18n keys for descriptor kinds in the Remix v3 app.
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

- [ ] Phase 1: Parser
- [ ] Phase 2: Occurrences
- [ ] Phase 3: Description, Lateness, Adoption

## Notes

- Parity testing must run against the real stored expressions before the library is removed; a difference in next-run computation changes which monitors alert.
- Seconds fields are not supported. Sub-minute schedules are outside what the monitoring product offers, and accepting them would imply a guarantee the runtime cannot keep.
- `Schedule` is immutable and cheap to keep in memory; repositories can parse once and reuse across a request.
