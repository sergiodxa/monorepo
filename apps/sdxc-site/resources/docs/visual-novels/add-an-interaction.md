---
title: Add an interaction
description: Hand the screen to a minigame of your own, type what goes in and what comes back, draw it inside the player and explore every outcome.
section:
    title: Visual novels
    order: 4.7
order: 4
lastUpdated: 2026-11-19
outcomes:
    - "How to declare an interaction's input and output and store its result in state"
    - "How a component finishes an interaction with `InteractionCompleteEvent`"
    - "Why `NovelPlayer.Interaction` fails to compile when an interaction has no case"
---

A minigame, a map or a puzzle is an interaction: your app renders it, and the engine validates
what it answers. This guide adds latte art to the café's counter, a button that scores the
reader's heart, and a line that only plays for a good score.

```bash
npm add @sdxc/novel remix
```

## Declare the interaction

Declare its input and output with any synchronous Standard Schema, and give the state a place
for the result. Add the map to `NovelTypes`, and pass it to
`createNovel({ interactions: INTERACTIONS })`:

```typescript {% title="resources/novel/declarations.ts" %}
import { interaction, interactions } from "@sdxc/novel";
import * as s from "remix/data-schema";

export const INTERACTIONS = interactions({
	latteArt: interaction({
		input: s.object({ pattern: s.string() }),
		output: s.object({ score: s.number() }),
	}),
});

export const STATE = s.object({
	cups: s.defaulted(s.number(), 0),
	warmth: s.defaulted(s.number(), 0),
	latte: s.optional(s.object({ score: s.number() })),
});

declare module "@sdxc/novel" {
	interface NovelTypes {
		interactions: typeof INTERACTIONS;
	}
}
```

## Hand it the screen

`ctx.custom()` stops the play at the interaction with its input, and `into` names where the
output goes. It accepts only a state path whose type fits the output:

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.custom(INTERACTIONS.latteArt, { input: { pattern: "heart" }, into: "latte" }),
ctx.when(
	(state) => (state.latte?.score ?? 0) >= 3,
	[ctx.say(CAST.mika, "counter.prettyHeart")],
),
```

## Finish it with an event

The component finishes by dispatching an `InteractionCompleteEvent`, typed by the output schema.
It bubbles as `novel:interaction:complete`, and the player answers the frame with it once:

```tsx {% title="resources/components/latte-art.tsx" %}
import type { Handle } from "remix/component";

import { InteractionCompleteEvent } from "@sdxc/novel/ui";
import { on } from "remix/component";

import { INTERACTIONS } from "~/resources/novel/declarations";

export function LatteArt(handle: Handle<{ pattern: string }>) {
	return () => (
		<button
			type="button"
			mix={on("click", (event) =>
				event.currentTarget.dispatchEvent(
					new InteractionCompleteEvent(INTERACTIONS.latteArt, { score: 3 }),
				),
			)}
		>
			{handle.props.pattern}
		</button>
	);
}
```

An output the schema refuses never reaches the state: the play answers with an `invalid-output`
error frame that carries the interaction again, so the reader can finish it once more.

## Draw it inside the player

Draw every interaction with one `NovelPlayer.Interaction` over your map. Its children function
receives the frame narrowed by `frame.interaction` and must return something for every
interaction, so a `switch` that misses one fails to compile:

```tsx {% title="resources/components/cafe-player.tsx" %}
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";

import { novel } from "~/app/initializers/novel";
import { LatteArt } from "~/resources/components/latte-art";
import { INTERACTIONS } from "~/resources/novel/declarations";

export function CafePlayer(_handle: Handle) {
	return () => (
		<NovelPlayer.Default novel={novel}>
			<NovelPlayer.Interaction interactions={INTERACTIONS}>
				{(frame) => {
					switch (frame.interaction) {
						case "latteArt":
							return <LatteArt pattern={frame.input.pattern} />;
					}
				}}
			</NovelPlayer.Interaction>
		</NovelPlayer.Default>
	);
}
```

Render `CafePlayer` where `Game` rendered `NovelPlayer.Default`.

To hear completions elsewhere, such as for analytics, listen on any ancestor with
`on("novel:interaction:complete", (event) => …)`; the event carries `interaction` and `output`.

## Test every outcome

`createTestPlay` answers the interaction with `complete()`, and `explore()` tries the outputs
you list for it, from its input and the state:

```typescript {% title="resources/novel/scenes/counter.test.ts" %}
import { createTestPlay, explore } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SCENES } from "~/resources/novel/declarations";

test("a pretty heart gets a compliment", async () => {
	let play = createTestPlay(novel, { scene: SCENES.prologue.counter });
	await play.advanceUntil("custom");
	await play.complete({ score: 3 });
	expect(play.frame).toMatchObject({ type: "line", key: "counter.prettyHeart" });
});

test("explore tries a poor and a pretty heart", async () => {
	let report = await explore(novel, {
		interactions: { latteArt: () => [{ score: 0 }, { score: 3 }] },
	});
	expect(report.unexplored).toEqual([]);
});
```

## Where to go next

- [Extend the story](/docs/visual-novels/extend-the-story) — the next guide: directives of your
  own, and data that lasts across playthroughs.
- [Test your story](/docs/visual-novels/test-your-story) — the previous guide, whose `explore()`
  this one feeds.
- [`@sdxc/novel`](/api/novel) — the interaction part's types and the events the player
  dispatches.
