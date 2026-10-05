---
title: Retry on a growing delay
description: Wait longer after each failure, with a ceiling and jitter, in queue jobs, in-process retries, polled rows and sign-in lockouts.
section:
    title: Data & background work
    order: 6
order: 8
lastUpdated: 2026-10-05
---

A fixed retry delay is wrong in both directions. Ten minutes is too slow for a blip that
cleared in five seconds, and too fast for a host that is down all afternoon: every message
waiting on it comes back every ten minutes, all at once, and the host meets the whole herd the
moment it recovers. A delay that grows with each failure answers both, and a little randomness
on top keeps the retries that failed together from returning together.

[`@sdxc/backoff`](/api/backoff) is one schedule that answers "how long after the Nth
failure": a base, a growth rule, a ceiling, optional free attempts and optional jitter. It
plugs into [`@sdxc/jobs`](/api/jobs) through `ctx.retry`, into `retry` from
[`@sdxc/result`](/api/result) through its `delay` option, and into any row that stores when
to try again. Jitter draws from a [`@sdxc/random`](/api/random) stream, so a test can make it
exact. [`@sdxc/outbound`](/api/outbound) does the fetching in the examples, and its errors say
which failures are worth another attempt.

```bash
npm add @sdxc/backoff @sdxc/random @sdxc/jobs @sdxc/outbound @sdxc/result remix
```

## Build the schedule once

A schedule is a pair of functions over options validated once, so it belongs at module scope,
built when the module loads and shared by every run:

```typescript {% title="app/previews/retry.ts" %}
import { createBackoff } from "@sdxc/backoff";

export const previewBackoff = createBackoff({
	base: "1 minute",
	max: "6 hours",
	jitter: 0.2,
});
```

`delay(attempt)` answers milliseconds after `attempt` failures, counting from 1, so this one
waits about 1, 2, 4 and 8 minutes and then keeps doubling until it sits at 6 hours. `growth`
switches the curve to `"linear"` or `"constant"`, and `factor` changes the multiplier. Durations
are the strings or millisecond numbers the rest of the packages take.

`jitter: 0.2` spreads each delay across ±20%, and it applies after the ceiling, so retries
parked at 6 hours still spread out instead of arriving in one wave. Construction is the only
step that can fail: a `max` below `base` or a `jitter` above 1 throws a `RangeError` when the
module loads, because those are fixed by the code rather than by any input.

Keep the ceiling plus its jitter under 12 hours when the delay goes to `ctx.retry`. That is the
longest Cloudflare Queues holds a message, and 6 hours at +20% leaves plenty of room.

## Honor Retry-After

A server answering `429` or `503` may say how long to wait. That number is the floor, and the
schedule still applies on top of it, so a server that says "1 second" on every attempt gets
the growing delay anyway:

```typescript {% title="app/previews/retry-after.ts" %}
import { previewBackoff } from "~/app/previews/retry";

const QUEUE_HOLD_LIMIT_MS = 12 * 3_600_000;

export function retryAfterMs(response: Response, now: number): number {
	let header = response.headers.get("retry-after");
	if (header === null) return 0;

	let seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0);

	let date = Date.parse(header);
	return Number.isNaN(date) ? 0 : Math.max(date - now, 0);
}

export function waitAfter(response: Response, attempt: number): number {
	let wait = Math.max(
		retryAfterMs(response, Date.now()),
		previewBackoff.delay(attempt),
	);
	return Math.min(wait, QUEUE_HOLD_LIMIT_MS);
}
```

`Retry-After` is either a number of seconds or an HTTP date, and both forms show up in the
wild. The header is the remote server's to write, so `waitAfter` clamps it to the queue's
hold limit: an answer of a year would otherwise make the retry itself fail.

## Retry a job on a growing delay

The job hands `ctx.attempts`, the delivery count starting at 1, straight to the schedule. At
the moment a delivery fails, that count is the number of failures so far, which is what
`delay` expects:

```typescript {% title="app/jobs/previews/fetch.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { follow, readText, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

import { Previews } from "~/app/data/previews";
import jobs from "~/app/jobs";
import { previewBackoff } from "~/app/previews/retry";
import { waitAfter } from "~/app/previews/retry-after";

const MAX_BYTES = 1024 * 1024;

export default createJobHandler(jobs.previews.fetch, async (ctx) => {
	let preview = await Previews.find(ctx.database, ctx.input.previewId);
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

	await Previews.store(ctx.database, preview.id, body.data.text);
});
```

`Previews` is your own repository. Every failure takes one of two endings. A `timeout` or
`network` error from `@sdxc/outbound` is `retryable`, and so is a `429` or a `5xx`: the next
attempt could succeed, so the job waits on the schedule. A refused host, a body over the cap or
a `404` reaches the same result on every attempt, so `ctx.exit` ends the message and reports
the run as failed instead of spending a day of retries on it.

`ctx.retry` takes a duration, and a plain number counts as milliseconds, which is what `delay`
answers. The schedule says how long to wait; the queue consumer's `max_retries` says how many
times. With this schedule, `max_retries: 12` gives up a little over a day after the first
failure.

