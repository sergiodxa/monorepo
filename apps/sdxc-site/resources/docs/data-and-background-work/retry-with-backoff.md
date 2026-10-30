---
title: Retry on a growing delay
description: Wait longer after each failure, with a ceiling and jitter, in queue jobs, in-process retries, polled rows and sign-in lockouts.
section:
    title: Data & background work
    order: 7
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "How to build one backoff schedule with `@sdxc/backoff` and honor `Retry-After`"
    - "How to retry a queue job, a request or a polled row on a growing delay"
    - "How to let the first failures through and test the exact delays"
---

A fixed retry delay is wrong in both directions: too slow for a blip that cleared in five
seconds, and too fast for a host that is down all afternoon, which meets every waiting retry at
once when it recovers. A delay that grows with each failure answers both, and a little jitter
keeps the retries that failed together from returning together.

[`@sdxc/backoff`](/api/backoff) is one schedule that answers "how long after the Nth failure".
It plugs into [`@sdxc/jobs`](/api/jobs) through `ctx.retry`, into `retry` from
[`@sdxc/result`](/api/result), and into any row that stores when to try again. Jitter draws from
a [`@sdxc/random`](/api/random) stream, so a test can make it exact, and
[`@sdxc/outbound`](/api/outbound) does the fetching in the examples.

```bash
npm add @sdxc/backoff @sdxc/http @sdxc/jobs @sdxc/outbound @sdxc/random @sdxc/result
```

## Build the schedule once

A schedule is a pair of functions over options validated once, so it belongs at module scope,
built when the module loads and shared by every run:

```typescript {% title="app/services/previews/retry.ts" %}
import { createBackoff } from "@sdxc/backoff";

export const previewBackoff = createBackoff({
	base: "1 minute",
	max: "6 hours",
	jitter: 0.2,
});
```

`delay(attempt)` answers milliseconds after `attempt` failures, counting from 1, so this one
waits about 1, 2, 4 and 8 minutes and keeps doubling until it sits at 6 hours. `jitter: 0.2`
spreads each delay across ±20%, after the ceiling, so retries parked at 6 hours still spread out.

> [!WARNING]
> Keep the ceiling plus its jitter under 12 hours when the delay goes to `ctx.retry`. That is the
> longest Cloudflare Queues holds a message, and 6 hours at +20% leaves plenty of room.

## Honor Retry-After

A server answering `429` or `503` may say how long to wait. That number is the floor, and the
schedule still applies on top of it, so a server that says "1 second" on every attempt gets
the growing delay anyway:

```typescript {% title="app/services/previews/retry-after.ts" %}
import { parseRetryAfter } from "@sdxc/http/retry-after";

import { previewBackoff } from "~/app/services/previews/retry";

const QUEUE_HOLD_LIMIT_MS = 12 * 3_600_000;

export function waitAfter(response: Response, attempt: number): number {
	let wait = Math.max(
		parseRetryAfter(response.headers.get("retry-after")) ?? 0,
		previewBackoff.delay(attempt),
	);
	return Math.min(wait, QUEUE_HOLD_LIMIT_MS);
}
```

`parseRetryAfter` from [`@sdxc/http`](/api/http) reads either the seconds or the HTTP-date form
as milliseconds, and answers `null` for a missing or unreadable header, which leaves the schedule
to decide.

> [!WARNING]
> The header is the remote server's to write, so `waitAfter` clamps it to the queue's hold limit:
> an answer of a year would otherwise make the retry itself fail.

## Retry a job on a growing delay

The job hands `ctx.attempts`, the delivery count starting at 1, straight to the schedule; at the
moment a delivery fails, that is the number of failures so far:

```typescript {% title="app/jobs/previews/fetch.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { follow, readText, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { Previews } from "~/app/models/previews";
import { previewBackoff } from "~/app/services/previews/retry";
import { waitAfter } from "~/app/services/previews/retry-after";

const MAX_BYTES = 1024 * 1024;

export default createJobHandler(jobs.previews.fetch, async (ctx) => {
	let preview = await Previews.find(ctx.db, ctx.input.previewId);
	if (preview === null) return ctx.exit("The preview was removed");

	let followed = await follow(preview.url, { timeout: "8 seconds" });
	if (isFailure(followed)) {
		if (!followed.error.retryable) return ctx.exit(followed.error.code);
		let delay = previewBackoff.delay(ctx.attempts);
		return ctx.retry({ delay, cause: followed.error });
	}

	let { response } = followed.data;
	if (response.status === 429 || response.status >= 500) {
		release(response.body);
		let delay = waitAfter(response, ctx.attempts);
		return ctx.retry({ delay, reason: `Answered ${response.status}` });
	}
	if (!response.ok) return ctx.exit(`Answered ${response.status}`);

	let body = await readText(response, { maxBytes: MAX_BYTES });
	if (isFailure(body)) {
		if (!body.error.retryable) return ctx.exit(body.error.code);
		let delay = previewBackoff.delay(ctx.attempts);
		return ctx.retry({ delay, cause: body.error });
	}

	await Previews.store(ctx.db, preview.id, body.data.text);
});
```

`Previews` is your own model. A `retryable` error, a `429` or a `5xx` could succeed next time, so
the job waits on the schedule; a refused host or a `404` fails the same way every time, so
`ctx.exit` ends the message. The schedule says how long to wait, and the queue consumer's
`max_retries` says how many times.

## Retry inside one request

