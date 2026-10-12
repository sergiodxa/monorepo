# @sdxc/backoff

Retry delay schedules with exponential, linear, constant or stepped growth, a ceiling, free attempts and seedable jitter.

## Installation

```sh
npm add @sdxc/backoff
```

Durations are [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) inputs, and jitter draws from a [`@sdxc/random`](https://www.npmjs.com/package/@sdxc/random) stream; install `@sdxc/random` too when you pass a seeded one.

## Usage

### Build a schedule

`delay(attempt)` answers the milliseconds to wait after `attempt` failures, counting from 1.

```typescript
import { createBackoff } from "@sdxc/backoff";

let backoff = createBackoff({ base: "15 seconds", max: "12 hours" });

backoff.delay(1); // 15_000
backoff.delay(3); // 60_000
backoff.delay(20); // 43_200_000, the ceiling
```

That schedule is `Math.min(15_000 * 2 ** (attempt - 1), 43_200_000)`.

### Pick the growth

`growth` changes the curve, and `steps` replaces it with a table whose last entry repeats.

```typescript
createBackoff({ base: "1 second", factor: 3 }); // 1s, 3s, 9s, 27s…
createBackoff({ base: "30 seconds", growth: "linear" }); // 30s, 60s, 90s…
createBackoff({ base: "5 seconds", growth: "constant" }); // 5s, 5s, 5s…
createBackoff({ steps: ["15 seconds", "1 minute", "5 minutes", "2 hours"] }); // …2h, 2h
```

### Spread retries with jitter

A fraction `f` draws each delay from `delay × (1 ± f)`; `"full"` draws from `[0, delay]`. Jitter applies after `max`, so retries waiting at the ceiling still spread out.

```typescript
let backoff = createBackoff({ base: "15 seconds", max: "12 hours", jitter: 0.2 });

backoff.delay(1); // between 12_000 and 18_000
```

### Allow free attempts

The first `free` failures answer `0`, and the curve starts on the failure after them.

```typescript
let lockout = createBackoff({ free: 3, base: "1 second", max: "15 minutes" });

lockout.delay(3); // 0
lockout.delay(4); // 1_000
lockout.delay(5); // 2_000
```

## API

### `createBackoff(options: BackoffOptions): Backoff`

Validates the options once and returns the schedule, so `delay` and `at` never fail. Throws `RangeError` for a negative or unparseable duration, a `factor` below 1, a `max` below `base`, a `jitter` outside `[0, 1]`, empty `steps`, or a `free` that is not a non-negative integer.

A curve schedule takes:

- `base`: the delay after the first counted failure
- `growth`: `"exponential"` (default) multiplies by `factor` per failure, `"linear"` adds `base`, `"constant"` repeats `base`
- `factor`: the exponential multiplier, `2` by default
- `max`: the ceiling before jitter; unbounded when omitted

A stepped schedule takes `steps`, one delay per counted failure. Both take:

- `free`: failures that answer `0`, `0` by default
- `jitter`: a `Jitter`; none when omitted. Jittered delays round to whole milliseconds
- `random`: the stream jitter draws from, `systemRandom()` by default

### `Backoff`

- `delay(attempt: number): number`: milliseconds after `attempt` failures; `0` for a non-positive or free attempt
- `at(attempt: number, now: number): number`: `now + delay(attempt)`, for storing when to try again

### Types

#### `BackoffOptions`

`BackoffCurveOptions | BackoffStepsOptions`, both extending `BackoffSharedOptions` (`free`, `jitter`, `random`).

#### `Jitter`

`number | "full"`: a fraction in `[0, 1]`, or a draw from zero to the full delay.

## Pattern: Retrying A Queue Message

A queue consumer passes its delivery count straight in, so early retries come quickly and a receiver that stays down is left alone.

```typescript
import { createBackoff } from "@sdxc/backoff";

let deliveryBackoff = createBackoff({ base: "1 minute", max: "6 hours", jitter: 0.2 });

export default {
	async queue(batch: MessageBatch<{ url: string }>) {
		for (let message of batch.messages) {
			let response = await fetch(message.body.url, { method: "POST" });
			if (response.ok) message.ack();
			else
				message.retry({ delaySeconds: Math.ceil(deliveryBackoff.delay(message.attempts) / 1000) });
		}
	},
};
```

## Pattern: Retrying A Request And Honoring Retry-After

When a server says how long to wait, wait at least that long. `Retry-After` is either a number of seconds or an HTTP date; anything else counts as no answer.

```typescript
import { createBackoff } from "@sdxc/backoff";

let backoff = createBackoff({ base: "1 second", max: "5 minutes", jitter: "full" });

function retryAfterMs(response: Response, now: number): number {
	let header = response.headers.get("retry-after");
	if (header === null) return 0;

	let seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0);

	let date = Date.parse(header);
	return Number.isNaN(date) ? 0 : Math.max(date - now, 0);
}

async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		let response = await fetch(url);
		if (response.ok || attempt === attempts) return response;
		let wait = Math.max(retryAfterMs(response, Date.now()), backoff.delay(attempt));
		await new Promise((resolve) => setTimeout(resolve, wait));
	}
}
```

## Pattern: Locking Out Repeated Sign-In Failures

A stored failure count and `at()` give a row the time its next attempt opens. The first three failures cost nothing.

```typescript
import { createBackoff } from "@sdxc/backoff";

let lockout = createBackoff({ free: 3, steps: ["30 seconds", "5 minutes", "1 hour"] });

interface SignInState {
	failures: number;
	lockedUntil: number;
}

function isLocked(state: SignInState, now: number): boolean {
	return state.lockedUntil > now;
}

function recordFailure(state: SignInState, now: number): SignInState {
	let failures = state.failures + 1;
	return { failures, lockedUntil: lockout.at(failures, now) };
}
```

## Pattern: Exact Delays In Tests

Pass a seeded `Random` and every jittered delay is reproducible, so a test asserts exact values.

```typescript
import { createBackoff } from "@sdxc/backoff";
import { createRandom } from "@sdxc/random";
import { expect, test } from "vitest";

test("jitter is reproducible", () => {
	let first = createBackoff({ base: 1000, jitter: 0.2, random: createRandom("test") });
	let second = createBackoff({ base: 1000, jitter: 0.2, random: createRandom("test") });

	expect(first.delay(3)).toBe(second.delay(3));
	expect(first.delay(3)).toBeGreaterThanOrEqual(3200);
	expect(first.delay(3)).toBeLessThanOrEqual(4800);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/backoff": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
