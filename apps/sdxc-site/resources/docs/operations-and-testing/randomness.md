---
title: Randomness you can replay
description: Pass random streams into your own code, seed them in tests, store the seed behind a draw, and resume a stream from storage.
section:
    title: Operations & testing
    order: 9
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "How to accept a `Random` in your own functions and seed it in tests"
    - "How to store the seed behind a draw so anyone can replay it"
    - "How to save a stream and resume it from storage"
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
stream can also save where it is and resume from there later.

```bash
npm add @sdxc/http @sdxc/random remix
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

`pick` throws a `RangeError` on an empty list, because that is a mistake in the calling code
rather than an outcome to handle. Check for the empty case first, as `pickTip` does, and the
function returns a value for every input it accepts.

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

Fifty draws from a seeded stream are the same fifty draws on every run, so a test that fails
fails the same way on your laptop and in CI. Assert the rule rather than the particular tip a
seed happens to produce.

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

Sorting first is what makes the draw depend only on the seed and the set of entrants, since
rows come back from a query in whatever order the database chose.

The action that closes the giveaway draws the seed with `systemSeed()`, so nobody picks it in
advance, and keeps it on the row:

```typescript {% title="app/http/controllers/giveaways/draw.ts" %}
import { conflict, notFound, ok } from "@sdxc/http/response/json";
import { systemSeed } from "@sdxc/random";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Giveaways } from "~/app/models/giveaways";
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

`Giveaways` is your own model. Publishing the seed and the entrant list next to the winners
turns "trust us" into a check anyone can run: `drawWinners(entrants, seed, prizes)` gives back
the stored winners. Recording the seed on the log the same way makes any run that should differ
each time, such as a nightly audit sample, replayable.

> [!WARNING]
> A seeded stream is predictable to anyone who learns its seed, so keep it to draws that guard
> nothing. Session ids, API keys, reset tokens and nonces come from `randomToken` in
> `@sdxc/crypto`, which [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto)
> covers.

## Save a stream and resume it

A seed replays a stream from the start. When a stream lives across requests, such as a bingo
hall calling one number per request, save where it is instead. `state()` is plain JSON, and
`restoreRandom(state)` continues from the next draw the original would have taken. A Durable
Object keeps it in its own storage:

```typescript {% title="app/models/bingo-hall.ts" %}
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
backup, so read it as untrusted input: `RANDOM_STATE_SCHEMA` validates the saved state, and
anything else opens a fresh stream instead of a broken one. The same state fits a D1 column as
JSON, validated on the way out exactly as above.

## Where to go next

- [Generate believable test data](/docs/operations-and-testing/test-data) — seeded fake
  people, companies and dates for tests and fixtures.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — the schedules
  that draw jitter from a stream.
- [Write executable specs](/docs/operations-and-testing/executable-specs) — seeded runs that
  replay with `--seed`.
