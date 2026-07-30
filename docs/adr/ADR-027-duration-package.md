# ADR-027: Duration Package

## Status

**Accepted** - 2026-07-29

## Background

Lengths of time appear throughout the monorepo as bare numbers whose unit is only knowable from context: cache write TTLs, session lifetimes, retry backoff, rate limit windows, cache header ages, cron grace periods. Two places translate human strings into milliseconds with the `ms` dependency; everywhere else the arithmetic is inline.

Several packages proposed alongside this one need a duration argument. Defining that type once, before those packages exist, prevents each from inventing its own convention.

## Context

### Current State

| Location                                  | How duration is expressed                           |
| ----------------------------------------- | --------------------------------------------------- |
| `packages/result/src/retry.ts`            | `ms` dependency for backoff configuration           |
| `apps/auth/app/config.ts`                 | `ms` dependency for lifetimes                       |
| `packages/kv-cache`                       | Numeric TTL in store write options                  |
| `packages/session-storage-kv`             | Numeric session lifetime                            |
| Cache header call sites                   | Numeric seconds inside a third-party string builder |
| `apps/r3-uptime` cron grace and cooldowns | Inline millisecond arithmetic                       |

### Issues Identified

| Issue                                            | Impact                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| Seconds and milliseconds are both plain `number` | A value passed to the wrong API is off by a factor of 1000 and type-checks |
| Magic arithmetic at call sites                   | `60 * 60 * 24 * 7` recurs and is read carefully every time                 |
| A dependency for string parsing                  | And parsing that accepts typos silently at runtime                         |
| No shared type for new packages to accept        | Each new package would define its own unit convention                      |

## Decision

Create `@pkg/duration`: a compile-time-checked duration string type and the conversions from it to milliseconds and seconds.

### 1. Typed Duration Strings

```ts
export type DurationString = `${bigint} ${DurationUnit}` | `${bigint}${DurationUnitShort}`;
export type DurationInput = number | DurationString;
```

Units cover millisecond through week, singular and plural, plus short forms (`ms`, `s`, `m`, `h`, `d`, `w`). Because the type is a template literal union, a typo is a compile error:

```ts
toMs("5 minutes"); // 300000
toMs("30s"); // 30000
toMs("5 minuts"); // Type error
```

The count is `${bigint}` rather than `${number}` because `${number}` also matches `"1.5h"`, `"5e3h"`, and `"0x10h"`, and fractional and exponent forms are meant to be rejected. `${bigint}` accepts integer digits only.

A bare `number` is always milliseconds, matching `Date` arithmetic and the convention of the dependency being replaced. Packages that need another unit convert explicitly, so a seconds-based API cannot silently receive milliseconds.

### 2. Conversions

```ts
toMs(input); // for Date arithmetic and timers
toSeconds(input); // rounded, for HTTP headers and Cloudflare TTLs
parse(text); // Result<number, InvalidDuration> for runtime input
```

Two conversions for the two consumers that exist: JavaScript time arithmetic counts milliseconds, and HTTP headers and platform TTLs count seconds. Further units land when a caller needs one.

Both accept `DurationInput`, so every consumer can declare a `DurationInput` parameter and normalize internally. `parse()` exists for values that arrive at runtime (configuration, form input) where the compile-time type cannot help, and it returns a `Result` rather than throwing.

### 3. The Boundary With `@pkg/dates`

This package owns the duration string and its conversion to a number. `@pkg/dates` (ADR-020) owns every operation that takes a `Date` or produces text for a reader, and depends on this package to accept `DurationInput` in its own arithmetic:

| Operation                                    | Package                |
| -------------------------------------------- | ---------------------- |
| `"5 minutes"` to milliseconds or seconds     | `@pkg/duration`        |
| Adding or subtracting a duration from a date | `@pkg/dates` (ADR-020) |
| Time elapsed since an instant                | `@pkg/dates`           |
| "1 hour, 30 minutes" for a reader            | `@pkg/dates`           |
| "1 hour ago" for a reader                    | `@pkg/dates`           |

