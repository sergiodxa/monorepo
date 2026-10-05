---
title: Randomness you can replay
description: Pass random streams into your own code, seed them in tests, store the seed behind a draw, and resume a stream from storage.
section:
    title: Operations & testing
    order: 8
order: 7
lastUpdated: 2026-10-05
---

`Math.random()` is easy to call and hard to live with. A function that calls it gives a
different answer on every run, so its test either asserts something vague or stubs a global
that every other module shares. A giveaway winner it picked cannot be shown to be fair,
because nobody can draw the same winner again. A bug that only shows up on one roll of the
dice shows up once.

[`@sdxc/random`](/api/random) makes the source of randomness a value you pass around. A
`Random` offers the draws you actually want: `int`, `float`, `bool`, `pick` and `shuffle`.
`systemRandom()` backs one with Web Crypto for production, and `createRandom(seed)` opens one
that produces the same values in the same order from the same seed, on any machine. A seeded
stream can also save where it is and resume from there later. Its main entry point has no
dependencies; `RANDOM_STATE_SCHEMA` in `@sdxc/random/schema` validates a saved stream with
`remix/data-schema`.

```bash
npm add @sdxc/random @sdxc/backoff @sdxc/http @sdxc/jobs remix
npm add -D @sdxc/sample
```

## Accept a `Random` in your own functions

Any function that draws takes a `Random` parameter and defaults it to `systemRandom()`.
Production code calls it without the argument, and a test passes a stream it controls. An
onboarding screen that shows one tip out of several is the smallest example:

```typescript {% title="app/services/onboarding.ts" %}
import type { Random } from "@sdxc/random";

import { systemRandom } from "@sdxc/random";

export interface Tip {
	id: string;
	text: string;
	audience: "everyone" | "admins";
}

export function pickTip(
	tips: readonly Tip[],
	isAdmin: boolean,
	random: Random = systemRandom(),
): Tip | null {
	let eligible = tips.filter((tip) => isAdmin || tip.audience === "everyone");
	if (eligible.length === 0) return null;
	return random.pick(eligible);
}
```

`pick` throws a `RangeError` on an empty list, and so does `int` on bounds that are not
integers or that run backwards, because those are mistakes in the calling code rather than
outcomes to handle. Check for the empty case first, as `pickTip` does, and the function
returns a value for every input it accepts.

`systemRandom()` reads Web Crypto through a small buffer, so a burst of draws costs one call.
Each call to it opens a new stream, which is cheap; a module that draws on every request can
also keep one at module level.

## Pass a seeded stream in tests

A test opens a stream on a seed named after itself. The same seed gives the same draws on
every run, so the test can assert exactly what the function did without touching a global:

```typescript {% title="app/services/onboarding.test.ts" %}
import { createRandom } from "@sdxc/random";
import { expect, test } from "vitest";

import { pickTip } from "~/app/services/onboarding";

const TIPS = [
	{ id: "invite", text: "Invite your team", audience: "admins" as const },
	{ id: "search", text: "Press / to search", audience: "everyone" as const },
	{ id: "export", text: "Export to CSV", audience: "everyone" as const },
];

test("members only see tips meant for everyone", () => {
	let random = createRandom("onboarding-members");
	let shown = Array.from({ length: 50 }, () => pickTip(TIPS, false, random));

	expect(shown.map((tip) => tip?.id)).not.toContain("invite");
});

test("a member with no eligible tips gets none", () => {
	let adminsOnly = TIPS.filter((tip) => tip.audience === "admins");

	expect(pickTip(adminsOnly, false, createRandom("onboarding-empty"))).toBeNull();
});
```

Fifty draws from a seeded stream are the same fifty draws on every run, so a test that passes
keeps passing and a test that fails fails the same way on your laptop and in CI. Assert the
rule rather than the particular tip a seed happens to produce, and a later change to how the
function draws does not rewrite the test.

## Draw a result you can replay