Some retries cannot leave the request, such as a profile fetch a page is waiting to render.
`retry` from `@sdxc/result` reruns a `Result`-returning function, and its `delay` accepts the
schedule:

```typescript {% title="app/services/profile.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { follow } from "@sdxc/outbound";
import { retry } from "@sdxc/result";

const quickBackoff = createBackoff({ base: 200, max: "2 seconds", jitter: "full" });

export function fetchProfile(url: string) {
	return retry(() => follow(url, { timeout: "3 seconds" }), {
		times: 4,
		delay: (attempt) => quickBackoff.delay(attempt),
		when: (error) => error.retryable,
	});
}
```

> [!NOTE]
> Keep the whole budget short, since a visitor is waiting through every attempt: four tries here
> spend at most three seconds waiting.

## Store the next attempt for a polled resource

A feed that fails keeps being polled, so its retry state lives on the row: a failure count and
the time it is next due. `at(attempt, now)` is `now + delay(attempt)`, the value to store. Build
the schedule from a function taking the `Random` to draw from, so a test can pass a seeded one:

```typescript {% title="app/services/feeds/backoff.ts" %}
import type { Random } from "@sdxc/random";

import { createBackoff } from "@sdxc/backoff";
import { systemRandom } from "@sdxc/random";

export function createFeedBackoff(random: Random = systemRandom()) {
	return createBackoff({ base: "15 minutes", max: "1 day", jitter: 0.1, random });
}

export const feedBackoff = createFeedBackoff();
```

A cron job sweeps the rows that are due, writes the next attempt for each failure, and resets
the count on success:

```typescript {% title="app/jobs/feeds/sweep.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { Feeds } from "~/app/models/feeds";
import { feedBackoff } from "~/app/services/feeds/backoff";
import { fetchFeed } from "~/app/services/feeds/fetch";

const REFRESH_EVERY_MS = 60 * 60_000;

export default createJobHandler(jobs.feeds.sweep, async (ctx) => {
	let now = Date.now();
	let due = await Feeds.due(ctx.db, now);

	for (let feed of due) {
		let fetched = await fetchFeed(feed.url);
		if (isFailure(fetched)) {
			let failures = feed.failures + 1;
			await Feeds.recordFailure(ctx.db, feed.id, {
				failures,
				nextAttemptAt: feedBackoff.at(failures, now),
				error: fetched.error.message,
			});
			continue;
		}

		await Feeds.recordSuccess(ctx.db, feed.id, {
			entries: fetched.data,
			nextAttemptAt: now + REFRESH_EVERY_MS,
		});
	}

	ctx.log.set({ feeds: { due: due.length } });
});
```

`Feeds` and `fetchFeed` are your own: `due` selects rows whose `nextAttemptAt` has passed, and
`fetchFeed` answers a `Result`. A stored time has no hold limit, so the ceiling can be a day.

## Let the first failures through

A sign-in form should forgive a typo or two and only then start making a guesser wait. `free`
attempts answer `0`, and the curve starts on the failure after them:

```typescript {% title="app/services/lockout.ts" %}
import { createBackoff } from "@sdxc/backoff";

const lockout = createBackoff({ free: 4, base: "1 second", max: "15 minutes" });

export interface SignInState {
	failedAttempts: number;
	retryAfter: number | null;
}

export function afterFailure(state: SignInState, now: number): SignInState {
	let failedAttempts = state.failedAttempts + 1;
	let wait = lockout.delay(failedAttempts);
	return { failedAttempts, retryAfter: wait === 0 ? null : now + wait };
}

export function lockedFor(state: SignInState, now: number): number {
	return state.retryAfter === null ? 0 : Math.max(state.retryAfter - now, 0);
}
```

The fifth wrong password waits 1 second, the sixth 2, up to 15 minutes. The sign-in action calls
`lockedFor` before checking the password and answers `429` with that wait as `Retry-After`. When
the count resets is your rule.

## Test the exact delays

Jitter makes every run different, which is the point in production and a problem in a test.
A seeded stream from `createRandom` makes the draws, and so the delays, the same on every run:

```typescript {% title="app/services/feeds/backoff.test.ts" %}
import { createRandom } from "@sdxc/random";
import { expect, test } from "vitest";

import { createFeedBackoff } from "~/app/services/feeds/backoff";

test("a seeded schedule answers the same delays on every run", () => {
	let backoff = createFeedBackoff(createRandom("feeds"));
	let delays = [1, 2, 3, 4].map((attempt) => backoff.delay(attempt));

	expect(delays).toEqual([951_542, 1_655_825, 3_624_786, 7_326_701]);
});

test("every delay stays within its jitter around the curve", () => {
	let backoff = createFeedBackoff();

	for (let attempt = 1; attempt <= 12; attempt++) {
		let curve = Math.min(900_000 * 2 ** (attempt - 1), 86_400_000);
		expect(backoff.delay(attempt)).toBeGreaterThanOrEqual(curve * 0.9);
		expect(backoff.delay(attempt)).toBeLessThanOrEqual(curve * 1.1);
	}
});
```

The first test pins the sequence, so a change to the schedule shows up as a changed number; the
second runs on the system stream and asserts the band.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — `ctx.retry`,
  `ctx.exit`, and the consumer's `max_retries`.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — the
  `retryable` flag on every `OutboundError`.
- [Send alerts to chat and paging services](/docs/data-and-background-work/messaging) — a
  delivery job that retries on the delay the platform asked for.
