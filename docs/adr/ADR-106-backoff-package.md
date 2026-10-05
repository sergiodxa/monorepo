# ADR-106: Backoff Package

## Status

**Accepted** - 2026-10-05

## Background

Every place that retries something after a failure has to answer the same question: how long to
wait before the next attempt. The repo answers it five times, in five shapes. Each one picks a
base delay, a growth rule and a ceiling, and one of them adds jitter with `Math.random`. None of
them can be tested against a fixed sequence of jittered delays, and two background jobs retry
on a constant delay because writing a schedule for them was more work than the job itself.

## Context

### Current schedules

| Location                                                             | Shape                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/reader/database/refresh.ts` `backoffFor`                       | Exponential from `BASE_BACKOFF_MS`, capped at `MAX_BACKOFF_MS`                                              |
| `apps/auth-saas/database/webhook-deliveries.ts` `retryDelayMs`       | A hand-written table (15s, 1m, 5m, 30m, 2h, 6h, 12h), then ±`MAX_JITTER_FRACTION` jitter from `Math.random` |
| `apps/auth-saas/database/authentication-backoff.ts` `backoffDelayMs` | Free attempts up to a threshold, then exponential from 1s, capped at 15 minutes                             |
| `packages/result/src/retry.ts`                                       | `"constant"`, `"linear"` or `"exponential"` from a base, no cap, no jitter                                  |
| `apps/blog/app/jobs/webmentions/verify.ts`, `deliver.ts`             | A constant `ctx.retry({ delay: "10 minutes" })` and `"30 minutes"`, whatever the attempt                    |

`@sdxc/jobs` already hands every job its `ctx.attempts`, so a job can compute a growing delay;
nothing in the repo makes that a one-liner.

### Issues identified

| Issue                                                                       | Impact                                                                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Each schedule re-derives exponent, cap and off-by-one on the attempt number | `reader` caps the exponent with `Math.log2`, `auth-saas` subtracts a threshold, `result` counts from `attempts - 1`; three readings of "attempt" |
| Jitter comes from `Math.random`                                             | A test can assert only a range, never the delay a given attempt got                                                                              |
| `result/retry` has no ceiling                                               | `{ times: 20, delay: 100, backoff: "exponential" }` waits over 7 hours before its last try                                                       |
| Constant retries in the blog's jobs                                         | A receiver that is down for a day is hit every 10 or 30 minutes all day                                                                          |

## Decision

Add `@sdxc/backoff`: one schedule type that answers "how long after the Nth failure", built
from a base, a growth rule, a ceiling, optional free attempts and optional jitter drawn from a
`Random` (ADR-104). Durations are `DurationInput` from `@sdxc/duration`, the same type
`ctx.retry({ delay })` takes, and the schedule answers milliseconds.

### The schedule

```typescript
import { createBackoff } from "@sdxc/backoff";

let backoff = createBackoff({
	base: "15 seconds",
	growth: "exponential", // or "linear", "constant"
	factor: 2,
	max: "12 hours",
	jitter: 0.2, // ±20%; "full" draws from [0, delay]; omitted means no jitter
});

backoff.delay(1); // 15_000 ±20%: the wait after the first failure
backoff.delay(3); // 60_000 ±20%
backoff.delay(20); // 43_200_000 ±20%: the ceiling, before jitter
backoff.at(3, now); // now + backoff.delay(3), for a stored next_attempt_at
```

- **`attempt` is the count of failures so far, starting at 1.** That is what `ctx.attempts`,
  `failure_count` and `failed_attempts` already hold at the moment a delay is computed, so every
  call site passes its own counter unchanged.
- **`max` caps the delay before jitter.** Jitter applied after the cap keeps a fleet of retries
  at the ceiling spread out, which is what jitter is for.
- **`free` attempts cost nothing.** `createBackoff({ free: 3, … })` answers `0` for attempts 1
  to 3 and starts the curve at attempt 4, which is the authentication lockout's threshold.
- **`steps` replaces the curve with a table** for a schedule chosen by hand, such as the webhook
  one. The last step repeats for every attempt past the end.
- **`random`** defaults to `systemRandom()`. A test passes `createRandom(seed)` and asserts
  exact delays.

### Errors

`createBackoff` validates its options once and returns the schedule, or throws a `RangeError`
for a negative base, a `factor` below 1, a `max` below `base`, a `jitter` outside `[0, 1]` or
empty `steps`. These are fixed at the call site and never depend on runtime input, the same
category `createRandom` treats as programmer errors. `delay` and `at` never fail; a non-positive
attempt answers `0`.

### `@sdxc/result` integration

`retry` keeps having no dependencies. Its `delay` option widens from milliseconds to
milliseconds or a function of the attempt, so a schedule plugs in without `result` importing it:

```typescript
interface Options<E> {
	times: number;
	delay: number | ((attempt: number) => number);
	backoff?: "constant" | "linear" | "exponential";
	when?: (error: E, attempt: number) => boolean;
}
```

A function `delay` ignores `backoff`, since the schedule already decided.

## Usage Examples

### A job that retries on a growing delay

The blog's Webmention delivery today:

```typescript
if (transient) return ctx.retry({ delay: "30 minutes", cause: error });
```

With a schedule, early retries come quickly and a receiver that stays down is left alone:

```typescript
const retryBackoff = createBackoff({ base: "5 minutes", max: "6 hours", jitter: 0.2 });