Some draws have to be checkable after the fact: a giveaway winner, the order of a raffle, a
reviewer assigned at random. Draw a fresh seed, draw from it, and store the seed with the
result. Anyone holding the seed and the same list can run the draw again and get the same
answer:

```typescript {% title="app/services/giveaway.ts" %}
import type { Seed } from "@sdxc/random";

import { createRandom } from "@sdxc/random";

export function drawWinners(
	entrantIds: readonly string[],
	seed: Seed,
	count: number,
) {
	let ordered = [...entrantIds].sort();
	return createRandom(seed).shuffle(ordered).slice(0, count);
}
```

Sorting first is what makes the draw depend only on the seed and the set of entrants. Rows
come back from a query in whatever order the database chose, and a shuffle of the same ids in
a different order lands on a different winner. `shuffle` returns a copy, so the caller's list
stays as it was.

The action that closes the giveaway draws the seed with `systemSeed()`, so nobody picks it in
advance, and keeps it on the row:

```typescript {% title="app/http/controllers/giveaways/draw.ts" %}
import { conflict, notFound, ok } from "@sdxc/http/response/json";
import { systemSeed } from "@sdxc/random";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Giveaways } from "~/app/repositories/giveaways";
import { drawWinners } from "~/app/services/giveaway";
import routes from "~/routes/web";

export default createAction(routes.giveaways.draw, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let giveaway = await Giveaways.find(ctx.db, id);
	if (giveaway === null) return notFound({ error: "No such giveaway" });
	if (giveaway.seed !== null) return conflict({ error: "Already drawn" });

	let seed = systemSeed();
	let entrants = await Giveaways.entrantIds(ctx.db, id);
	let winners = drawWinners(entrants, seed, giveaway.prizes);

	await Giveaways.close(ctx.db, id, { seed, winners });
	ctx.log.set({ giveaway: { id, seed, entrants: entrants.length } });
	return ok({ seed, winners });
});
```

`Giveaways` is your own repository over the tables in
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases). Publishing the
seed and the entrant list next to the winners turns "trust us" into a check anyone can run:
`drawWinners(entrants, seed, prizes)` gives back the stored winners.

When the seed can be something everyone already knows, you need not store it at all. A daily
puzzle opened on ``createRandom(`puzzle ${date}`)`` deals the same board to every player that
day, and next year's archive page rebuilds it from the date alone.

## Keep independent streams apart

Draws follow the order of the calls, so one extra draw early in a run shifts every value
after it. When a run has parts that should not disturb each other, give each part its own
stream with `derive(label)`:

```typescript {% title="app/services/season.ts" %}
import type { Seed } from "@sdxc/random";

import { createRandom } from "@sdxc/random";

export function openSeason(seed: Seed) {
	let season = createRandom(seed);
	return {
		fixtures: season.derive("fixtures"),
		weather: season.derive("weather"),
		injuries: season.derive("injuries"),
	};
}
```

A derived stream is seeded from its parent's seed and the label alone, so
`season.derive("weather")` yields the same values however much the other streams have drawn.
Adding a draw to how injuries work next month leaves every fixture and every forecast exactly
where it was. The derived seed is readable, `"<seed> weather"`, so a
log line naming it points straight at the stream.

## Save a stream and resume it

A seed replays a stream from the start. When a stream lives across requests, such as a bingo
hall calling one number per request, save where it is instead. `state()` is plain JSON, and
`restoreRandom(state)` continues from the next draw the original would have taken. A Durable
Object keeps it in its own storage:

```typescript {% title="app/objects/bingo-hall.ts" %}
import type { SeededRandom } from "@sdxc/random";

import { createRandom, restoreRandom, systemSeed } from "@sdxc/random";
import { RANDOM_STATE_SCHEMA } from "@sdxc/random/schema";
import { DurableObject } from "cloudflare:workers";
import * as s from "remix/data-schema";

const RANDOM_KEY = "random";

export class BingoHall extends DurableObject {
	async call(): Promise<number> {
		let random = await this.#stream();
		let number = random.int(1, 75);
		await this.ctx.storage.put(RANDOM_KEY, random.state());
		return number;
	}

	async #stream(): Promise<SeededRandom> {
		let stored = await this.ctx.storage.get(RANDOM_KEY);
		let parsed = s.parseSafe(RANDOM_STATE_SCHEMA, stored);
		if (parsed.success) return restoreRandom(parsed.value);
		return createRandom(systemSeed());
	}
}
```

