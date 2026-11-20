---
title: Test your story
description: Drive a play by naming each reply, check every scene without playing it, and explore every combination of choices to reach each ending.
section:
    title: Visual novels
    order: 4.7
order: 3
lastUpdated: 2026-11-19
outcomes:
    - "How to drive a scene with `createTestPlay` and assert on its state"
    - "How `check()` and `explore()` find problems no single play reaches"
    - "How to replay the path `explore()` reports for each ending"
---

A branching story hides its bugs on the paths nobody played. `@sdxc/novel/test` runs a play
without a browser: `createTestPlay` follows the replies you name, `check()` reads every scene
without playing it, and `explore()` plays every combination of choices and reports each ending
with the shortest path to it.

```bash
npm add @sdxc/novel
```

## Test a scene

`createTestPlay` starts a play from the initial scene, or from `scene` with `state`. A fixed
`seed` replays every random draw, and `persistent` stands in for earlier playthroughs. A reply
that does not fit the current frame throws, so the test fails where the story went wrong:

```typescript {% title="resources/novel/scenes/opening.test.ts" %}
import { createTestPlay } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SCENES } from "~/resources/novel/declarations";

test("a cocoa warms you up on the way to the counter", async () => {
	let play = createTestPlay(novel, { seed: "cocoa" });

	await play.advanceUntil("choice");
	await play.choose("opening.cocoa");

	expect(play.state.warmth).toBe(2);
	expect(play.scene).toBe(SCENES.prologue.counter);
});

test("the counter answers a warm customer with a smile", async () => {
	let play = createTestPlay(novel, {
		scene: SCENES.prologue.counter,
		state: { cups: 1, warmth: 2 },
	});

	while (play.ending === undefined) await play.advance();

	expect(play.transcript).toContainEqual(
		expect.objectContaining({ key: "counter.smile" }),
	);
	expect(play.ending?.key).toBe("endings.regular");
});
```

`advance()` answers one line, `advanceUntil(type)` advances to the next frame of that type, and
`transcript` and `events` keep every line, option and event so far.

## Check every scene

`check()` reads each mapped scene without playing a line. Errors break a play or a save: a key
used twice in a scene, a jump to a scene with no module, an undeclared asset or character.
Warnings may be intended, such as a scene the initial one never reaches:

```typescript {% title="app/initializers/novel.test.ts" %}
import { check } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("the story has no problems", async () => {
	let report = await check(novel);
	expect(report.ok).toBe(true);
	expect(report.problems).toEqual([]);
});
```

## Reach every ending

`explore()` plays every enabled option of every menu and reports each ending with its shortest
path, menus where every option is locked, and keys a catalog lacks. Each path is a seed and its
steps, so `follow()` replays it:

```typescript {% title="app/initializers/novel.test.ts" %}
import { createTestPlay, explore } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("every ending is reachable, and each path replays", async () => {
	let report = await explore(novel);

	expect(report.endings.map((ending) => ending.key).sort()).toEqual([
		"endings.rain",
		"endings.regular",
	]);
	expect(report.deadEndMenus).toEqual([]);
	expect(report.missingMessages).toEqual({});

	for (let ending of report.endings) {
		let play = createTestPlay(novel, { seed: ending.seed });
		await play.follow(ending.steps);
		expect(play.ending?.key).toBe(ending.key);
	}
});
```

Loops and hubs are walked once per state, so the walk finishes. `maxPaths` and `maxDepth` cap it
for a novel with thousands of branches, and `persistent` explores what a second playthrough
unlocks:

```typescript {% title="app/initializers/novel.test.ts" %}
let regulars = await explore(novel, {
	persistent: { endings: ["endings.regular"] },
	maxPaths: 5000,
});
```

> [!NOTE]
> `explore()` reports an interaction it has no outputs for under `unexplored`, and stops that
> path there. [Add an interaction](/docs/visual-novels/add-an-interaction) shows how to hand it
> the outputs to try.

## Where to go next

- [Add an interaction](/docs/visual-novels/add-an-interaction) — the next guide: a minigame the
  story hands the screen to.
- [Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) — the previous guide,
  whose unlock the `persistent` option explores.
- [`@sdxc/novel`](/api/novel) — every field of `createTestPlay`, `check()` and `explore()`.