if (transient) return ctx.retry({ delay: retryBackoff.delay(ctx.attempts), cause: error });
```

### A stored next attempt

`reader`'s feed refresh writes the time a failing feed is tried again:

```typescript
next_attempt_at: now + backoffFor(failureCount),
```

becomes:

```typescript
const feedBackoff = createBackoff({ base: BASE_BACKOFF_MS, max: MAX_BACKOFF_MS });

next_attempt_at: feedBackoff.at(failureCount, now),
```

`backoffFor` and its exponent clamp are deleted. `BASE_BACKOFF_MS` and `MAX_BACKOFF_MS` stay as
the values the schedule is built from.

### A hand-written table with jitter

The webhook schedule keeps its exact steps and drops its two helpers:

```typescript
const deliveryBackoff = createBackoff({
	steps: ["15 seconds", "1 minute", "5 minutes", "30 minutes", "2 hours", "6 hours", "12 hours"],
	jitter: MAX_JITTER_FRACTION,
});

let nextAttemptAt = deliveryBackoff.at(attempts, now);
```

### Free attempts before a lockout

The authentication backoff lets a few wrong passwords through before it starts waiting. The
threshold is each tenant's own, so the schedule is built per failure from it:

```typescript
let backoff = createBackoff({
	free: Math.max(threshold - 1, 0),
	base: BACKOFF_BASE_MS,
	max: BACKOFF_CEILING_MS,
});

retry_after: failedAttempts >= threshold ? backoff.at(failedAttempts, now) : null,
```

The decay window that resets `failed_attempts` after a quiet day stays in the app. It is a rule
about which failures count, and the schedule only answers what a count costs.

### `retry` from `@sdxc/result`

```typescript
let result = await retry(() => fetchRates(), {
	times: 6,
	delay: (attempt) => ratesBackoff.delay(attempt),
	when: (error) => error.retryable,
});
```

### Testing exact delays

```typescript
test("spreads retries at the ceiling", () => {
	let backoff = createBackoff({
		base: "1 second",
		max: "1 minute",
		jitter: 0.5,
		random: createRandom("ceiling"),
	});

	let delays = [backoff.delay(10), backoff.delay(10), backoff.delay(10)];

	expect(new Set(delays).size).toBe(3);
	for (let delay of delays) expect(delay).toBeGreaterThanOrEqual(30_000);
	for (let delay of delays) expect(delay).toBeLessThanOrEqual(90_000);
});
```

## Consequences

### Positive

- **One reading of "attempt":** every schedule counts failures from 1, so the off-by-one lives in
  one tested place.
- **Deterministic jitter:** a seeded `Random` turns a jittered schedule into an exact sequence a
  test can assert.
- **Growing delays become the easy option:** a job's retry is one line with `ctx.attempts`.
- **`result/retry` gains a ceiling and jitter** without taking a dependency.

### Negative

- **Behavior changes in the blog's jobs:** their retry timing moves from constant to growing,
  which is the intent but is a change a reader of the release notes needs to see.
- **Another package in the dependency graph** for apps that already compute delays inline.

### Neutral

- **Retry policy stays with the caller.** Which errors retry, how many times, and when a
  failure count resets remain decisions at each call site; the package answers only how long.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 2 hours

1. Create `packages/backoff`, public, with `createBackoff`, the `Backoff` and options types, and
   tests for each growth rule, `free`, `steps`, `max`, both jitter modes and option validation.
2. Write the README.

### Phase 2: `@sdxc/result`

**Priority:** Medium
**Estimated Effort:** 30 minutes

1. Accept a function `delay` in `retry`, with tests.

### Phase 3: Apps

**Priority:** Medium
**Estimated Effort:** 2 hours

1. `apps/reader`: replace `backoffFor`.
2. `apps/auth-saas`: replace `retryDelayMs`, `jitteredDelay` and `backoffDelayMs`, keeping the
   existing tests' expected delays.
3. `apps/blog`: give both Webmention jobs a growing schedule.

## Alternatives Considered

### 1. Put schedules in `@sdxc/result`

`retry` already owns three growth rules, so the schedule could grow there.

**Rejected because**: most schedules in the repo never call `retry`. They compute a timestamp to
store (`reader`, `auth-saas`) or a delay to hand a queue (`ctx.retry`), and `result` would need
`@sdxc/duration` and `@sdxc/random` to serve them.

### 2. Put schedules in `@sdxc/jobs`

**Rejected because**: the feed refresh and the authentication lockout are not jobs, and the
lockout runs on the request path.

### 3. Keep inline formulas

**Rejected because**: the inline formulas already disagree on what an attempt number means,
and none of them can be tested with exact jittered values.

## References

- [ADR-104: Random Package](./ADR-104-random-package.md)
- [Exponential Backoff And Jitter, AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: `@sdxc/result`
- [x] Phase 3: Apps (the blog's Webmention verify retries from 2 minutes up to an hour, and
      delivery from 5 minutes up to 6 hours, both with ±20% jitter)
- [ ] `bun run release:bootstrap @sdxc/backoff` and its trusted publisher on npmjs.com

## Notes

- `@sdxc/backoff` is public from its first commit, since `@sdxc/result` documents it and the
  package carries no app-specific behavior.
- A server's `Retry-After` answer stays the caller's to honor: take
  `Math.max(retryAfterMs, backoff.delay(attempt))` where the provider sends one, as
  `@sdxc/billing`'s errors already expose.
