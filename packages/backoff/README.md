# @sdxc/backoff

Retry delay schedules with exponential, linear, constant or stepped growth, a ceiling, free attempts and seedable jitter.

## Installation

```bash
npm add @sdxc/backoff
```

## Usage

### A Growing Delay

`delay(attempt)` answers milliseconds to wait after `attempt` failures, counting from 1.

```typescript
import { createBackoff } from "@sdxc/backoff";

let backoff = createBackoff({ base: "15 seconds", max: "12 hours", jitter: 0.2 });

backoff.delay(1); // 15_000 ±20%
backoff.delay(3); // 60_000 ±20%
backoff.delay(20); // 43_200_000 ±20%: the ceiling, then jitter
```

Without jitter, the same schedule is `Math.min(15_000 * 2 ** (attempt - 1), 43_200_000)`.

### A Stored Next Attempt

`at(attempt, now)` is `now + delay(attempt)`, for a row that records when to try again.

```typescript
let nextAttemptAt = backoff.at(failureCount, Date.now());
```

### A Hand-Written Table

`steps` replaces the curve. The last step repeats for every attempt past the end.

```typescript
let backoff = createBackoff({
	steps: ["15 seconds", "1 minute", "5 minutes", "30 minutes", "2 hours"],
	jitter: 0.2,
});
```

### Free Attempts

`free` attempts answer `0`, and the curve starts on the failure after them.

```typescript
let lockout = createBackoff({ free: 3, base: "1 second", max: "15 minutes" });

lockout.delay(3); // 0
lockout.delay(4); // 1_000
lockout.delay(5); // 2_000
```

### Exact Jitter In Tests

Jitter draws from a [`@sdxc/random`](https://www.npmjs.com/package/@sdxc/random) stream. Pass a seeded one and every delay is reproducible.

```typescript
import { createRandom } from "@sdxc/random";

let backoff = createBackoff({ base: 1000, jitter: 0.2, random: createRandom("test") });
```

## API

### `createBackoff(options: BackoffOptions): Backoff`

Validate the options once and return the schedule. Throws `RangeError` for a negative or unparseable duration, a `factor` below 1, a `max` below `base`, a `jitter` outside `[0, 1]`, empty `steps`, or a `free` that is not a non-negative integer.

Durations are [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) inputs: milliseconds or strings such as `"30 minutes"`.

A curve schedule takes:

- `base`: the delay after the first counted failure
- `growth`: `"exponential"` (default) multiplies by `factor` per failure, `"linear"` adds `base` per failure, `"constant"` repeats `base`
- `factor`: the exponential multiplier, `2` by default
- `max`: the ceiling before jitter; unbounded when omitted

A stepped schedule takes `steps`, one delay per counted failure.

Both take:

- `free`: failures that answer `0`, `0` by default
- `jitter`: a fraction `f` draws from `delay × (1 ± f)`; `"full"` draws from `[0, delay]`; omitted means none. Applied after `max`, so retries waiting at the ceiling still spread out. Jittered delays are rounded to whole milliseconds.
- `random`: the stream jitter draws from, `systemRandom()` by default

### `Backoff`

- `delay(attempt)`: milliseconds after `attempt` failures; `0` for a non-positive or free attempt
- `at(attempt, now)`: `now + delay(attempt)`

### `BackoffOptions`, `BackoffCurveOptions`, `BackoffStepsOptions`, `BackoffSharedOptions` and `Jitter`

The option shapes above. `Jitter` is `number | "full"`.

## Pattern: Retrying A Queue Message

A queue consumer passes its delivery count straight in, so early retries come quickly and a receiver that stays down is left alone.

```typescript
import { createBackoff } from "@sdxc/backoff";

const deliveryBackoff = createBackoff({ base: "1 minute", max: "6 hours", jitter: 0.2 });

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

## Pattern: Honoring Retry-After

When a server says how long to wait, wait at least that long. `Retry-After` is either a number of seconds or an HTTP date, so read both, and treat anything else as no answer.

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

function waitAfter(response: Response, attempt: number): number {
	return Math.max(retryAfterMs(response, Date.now()), backoff.delay(attempt));
}
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
