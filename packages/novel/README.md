# @sdxc/novel

Visual novels declared like routes: typed scenes, a cast and assets, played as an async generator of frames.

## Installation

```sh
npm add @sdxc/novel remix
```

## Usage

Declare the scenes, the cast and the assets, write each scene as a list of directives, map the scenes onto their modules, and play.

```typescript
import * as s from "remix/data-schema";
import {
	assets,
	cast,
	character,
	createNovel,
	createScene,
	lazy,
	scene,
	scenes,
} from "@sdxc/novel";

export const SCENES = scenes({ prologue: { opening: scene(), cafe: scene() } });
export const CAST = cast({
	mika: character({ name: "cast.mika", sprites: { smile: "/mika/smile.webp" } }),
});
export const ASSETS = assets({ backgrounds: { cafe: "/bg/cafe.webp" } });

export default createScene(SCENES.prologue.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe, { transition: "fade" }),
	ctx.enter(CAST.mika, { at: "left", expression: "smile" }),
	ctx.say(CAST.mika, "opening.hello", { name: "Ada" }),
	ctx.choose({
		"opening.stay": [ctx.set("gold", (gold) => gold + 5), ctx.goto(SCENES.prologue.cafe)],
		"opening.leave": [ctx.ending("endings.early")],
	}),
]);

let novel = createNovel({
	scenes: SCENES,
	cast: CAST,
	assets: ASSETS,
	state: s.object({ gold: s.defaulted(s.number(), 10) }),
	initial: SCENES.prologue.opening,
});
novel.map(
	SCENES.prologue.opening,
	lazy(() => import("./scenes/opening.js")),
);

let started = novel.start();
if (started.status === "success") {
	let play = started.data;
	let step = await play.next();
	while (!step.done) {
		let frame = step.value;
		if (frame.type === "choice") step = await play.next(frame.choose(frame.options[0].id));
		else if (frame.type === "line" || frame.type === "pause")
			step = await play.next(frame.advance());
		else break;
	}
}
```

Type state, message keys and interactions once by augmenting `NovelTypes`:

```typescript
declare module "@sdxc/novel" {
	interface NovelTypes {
		state: StandardSchemaV1.InferOutput<typeof STATE>;
		messages: typeof en;
		interactions: typeof INTERACTIONS;
	}
}
```

`play.state` is the play as JSON for a save, `novel.start({ from })` validates a save and resumes it, and `play.rollback()` returns to the previous stop.

## Entry points

- `@sdxc/novel`: declarations, `createScene`, `createNovel`, `lazy`, and the frame, reply and state types.
- `@sdxc/novel/test`: `createTestPlay`, which drives a play by naming each reply.

```typescript
import { createTestPlay } from "@sdxc/novel/test";

let play = createTestPlay(novel, { seed: "mika", state: { gold: 40 } });
await play.advanceUntil("choice");
await play.choose("opening.stay");
expect(play.state.gold).toBe(45);
```