## Retry inside one request

Some retries cannot leave the request, such as a profile fetch a page is waiting to render.
`retry` from `@sdxc/result` reruns a `Result`-returning function, and its `delay` accepts a
function of the attempt, so the same kind of schedule plugs straight in:

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

A function `delay` replaces `retry`'s own `backoff` option, so the ceiling and the jitter are
the schedule's. Keep the whole budget short, since a visitor is waiting through every attempt:
four tries here spend at most three seconds waiting. `jitter: "full"` draws anywhere from zero to the delay, the widest spread, which suits many requests retrying
the same API after the same blip. When the attempts run out, or `when` declines an error, the
failure holds a `RetryError`; [Result everywhere](/docs/conventions/result-everywhere) covers
narrowing it.

## Store the next attempt for a polled resource

A feed that fails keeps being polled, so its retry state outlives any queue message. It lives
on the row instead: a failure count, and the time the feed is next due. `at(attempt, now)` is
`now + delay(attempt)`, the value to store. Build the schedule from a function taking the
`Random` to draw from, so a test can pass a seeded one:

```typescript {% title="app/feeds/backoff.ts" %}
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

import { Feeds } from "~/app/data/feeds";
import { feedBackoff } from "~/app/feeds/backoff";
import { fetchFeed } from "~/app/feeds/fetch";
import jobs from "~/app/jobs";

const REFRESH_EVERY_MS = 60 * 60_000;

export default createJobHandler(jobs.feeds.sweep, async (ctx) => {
	let now = Date.now();
	let due = await Feeds.due(ctx.database, now);

	for (let feed of due) {
		let fetched = await fetchFeed(feed.url);
		if (isFailure(fetched)) {
			let failures = feed.failures + 1;
			await Feeds.recordFailure(ctx.database, feed.id, {
				failures,
				nextAttemptAt: feedBackoff.at(failures, now),
				error: fetched.error.message,
			});
			continue;
		}

		await Feeds.recordSuccess(ctx.database, feed.id, {
			entries: fetched.data,
			nextAttemptAt: now + REFRESH_EVERY_MS,
		});
	}

	ctx.log.set({ feeds: { due: due.length } });
});
```

`Feeds` and `fetchFeed` are your own: `due` selects rows whose `nextAttemptAt` has passed, and
`fetchFeed` answers a `Result`. The same shape fits any resource re-checked on a timer, such as
a [customer domain](/docs/identity-and-security/verify-domains) whose DNS has not caught up.
A stored time has no hold limit, so the ceiling can be a day, and the jitter keeps a thousand
feeds on one host that failed in the same sweep from all coming due in the same one.

## Write the steps by hand

A schedule your customers read in your documentation, such as webhook delivery, reads better
as a table of round numbers than as a curve. `steps` replaces the curve, and the last step
repeats for every attempt past the end:

```typescript {% title="app/webhooks/schedule.ts" %}
import { createBackoff } from "@sdxc/backoff";

export const deliveryBackoff = createBackoff({
	steps: [
		"15 seconds",
		"1 minute",
		"5 minutes",
		"30 minutes",
		"2 hours",
		"10 hours",
	],
	jitter: 0.1,
});
```

A delivery job like the one in [Receive and send webhooks](/docs/identity-and-security/webhooks)
then retries with `ctx.retry({ delay: deliveryBackoff.delay(ctx.attempts) })`. Set the consumer's
`max_retries` to the table's length and the table is the whole policy. The last step stops at
10 hours so that, with its jitter, it stays under the queue's 12-hour hold.

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

The fifth wrong password waits 1 second, the sixth 2, and from the fifteenth on every attempt
waits the full 15 minutes. The sign-in action calls `lockedFor` before checking the password
and answers `429` with that wait as `Retry-After`. This schedule has no jitter, since a person
sees the wait. When the count resets, after a success or a quiet day, is your rule: the
schedule answers only what a given count costs.

## Test the exact delays

Jitter makes every run different, which is the point in production and a problem in a test.
A seeded stream from `createRandom` makes the draws, and so the delays, the same on every run:

```typescript {% title="app/feeds/backoff.test.ts" %}
import { createRandom } from "@sdxc/random";
import { expect, test } from "vitest";

import { createFeedBackoff } from "~/app/feeds/backoff";

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

The first test pins the sequence, so a change to the base, the factor or the jitter shows up
as a changed number. The second runs on the system stream and asserts the band instead, which
is what holds whatever the draws. [Randomness you can replay](/docs/operations-and-testing/randomness)
covers seeds and streams beyond jitter.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — `ctx.retry`,
  `ctx.exit`, and the consumer's `max_retries`.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — the
  `retryable` flag on every `OutboundError`.
- [Join the IndieWeb](/docs/content-and-feeds/indieweb) — Webmention jobs that retry
  transient failures from a sending or receiving site.
- [`@sdxc/backoff`](/api/backoff) — every option, including `growth` and `factor`.
