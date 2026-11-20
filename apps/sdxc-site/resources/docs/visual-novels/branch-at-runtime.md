---
title: Branch at runtime
description: Let the play pick one of several scenes with goto.oneOf and call.oneOf, weighted by state, and build a day loop that draws one event a day.
section:
    title: Visual novels
    order: 4.7
order: 6
lastUpdated: 2026-11-19
outcomes:
    - "How `goto.oneOf` and `call.oneOf` draw a scene, and what a weight answers"
    - "What the play does when no candidate qualifies"
    - "How `explore()` reaches every scene a pick can draw"
---

A menu lets the reader choose; some branches belong to chance. A date sim draws one event a
day, and a café gets a different customer each evening. `ctx.goto.oneOf()` continues in one
scene drawn from a list, and `ctx.call.oneOf()` plays one and comes back. This guide turns the
café into a week of evenings.

```bash
npm add @sdxc/novel
```

## Declare the week

Each evening is a scene, and the loop is one more. Declare them beside the prologue, and give
the state a day counter:

```typescript {% title="resources/novel/declarations.ts" %}
export const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: {
			opening: scene({ title: "scenes.opening" }),
			counter: scene({ title: "scenes.counter" }),
		},
	}),
	week: chapter({
		title: "chapters.week",
		scenes: {
			evening: scene(),
			rush: scene({ title: "scenes.rush" }),
			baking: scene({ title: "scenes.baking" }),
			study: scene({ title: "scenes.study" }),
			regular: scene(),
			student: scene(),
			weekend: scene({ title: "scenes.weekend" }),
		},
	}),
});

export const STATE = s.object({
	cups: s.defaulted(s.number(), 0),
	warmth: s.defaulted(s.number(), 0),
	day: s.defaulted(s.number(), 0),
});
```

## Draw one event a day

`goto.oneOf(scenes, weight)` draws a candidate in proportion to its weight. The weight callback
reads the scene, the state and the tools, and answers a number or a boolean: `true` counts as 1,
while `false`, `0` and anything not positive and finite leave the scene out. Without it every
candidate weighs 1:

```typescript {% title="resources/novel/scenes/evening.ts" %}
import { createScene } from "@sdxc/novel";

import { SCENES } from "~/resources/novel/declarations";

export default createScene(SCENES.week.evening, (ctx) => [
	ctx.set("day", (day) => day + 1),
	ctx.when((state) => state.day > 7, [ctx.goto(SCENES.week.weekend)]),
	ctx.goto.oneOf(
		[SCENES.week.rush, SCENES.week.baking, SCENES.week.study],
		(scene, state) => {
			if (scene === SCENES.week.baking)
				return (state.affection.mika ?? 0) >= 10;
			if (scene === SCENES.week.rush) return 2;
			return true;
		},
	),
	ctx.narrate("week.quiet"),
	ctx.goto(SCENES.week.evening),
]);
```

Each event scene ends with `ctx.goto(SCENES.week.evening)`, so the loop runs until the weekend,
whose scene ends the story with `ctx.ending("endings.weekend")`.
The rush weighs 2, so it comes twice as often as the study night, and baking with Mika joins the
draw once her affection, from [Extend the story](/docs/visual-novels/extend-the-story), reaches 10.

When no candidate qualifies, the play continues with the next directive, so `week.quiet` is the
evening's default; no error is emitted.

## Play a scene and come back

`call.oneOf()` plays the drawn scene and returns to the next directive, which suits a vignette
inside a scene that carries on afterwards:

```typescript {% title="resources/novel/scenes/rush.ts" %}
import { createScene } from "@sdxc/novel";

import { CAST, SCENES } from "~/resources/novel/declarations";

export default createScene(SCENES.week.rush, (ctx) => [
	ctx.say(CAST.mika, "rush.busy"),
	ctx.call.oneOf([SCENES.week.regular, SCENES.week.student]),
	ctx.say(CAST.mika, "rush.phew"),
	ctx.goto(SCENES.week.evening),
]);
```

The draw comes from the play's seeded stream, so a save, a reload or a rollback picks the same
scene, and a save made inside the called scene returns after the pick.

## Explore every draw

`check()` counts every candidate as reachable and reports one without a module. `explore()`
branches over every candidate a pick can take at that point, and records each draw as a
`{ type: "pick", scene }` step, which `follow()` replays instead of the seeded draw. A fixed
`seed` makes a test play draw the same way on every run:

```typescript {% title="resources/novel/scenes/evening.test.ts" %}
import { createTestPlay, explore } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SCENES } from "~/resources/novel/declarations";

/** The last evening of the week: one draw, then the weekend. */
const LAST_EVENING = { scene: SCENES.week.evening, state: { day: 6 } };

test("an evening without Mika's affection never draws the baking night", async () => {
	for (let seed of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
		let play = createTestPlay(novel, { ...LAST_EVENING, seed });
		await play.advance();
		expect(play.scene).not.toBe(SCENES.week.baking);
	}
});

test("a reported path replays its draws", async () => {
	let report = await explore(novel, LAST_EVENING);

	for (let ending of report.endings) {
		let play = createTestPlay(novel, { ...LAST_EVENING, seed: ending.seed });
		await play.follow(ending.steps);
		expect(play.ending?.key).toBe(ending.key);
	}
});
```

## Where to go next

- [Compose your own player](/docs/visual-novels/compose-your-own-player) — the next guide: pick
  the player's parts and restyle them.
- [Extend the story](/docs/visual-novels/extend-the-story) — the previous guide, where affection
  comes from.
- [`@sdxc/novel`](/api/novel) — `goto`, `call` and the rest of the directives.
