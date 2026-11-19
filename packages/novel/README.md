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

A menu option that needs more than its directives is an object whose directives go in `do`:

```typescript
ctx.choose({
	"cafe.flirt": {
		when: (state) => state.charm >= 50,
		visibility: "disabled",
		do: [ctx.goto(SCENES.date)],
	},
});
```

## Saves, persistent data and events

The novel stores nothing: it emits JSON on events and the app keeps it. `play.save(slot)` emits `save`, `novel.start({ from })` migrates and validates a save before resuming it, and `novel.start({ persistent })` takes the lines read, options taken, endings, chapters and unlocks of earlier playthroughs, which the play updates and emits on `persist`.

```typescript
novel.on("save", ({ slot, state }) => localStorage.setItem(`save:${slot}`, JSON.stringify(state)));
novel.on("persist", (persistent) => localStorage.setItem("persistent", JSON.stringify(persistent)));
novel.on("error", (error) => reportError(error));

let play = novel.start({
	from: JSON.parse(localStorage.getItem("save:1") ?? "null") ?? undefined,
	persistent: JSON.parse(localStorage.getItem("persistent") ?? "null"),
});
```

`play.state` is the play as JSON at the current stop, and `play.rollback()` returns to the previous stop. `scene`, `line`, `choice`, `ending`, `unlock` and `chapter` report what a play does, each listener receiving the payload and the play; `novel.use(plugin)` installs a function that registers listeners. A save carries the novel's `version`; `createNovel({ version: 2, migrate: { 1: (game) => success({ ...game, state: upgrade(game.state) }) } })` upgrades older saves step by step.

Voices come from `createNovel({ voice })`, asked once per locale when the novel has `locales` (or `messages`), which fits a folder per locale loaded with a Vite glob:

```typescript
const VOICES = import.meta.glob<string>("./voice/*/*/*.ogg", {
	query: "?url",
	import: "default",
	eager: true,
});

createNovel({
	// ...
	locales: ["en", "ja"],
	voice: ({ speaker, key, locale }) => VOICES[`./voice/${locale}/${speaker}/${key}.ogg`],
});
```

## Entry points

- `@sdxc/novel`: declarations, `createScene`, `createNovel`, `lazy`, and the frame, reply, state and event types.
- `@sdxc/novel/ui`: `NovelPlayer` and the parts it is built from (`Stage`, `Textbox`, `ChoiceMenu`, `Backlog`, `SaveScreen`, `SettingsScreen`, `QuickMenu`, `AudioMixer`), as `remix/component` components.
- `@sdxc/novel/test`: `createTestPlay`, which drives a play by naming each reply; `check`, the static checks over every scene; and `explore`, which plays every combination of choices.

```typescript
import { check, createTestPlay, explore } from "@sdxc/novel/test";

let play = createTestPlay(novel, { seed: "mika", state: { gold: 40 } });
await play.advanceUntil("choice");
await play.choose("opening.stay");
expect(play.state.gold).toBe(45);

expect((await check(novel)).ok).toBe(true);

let report = await explore(novel, {
	interactions: { fishing: () => [{ caught: 0 }, { caught: 5 }] },
});
for (let ending of report.endings) {
	let replay = createTestPlay(novel, { seed: ending.seed });
	await replay.follow(ending.steps);
	expect(replay.ending?.key).toBe(ending.key);
}
```

Render the player inside your own client entry, since a novel holds functions and cannot travel as props. It reads its translator from `IntlProvider` or `setIntl()` in `@sdxc/i18n/ui`, and the screens use `@sdxc/ui`, so load `@sdxc/ui/theme.css`:

```tsx
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry } from "remix/component";

export const Game = clientEntry(import.meta.url, function Game() {
	return () => (
		<NovelPlayer
			novel={novel}
			start={{ from: loadSave(), persistent: loadPersistent() }}
			settings={loadSettings()}
			onSettingsChange={(settings) => localStorage.setItem("settings", JSON.stringify(settings))}
			renderInteraction={Fishing}
		/>
	);
});
```

Saves reach the novel's `save` event (and `onSave`), so `novel.on("save", …)` stores them; pass them back through `saves` for the load screen. Space, Enter and a click advance, `a` toggles auto, `k` or a held Control skips, ↑ and the wheel roll back, `l` opens the backlog, `q`/`w` quick save and load, `h` hides the interface, `f` goes full screen and Escape opens the settings.