The dependency runs one way, which keeps every date concern on one side of the line and leaves this package dependency-free.

### 4. Consumers

The type becomes the shared vocabulary for the packages that need it: cache TTLs, session lifetimes, retry backoff, rate limit windows (ADR-019), cache policy ages (ADR-022), cron grace periods (ADR-021), and replay-store TTLs (ADR-026).

## Consequences

### Positive

- **Units become visible at call sites** - `"1 hour"` instead of `3600` or `3600000`.
- **Typos fail at compile time** - the template literal type rejects malformed strings before runtime.
- **A dependency is retired** - `ms` disappears from a package and an app.
- **New packages share one convention** - no per-package unit decisions.
- **One responsibility** - every operation has a single home across this package and `@pkg/dates`, so a call site always knows which to import.
- **Trivially cheap to depend on** - the whole package is a unit table, two conversions, and a parser, with no dependencies, so any package can accept `DurationInput` without inheriting a date library.

### Negative

- **Template literal unions have a cost** - the union is large, and adding units multiplies it, so the unit list must stay short.
- **Only a subset of `ms` syntax is supported** - forms like `"1.5h"` and unit-only strings such as `"hour"` are deliberately unsupported and become type errors at existing call sites.
- **A duration string cannot be assembled from a variable** - ``toMs(`${count} minutes`)`` widens to `string` and fails to typecheck. Dynamic lengths use millisecond arithmetic instead, as in `count * toMs("1 minute")`, which is what the bare-number branch of `DurationInput` is for.
- **Months and years are excluded** - they are not fixed lengths; anything calendar-based belongs in `@pkg/dates`.

### Neutral

- **Bare numbers keep working** - existing numeric call sites compile unchanged, so adoption is incremental.
- **Rounding for seconds-based APIs is explicit** - `toSeconds()` rounds, and its documentation states the direction.

## Implementation Plan

### Phase 1: Types And Conversions

**Priority:** High
**Estimated Effort:** 2 hours

1. Unit tables, `DurationString`, `DurationInput`, conversions, `parse()` with `Result`.
2. Type-level tests asserting that malformed strings are rejected.

### Phase 2: Adoption

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Replace `ms` in the retry helper and the app config; drop the dependency.
2. Accept `DurationInput` in cache TTLs and session lifetimes.
3. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Keep `ms`

Continue using the dependency and standardize on it.

**Rejected because**: it validates at runtime and accepts forms this repository does not want, so a typo becomes a wrong number instead of a build failure. A typed union catches the same mistakes at compile time with no dependency, and the conversion itself is a lookup table.

### 2. A `Duration` Class

Model durations as instances with methods.

**Rejected because**: durations are configuration values that live in object literals and get serialized; a primitive string keeps them readable in code, in JSON, and in logs, with no construction ceremony.

### 3. Branded Numbers

Use `Milliseconds` and `Seconds` branded number types instead of strings.

**Rejected because**: branding prevents unit confusion but leaves `60 * 60 * 24` arithmetic at call sites, which is the more common readability problem. The string form solves both, and `toSeconds()` covers the branding case at the boundary.

## References

- [ADR-020: Dates Package With Intl-Only Formatting](./ADR-020-dates-package-with-intl-only-formatting.md)
- [ADR-019: Adapter-Based Rate Limiting Package](./ADR-019-adapter-based-rate-limiting-package.md)
- [ADR-022: HTTP Cache Policies And Conditional Responses](./ADR-022-http-cache-policies-and-conditional-responses.md)

## Current Progress

- [x] Phase 1: Types And Conversions
- [ ] Phase 2: Adoption

## Notes

- Keep the unit list closed. Each added unit multiplies the template literal union, and editor performance degrades before correctness does.
- Keep the function list closed too. Anything that takes a `Date` or produces a string for a reader belongs in `@pkg/dates`, and the test for a proposed addition is whether it could be mistaken for something that package already offers.
- The package is dependency-free and touches no platform API, not even `Intl`.
- Storage and wire formats should keep storing numbers; duration strings are for code and configuration, not for database columns.
