# ADR-020: Dates Package With Intl-Only Formatting

## Status

**Accepted** - 2026-07-29

## Background

Calendar math lives in app-local utility files: day grids for the uptime heatmap, week grouping, day labels, and "last N days" ranges. Those files are pure, tested, and general, but they are only reachable from the app that happens to contain them.

The Remix v3 port of the uptime app has no equivalent utilities yet, so the same day-grid math is about to be written a second time. That makes extraction time-sensitive rather than merely tidy.

## Context

### Current State

| Location                                        | What it does                                     |
| ----------------------------------------------- | ------------------------------------------------ |
| `apps/uptime/app/utils/days-of-year.ts`         | Every day in a year as a grid source             |
| `apps/uptime/app/utils/days-of-last-n-days.ts`  | Rolling window of the last N days                |
| `apps/uptime/app/utils/group-dates-per-week.ts` | Groups a day list into weeks for heatmap columns |
| `apps/uptime/app/utils/get-day-label.ts`        | Human label for a heatmap cell                   |
| `apps/uptime` and `apps/auth`                   | `date-fns` for arithmetic and formatting         |
| `apps/blog` and `apps/uptime` route modules     | `@internationalized/date` for date pickers       |

### Issues Identified

| Issue                                      | Impact                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Day-grid math is app-local                 | The in-flight Remix v3 port must copy or rewrite it                    |
| Two date libraries plus ad-hoc `Date` math | Three ways to express the same operation                               |
| Formatting is library-driven               | Locale output depends on library locale data instead of the platform's |
| Time zone handling is implicit             | Some helpers assume UTC, others the runtime zone, and neither says so  |

## Decision

Create `@pkg/dates`: pure date operations over the platform `Date`, with all human-facing formatting delegated to the `Intl` API and time zone always an explicit argument.

### 1. Formatting Is Intl Only

Every formatter is a thin, typed wrapper over `Intl`, so locale data, month and weekday names, and format patterns all come from the platform:

```ts
formatDate(date, { locale, timeZone, dateStyle: "medium" });
formatTime(date, { locale, timeZone, timeStyle: "short" });
formatDateTime(date, { locale, timeZone });
formatRange(start, end, { locale, timeZone });
formatRelative(date, { locale, now });
formatDuration("90 minutes", { locale });
formatParts(date, { locale, timeZone });
```

`formatRelative()` uses `Intl.RelativeTimeFormat` and picks the largest sensible unit. `formatRange()` uses `Intl.DateTimeFormat#formatRange`. `formatDuration()` renders a length rather than an instant, using `Intl.NumberFormat` unit styles joined with `Intl.ListFormat`, and accepts the same `DurationInput` the rest of the package takes. Callers that need something `Intl` cannot express compose `formatParts()` output themselves rather than adding a pattern language to the package.

Every formatter for anything time-shaped lives here, including duration formatting. `@pkg/duration` (ADR-027) converts strings to numbers and deliberately formats nothing, so there is exactly one `formatRelative` and one `formatDuration` in the monorepo.

### 2. Operations Take An Explicit Time Zone

```ts
startOfDay(date, timeZone);
endOfDay(date, timeZone);
startOfWeek(date, timeZone, { weekStartsOn });
addDays(date, count);
subDays(date, count);
add(date, "1 hour");
subtract(date, "30 minutes");
elapsed(since); // milliseconds between `since` and now
diffInDays(a, b, timeZone);
isSameDay(a, b, timeZone);
eachDayOfInterval({ start, end }, timeZone);
```

Instant arithmetic (`addDays`, `subDays`, `add`, `subtract`, `elapsed`) needs no zone. Anything that answers a calendar question (which day is this, are these the same day, how many day boundaries are between them) requires one, because the answer genuinely differs by zone. There is no implicit default: omitting it is a type error.

`add()` and `subtract()` take a `DurationInput` from `@pkg/duration` (ADR-027), so `add(date, "1 hour")` reads as written and the unit is never implied. That is the one dependency this package has, and it runs one way: durations know nothing about dates.

### 3. Day-Grid Helpers

The extracted utilities keep their behavior and gain a zone parameter:

```ts
daysOfYear(year, timeZone);
lastNDays(count, { from, timeZone });
groupByWeek(days, { weekStartsOn, timeZone });
```

They return plain arrays of day descriptors so any UI layer can render them; the package contains no JSX.

### 4. Day Keys

Grid and aggregation code needs a stable string key per calendar day. The package exposes it explicitly instead of leaving every caller to slice an ISO string:

```ts
toDayKey(date, timeZone); // "2026-07-29"
fromDayKey("2026-07-29", timeZone); // Date at that day's start in the zone
```

### 5. Errors

Parsing and construction helpers return `Result` rather than an `Invalid Date`:

```ts
let result = parseDayKey(input);
if (isFailure(result)) return badRequest();
```

## Consequences

### Positive

- **The port stops duplicating calendar math** - the heatmap grid comes from a package on both stacks.
- **Locale output comes from the platform** - no locale data in the bundle, and formatting matches the rest of the platform's `Intl` behavior.
- **Time zone bugs become type errors** - a calendar operation cannot silently assume UTC.
- **One vocabulary** - `date-fns` usage in server and job code can be retired incrementally.
- **Smaller bundles** - `Intl` is built in; `date-fns` imports are not.

### Negative

- **`Intl` is less expressive than a pattern formatter** - unusual layouts require composing `formatParts()` output.
- **Zone-correct arithmetic is harder to implement than it looks** - DST transitions must be covered by tests, which a library previously handled.
- **Explicit zone arguments are more verbose** - call sites get longer in exchange for being unambiguous.

### Neutral

- **`@internationalized/date` stays** - the React Aria date components in `@pkg/ui` require it; this package targets server, job, and view-model code, not those controls.
- **`Temporal` is a future migration** - when it is available in every target runtime, it can back these functions without changing their signatures.

## Implementation Plan

### Phase 1: Core Operations

**Priority:** High
**Estimated Effort:** 4 hours

1. Implement zone-aware day boundaries, comparisons, and differences, with DST tests.
2. Implement `toDayKey`, `fromDayKey`, `parseDayKey`.

### Phase 2: Formatters

**Priority:** High
**Estimated Effort:** 2 hours

1. Implement the `Intl` wrappers, including `formatRelative` unit selection.

### Phase 3: Grid Helpers And Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Move `daysOfYear`, `lastNDays`, `groupByWeek`, and day labeling into the package with their existing tests.
2. Adopt in the in-flight Remix v3 uptime port instead of writing new copies.
3. Replace `date-fns` usage in server and job code, leaving date-picker components untouched.
4. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Keep `date-fns` And Extract Only The Grid Helpers

Extract the four utility files and leave formatting and arithmetic to the library.

**Rejected because**: the grid helpers are the smaller half of the duplication, and formatting would stay library-driven with a second locale data source in the bundle.

### 2. Adopt `Temporal` Now

Build the package directly on `Temporal`.

**Rejected because**: runtime availability across the deployment targets is not guaranteed yet. The API is designed so `Temporal` can back it later.

### 3. Wrap `@internationalized/date` For Everything

Use the library already present for date pickers as the general date layer.

**Rejected because**: its value types are optimized for calendar UI, and server code would be converting to and from `Date` at every boundary.

## References

- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [MDN: Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
- [MDN: Intl.NumberFormat unit style](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [ADR-021: Cron Schedule Package](./ADR-021-cron-schedule-package.md)
- [ADR-027: Duration Package](./ADR-027-duration-package.md)

## Current Progress

- [x] Phase 1: Core Operations
- [x] Phase 2: Formatters
- [ ] Phase 3: Grid Helpers And Adoption (helpers moved; adoption pending)

## Notes

- Week start is a parameter, never inferred, because it is both a locale question and a product decision and the two disagree.
- Formatter instances are cached per locale and options combination; constructing `Intl.DateTimeFormat` on a hot path is measurably slow.
- Durations are expressed by `@pkg/duration` and consumed here. That package converts a duration string to a number and stops; every operation that takes a `Date` or produces text for a reader lives in this package, including `formatDuration()`. The split exists so no operation has two homes.