Storage hands back whatever was written, by this deploy, an older one, or a hand-edited
backup, so read it as untrusted input. `RANDOM_STATE_SCHEMA` checks the seed's type and that
each of the four generator words is an unsigned 32-bit integer; anything else opens a fresh
stream instead of a broken one. The object holds other calls back while its storage read is in
flight, so two calls never draw from the same saved position.

The same state fits a D1 column as JSON. Store it beside the row it shaped, a saved game or a
half-run simulation, and validate it on the way out exactly as above.

## Log the seed of a run you may need to replay

Work that should differ on every run, such as a nightly audit that samples a few orders, still
deserves a replay when it finds something odd. Draw a fresh seed, record it on the run's log,
and open the stream on it:

```typescript {% title="app/jobs/orders/audit.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { createRandom, systemSeed } from "@sdxc/random";

import jobs from "~/app/jobs";
import { Orders } from "~/app/repositories/orders";

const AUDIT_RATE = 0.01;

export default createJobHandler(jobs.orders.audit, async (ctx) => {
	let seed = systemSeed();
	let random = createRandom(seed);
	let orders = await Orders.placedYesterday(ctx.database);
	let picked = orders.filter(() => random.bool(AUDIT_RATE));

	await Orders.flagForAudit(ctx.database, picked);
	ctx.log.set({ audit: { seed, sampled: picked.length, of: orders.length } });
});
```

The seed lands on the run's log line, so a question about why an order was or was not picked
is answered by running the same filter over the same list with that seed. The same move makes
a fuzz test or a property test replayable;
[Generate believable test data](/docs/operations-and-testing/test-data) shows it with the seed
read back from an environment variable.

## Hand a stream to other packages

Packages that draw take the same `Random`, so one seed can drive a whole test.
[`@sdxc/sample`](/api/sample) accepts an open `SeededRandom` as its `seed`, and
[`@sdxc/backoff`](/api/backoff) draws its jitter from a `random` option:

```typescript {% title="app/test/streams.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { createRandom } from "@sdxc/random";
import { createSample } from "@sdxc/sample";

export function testStreams(seed: string) {
	let random = createRandom(seed);
	return {
		sample: createSample({ seed: random.derive("people") }),
		backoff: createBackoff({
			base: "1 second",
			max: "5 minutes",
			jitter: 0.2,
			random: random.derive("jitter"),
		}),
	};
}
```

The fake people and the retry delays now come from one seed and stay independent of each
other. Without `random`, a backoff schedule draws its jitter from `systemRandom()`, which is
what spreads retries apart in production. A plugin for an executable spec receives
`context.random`, a `SeededRandom` already opened on the run's seed and the test's identity, so
its values replay with `--seed` like everything else in the run.

## Make secrets with Web Crypto

`@sdxc/random` draws numbers, elements and orderings. Session ids, API keys, reset tokens,
nonces and IVs come from Web Crypto directly or from `randomToken` and `randomBytes` in
`@sdxc/crypto`, which
[Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) covers. A
seeded stream is predictable to anyone who learns its seed, which is exactly what makes it
useful for a draw you want to replay and what keeps it to draws that guard nothing.

## Where to go next

- [Generate believable test data](/docs/operations-and-testing/test-data): seeded fake people,
  companies and dates, and a fuzz run that prints its seed.
- [Test Workers apps](/docs/operations-and-testing/testing): the Vitest projects these tests
  run in.
- [Write executable specs](/docs/operations-and-testing/executable-specs): seeded runs that
  replay with `--seed`.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff): the schedules that
  draw jitter from a stream.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases): where a stored
  seed or stream state lives.
