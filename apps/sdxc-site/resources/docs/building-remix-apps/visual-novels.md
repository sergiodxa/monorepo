---
title: Build a visual novel
description: Declare scenes, a cast and assets, write each scene as a list of directives, play it in a page with saves and settings, and test that every ending is reachable.
section:
    title: Interface
    order: 4.5
order: 10
lastUpdated: 2026-11-19
outcomes:
    - "How to declare a novel and write its scenes, typed from your state and messages"
    - "How to play it in a page with `NovelPlayer`, keeping saves, settings and unlocks in the browser"
    - "How to test a scene with `createTestPlay` and every ending with `explore`"
---

This guide builds a short visual novel: a rainy evening in a café, a menu that changes what
happens at the counter, two endings, and an option that only unlocks on a second playthrough.
With [`@sdxc/novel`](/api/novel), scenes, a cast and assets are typed declarations, each scene is
a module mapped onto its declaration, and `NovelPlayer` plays the result with a textbox, menus,
a backlog, saves, settings and extras.

```bash
npm add @sdxc/i18n @sdxc/novel @sdxc/ui remix
```

## Write the messages

Every line, name, option and title is a message key, so the story translates like the rest of
the app. Write the catalog `as const`, so a scene that names a missing key or leaves out a value
fails the type check:

```typescript {% title="resources/locales/en.ts" %}
export default {
	cast: { mika: "Mika", you: "You" },
	chapters: { prologue: "Prologue" },
	scenes: { opening: "Out of the rain", counter: "At the counter" },
	captions: { bell: "A door bell rings" },
	opening: {
		arrive: "The bell over the door rings as you step in out of the rain.",
		hello: "Welcome in! Sit anywhere you like.",
		ask: "What can I get you?",
		coffee: "Coffee, black",
		cocoa: "A hot cocoa",
		usual: "The usual",
		regularsOnly: "Only regulars have a usual.",
		leave: "Nothing, I was just leaving",
	},
	counter: {
		served: "Here you go. That's cup number {$cups} tonight.",
		warm: "You wrap both hands around the mug.",
		smile: "{#b}Come back soon{/b}, okay?",
		quiet: "Mika goes back to her crossword.",
		prettyHeart: "A heart! Not bad at all.",
	},
	endings: { rain: "Back into the rain", regular: "A regular" },
} as const;
```

Lines take MessageFormat markup: `{#b}`, `{#i}` and `{#shake}` style text,
`{#speed rate=2}…{/speed}` changes the typing speed, and `{#pause ms=600/}` holds the typewriter.

## Declare the story

The declarations are data and types only, so a page, a test or the server imports them without
loading a scene:

```typescript {% title="resources/novel/declarations.ts" %}
import { assets, cast, chapter, character, scene, scenes } from "@sdxc/novel";
import * as s from "remix/data-schema";

import type en from "~/resources/locales/en";

import bell from "./audio/bell.ogg";
import rain from "./audio/rain.ogg";
import theme from "./audio/theme.ogg";
import cafe from "./images/cafe.webp";
import mikaLaugh from "./images/mika-laugh.webp";
import mikaSmile from "./images/mika-smile.webp";

export const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: {
			opening: scene({ title: "scenes.opening" }),
			counter: scene({ title: "scenes.counter" }),
		},
	}),
});

export const CAST = cast({
	mika: character({
		name: "cast.mika",
		color: "#e86a92",
		sprites: { smile: mikaSmile, laugh: mikaLaugh },
	}),
	you: character({ name: "cast.you" }),
});

export const ASSETS = assets({
	backgrounds: { cafe },
	music: { theme },
	ambience: { rain },
	sounds: { bell: { src: bell, caption: "captions.bell" } },
});

export const STATE = s.object({
	cups: s.defaulted(s.number(), 0),
	warmth: s.defaulted(s.number(), 0),
});

declare module "@sdxc/novel" {
	interface NovelTypes {
		state: s.InferOutput<typeof STATE>;
		messages: typeof en;
	}
}
```

A `chapter` groups scenes for the chapter select, and a character without `sprites` (like
`you`) speaks without standing on stage. `NovelTypes` types every scene from your state and
catalog: `set` takes only paths the state has, and `say` asks for exactly the values a message
declares.

> [!WARNING]
> A scene's name is its path, `prologue.counter` here, and saves are keyed by it. Renaming a
> scene, or moving it into another group, refuses every save that stands in it.

## Write a scene

A scene module default-exports `createScene()`, which returns the scene's directives. The play
stops at every line, menu and interaction; staging directives (`show`, `enter`, `play`) run
through to the next stop.

```typescript {% title="resources/novel/scenes/opening.ts" %}
import { createScene } from "@sdxc/novel";

import { ASSETS, CAST, SCENES } from "~/resources/novel/declarations";

export default createScene(SCENES.prologue.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe, { transition: "fade" }),
	ctx.play(ASSETS.ambience.rain),
	ctx.play(ASSETS.sounds.bell),
	ctx.narrate("opening.arrive"),
	ctx.enter(CAST.mika, { at: "center", expression: "smile" }),
	ctx.say(CAST.mika, "opening.hello"),
	ctx.choose(
		{
			"opening.coffee": [
				ctx.set("cups", (cups) => cups + 1),
				ctx.goto(SCENES.prologue.counter),
			],
			"opening.cocoa": [
				ctx.set("cups", (cups) => cups + 1),
				ctx.set("warmth", (warmth) => warmth + 2),
				ctx.goto(SCENES.prologue.counter),
			],
			"opening.usual": {
				when: (_state, { persistent }) =>
					persistent.endings.includes("endings.regular"),
				visibility: "disabled",
				reason: "opening.regularsOnly",
				do: [ctx.set("cups", 2), ctx.goto(SCENES.prologue.counter)],
			},
			"opening.leave": [
				ctx.stop("ambience", { fade: 2000 }),
				ctx.ending("endings.rain"),
			],
		},
		{ prompt: "opening.ask" },
	),
]);
```

```typescript {% title="resources/novel/scenes/counter.ts" %}
import { createScene } from "@sdxc/novel";

import { ASSETS, CAST, SCENES } from "~/resources/novel/declarations";

export default createScene(SCENES.prologue.counter, (ctx) => [
	ctx.play(ASSETS.music.theme, { fade: 1500 }),
	ctx.say(CAST.mika, "counter.served", (state) => ({ cups: state.cups })),
	ctx.when(
		(state) => state.warmth > 0,
		[
			ctx.say(CAST.you, "counter.warm"),
			ctx.express(CAST.mika, { expression: "laugh" }),
			ctx.say(CAST.mika, "counter.smile"),
		],
		[ctx.narrate("counter.quiet")],
	),
	ctx.exit(CAST.mika, { transition: "fade" }),
	ctx.ending("endings.regular"),
]);
```

- **State is read inside callbacks.** `when`, `set` and a line's values receive the state at
  play time plus `{ random, persistent }`: the play's seeded random stream, and what every
  earlier playthrough read, chose and reached.
- **An option** is a list of directives, or an object with `when`, `do` and more. A failed
  `when` hides it, or shows it locked with its `reason` when `visibility` is `"disabled"`.
- **`ending(key)`** records the ending and finishes the play; `call(scene)` plays another scene
  and comes back.

## Create the novel

Build the novel once and map each scene onto its module. `lazy()` imports a scene the first time
a play reaches it, so a long novel starts without loading every chapter:

```typescript {% title="app/initializers/novel.ts" %}
import { createNovel, lazy } from "@sdxc/novel";

import en from "~/resources/locales/en";
import { ASSETS, CAST, SCENES, STATE } from "~/resources/novel/declarations";

export const novel = createNovel({
	scenes: SCENES,
	cast: CAST,
	assets: ASSETS,
	state: STATE,
	initial: SCENES.prologue.opening,
	messages: { en },
});

novel.map(
	SCENES.prologue.opening,
	lazy(() => import("~/resources/novel/scenes/opening")),
);
novel.map(
	SCENES.prologue.counter,
	lazy(() => import("~/resources/novel/scenes/counter")),
);
```

## Render the player

A novel holds functions, so it cannot travel from the server as props. Render the player in a
client entry of your own that imports the novel. `NovelPlayer.Default` is the whole player in
one component, and it reads its translator from `IntlProvider`:

```tsx {% title="resources/components/game.tsx" %}
import type { Handle } from "remix/component";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry, css } from "remix/component";

import { novel } from "~/app/initializers/novel";
import en from "~/resources/locales/en";

const RESOURCES = { en };

export const Game = clientEntry(
	import.meta.url,
	function Game(handle: Handle<{ locale: string }>) {
		return () => {
			let i18n = createI18n({
				locale: handle.props.locale,
				fallbackLanguage: "en",
				resources: RESOURCES,
			});
			return (
				<div mix={css({ blockSize: "100dvh" })}>
					<IntlProvider intl={i18n}>
						<NovelPlayer.Default novel={novel} />
					</IntlProvider>
				</div>
			);
		};
	},
);
```

The player fills its parent with a letterboxed 16:9 stage built from `@sdxc/ui`, so load
`@sdxc/ui/theme.css` in your document. The reader advances with a click, Space or Enter, and
the keyboard, touch and gamepad controls cover auto, skip, rollback, the backlog, saves and
settings.

The page renders `Game`, and `novel.links()` answers the `<link>` tags that preload the opening
scene's pictures and sounds and prefetch the scenes one jump away. Render each `NovelLink` as a
`<link>` with its `rel`, `href`, `as` and `crossorigin` in your layout's `<head>`:

```tsx {% title="app/http/controllers/play.tsx" %}
import { createAction } from "remix/router";

import { novel } from "~/app/initializers/novel";
import { Game } from "~/resources/components/game";
import DocumentLayout from "~/resources/layouts/document";
import { SCENES } from "~/resources/novel/declarations";
import routes from "~/routes/web";

export default createAction(routes.play, async (ctx) => {
	let links = await novel.links(SCENES.prologue.opening, { locale: ctx.locale });

	return ctx.render(
		<DocumentLayout title="Kissa" assets={ctx.assets} links={links}>
			<Game locale={ctx.locale} />
		</DocumentLayout>,
	);
});
```

`ctx.locale` comes from the `@sdxc/i18n` middleware, as
[Translate your app](/docs/building-remix-apps/translate-your-app) sets up. While the play runs,
the player prefetches the next scenes itself.

## Keep saves, settings and unlocks

The novel stores nothing; where a game is kept is yours to decide. The player dispatches a
bubbling `novel:save` event when the reader saves, `novel:settings` when a setting changes and
`novel:ending` when the play ends, and the novel emits `persist` whenever its persistent data
(lines read, endings, unlocks) changes. This module keeps them in the browser:

```typescript {% title="resources/novel/storage.ts" %}
import type { GameState } from "@sdxc/novel";
import type { NovelSettings, StoredSettings } from "@sdxc/novel/ui";

import { novel } from "~/app/initializers/novel";

export interface Stored {
	saves: Record<string, GameState>;
	persistent: unknown;
	settings: StoredSettings | undefined;
}

function read(key: string): unknown {
	return JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined;
}

function write(key: string, value: unknown) {
	localStorage.setItem(key, JSON.stringify(value));
}

export function readStored(): Stored {
	return {
		saves: (read("novel:saves") ?? {}) as Record<string, GameState>,
		persistent: read("novel:persistent"),
		settings: read("novel:settings") as StoredSettings | undefined,
	};
}

export function storeSave(slot: string, state: GameState) {
	write("novel:saves", { ...readStored().saves, [slot]: state });
}

export function storeSettings(settings: NovelSettings) {
	write("novel:settings", settings);
}

novel.on("persist", (persistent) => write("novel:persistent", persistent));
```

The game reads storage once it runs in the browser, hands it back through `start`, `saves` and
`settings`, and listens to the player's events with `on()`:

```tsx {% title="resources/components/game.tsx" %}
let stored: Stored | undefined;
handle.queueTask(() => {
	stored = readStored();
	void handle.update();
});

return () =>
	stored === undefined ? null : (
		<NovelPlayer.Default
			novel={novel}
			start={{ persistent: stored.persistent }}
			saves={stored.saves}
			settings={stored.settings}
			mix={[
				on("novel:save", (event) => storeSave(event.slot, event.state)),
				on("novel:settings", (event) => storeSettings(event.settings)),
			]}
		/>
	);
```

`start={{ from: stored.saves.quick }}` resumes the quick save instead. Storage is untrusted, so
a play started from a save validates it against your state schema first. When saved state changes
shape in a way schema defaults cannot fill, raise `createNovel({ version: 2, migrate: { … } })`
and older saves upgrade step by step.

## Compose your own player

`NovelPlayer` is a provider that draws only the parts you place inside it, and the controls are
mixins you apply to it, so a game keeps what it uses:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer novel={novel} mix={[keyboardControls(), touchControls()]}>
	<NovelPlayer.Stage>
		<NovelPlayer.Textbox />
		<NovelPlayer.Choices />
		<NovelPlayer.QuickMenu />
	</NovelPlayer.Stage>
	<NovelPlayer.Backlog />
	<NovelPlayer.Saves slots={3} />
	<NovelPlayer.Settings />
</NovelPlayer>
```

A part of your own reads the play with `handle.context.get(NovelPlayer)` (`player.frame`,
`player.answer(reply)`, `player.advance()`), and `behaviors` replaces how auto, skip or saves
work. Every color, image and size is a `--novel-*` variable listed in `NOVEL_THEME_VARIABLES`,
so restyling is a `css()` mixin on the player, such as
`css({ "--novel-textbox-background": "rgb(30 20 10 / 0.85)" })`.

## Test a scene

`createTestPlay` from `@sdxc/novel/test` drives a play by naming each reply, with no browser. A
fixed `seed` replays every random draw, and `persistent` stands in for earlier playthroughs:

```typescript {% title="resources/novel/scenes/opening.test.ts" %}
import { createTestPlay } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SCENES } from "~/resources/novel/declarations";

test("a cocoa warms you up on the way to the counter", async () => {
	let play = createTestPlay(novel, { seed: "cocoa" });

	let menu = await play.advanceUntil("choice");
	expect(
		menu.options.find((option) => option.id === "opening.usual"),
	).toMatchObject({ disabled: true, reason: "opening.regularsOnly" });

	await play.choose("opening.cocoa");
	expect(play.state.warmth).toBe(2);
	expect(play.scene).toBe(SCENES.prologue.counter);
});

test("a regular can order the usual", async () => {
	let play = createTestPlay(novel, {
		persistent: { endings: ["endings.regular"] },
	});

	await play.advanceUntil("choice");
	await play.choose("opening.usual");
	expect(play.state.cups).toBe(2);
});
```

## Test every ending

`check()` reads every scene without playing it and reports repeated keys, jumps to unmapped
scenes, undeclared assets and scenes nothing reaches. `explore()` plays every combination of
choices and reports each ending with the shortest path to it, menus where every option is
locked, and keys a catalog lacks:

```typescript {% title="app/initializers/novel.test.ts" %}
import { check, createTestPlay, explore } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("the story has no problems", async () => {
	expect((await check(novel)).problems).toEqual([]);
});

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

Loops and hubs are walked once per state, so they finish; `maxPaths` and `maxDepth` cap the walk
for a novel with thousands of branches.

## Add your own interaction

A minigame, a map or a puzzle is an interaction: your app renders it, and the engine validates
what it answers. Declare its input and output, add `interactions: typeof INTERACTIONS` to
`NovelTypes`, pass it to `createNovel({ interactions: INTERACTIONS })`, and give the state a
place for the result:

```typescript {% title="resources/novel/declarations.ts" %}
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
```

A scene hands it the input and names where the output goes; `into` accepts only a state path
whose type fits the output:

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.custom(INTERACTIONS.latteArt, { input: { pattern: "heart" }, into: "latte" }),
ctx.when(
	(state) => (state.latte?.score ?? 0) >= 3,
	[ctx.say(CAST.mika, "counter.prettyHeart")],
),
```

The component finishes by dispatching an `InteractionCompleteEvent`, typed by the output
schema:

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

Draw it with one `NovelPlayer.Interaction` inside the player. Its children function receives the
frame narrowed by `frame.interaction` and must return something for every interaction, so a
`switch` that misses one fails to compile:

```tsx {% title="resources/components/game.tsx" %}
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
```

Give `explore()` the outputs to try, or it reports the interaction under `unexplored`:

```typescript {% title="app/initializers/novel.test.ts" %}
let report = await explore(novel, {
	interactions: { latteArt: () => [{ score: 0 }, { score: 3 }] },
});
```

## Extend the story

A story extension adds directives every scene can call and a slice of state saved with the play.
Declare it with `extension()`, pass it to `createNovel({ extensions: EXTENSIONS })`, and add it
to `NovelTypes`:

```typescript {% title="resources/novel/extensions.ts" %}
import type { CharacterDeclaration } from "@sdxc/novel";

import { extension } from "@sdxc/novel";
import * as s from "remix/data-schema";

export const affection = extension("affection", {
	state: s.record(s.string(), s.number()),
	initial: {},
	directives: (ctx) => ({
		increase: (character: CharacterDeclaration, amount: number) =>
			ctx.update((value) => ({
				...value,
				[character.id]: (value[character.id] ?? 0) + amount,
			})),
	}),
});

export const EXTENSIONS = [affection] as const;

declare module "@sdxc/novel" {
	interface NovelTypes {
		extensions: typeof EXTENSIONS;
	}
}
```

A scene then calls `ctx.affection.increase(CAST.mika, 10)` and reads `state.affection.mika` in
its conditions. The slice is saved, rolled back, explored and tested like the rest of the state,
and a save made before the extension existed loads with its `initial` value.

## Show the extras on a title screen

The player's Extras menu holds Memories, the gallery, the music room, the endings list, chapter
select and scene replay, all read from persistent data. Each is also a component from
`@sdxc/novel/ui` that a title screen places itself. Picking a chapter dispatches a bubbling
`novel:replay` event with the `scene` to start and its `scope`:

```tsx {% title="resources/components/title-screen.tsx" %}
<ChapterSelect
	novel={novel}
	persistent={stored.persistent}
	mix={on("novel:replay", (event) => {
		start = {
			scene: event.scene,
			replay: event.scope,
			persistent: stored.persistent,
		};
		void handle.update();
	})}
/>
```

Render `NovelPlayer.Default` with that `start` once it is set. A replay finishes when the story
leaves the chapter and saves nothing.

## Edit scenes with the dev tools

`@sdxc/novel/dev` shows the play's position and state, jumps to any scene with edited state,
draws the scene graph and lists `check()`'s problems. Every play it starts reaches your player
through `restart`, and `reload()` swaps an edited scene in on the same line:

```tsx {% title="resources/components/dev-game.tsx" %}
import type { StartOptions } from "@sdxc/novel";
import type { DevTools } from "@sdxc/novel/dev";
import type { Handle } from "remix/component";

import { createDevTools, NovelDevTools } from "@sdxc/novel/dev";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry } from "remix/component";

import { novel } from "~/app/initializers/novel";

export const DevGame = clientEntry(
	import.meta.url,
	function DevGame(handle: Handle<{ locale: string }>) {
		let start: StartOptions = {};
		let restarts = 0;
		let devtools: DevTools | undefined;

		handle.queueTask(() => {
			let tools = createDevTools(novel, {
				restart(options) {
					start = options;
					restarts += 1;
					void handle.update();
				},
			});
			handle.signal.addEventListener("abort", () => tools.dispose());
			import.meta.hot?.accept(
				["../novel/scenes/opening.ts", "../novel/scenes/counter.ts"],
				(modules) => tools.reload(modules),
			);
			devtools = tools;
			void handle.update();
		});

		return () =>
			devtools === undefined ? null : (
				<>
					<NovelPlayer.Default key={restarts} novel={novel} start={start} />
					<NovelDevTools devtools={devtools} />
				</>
			);
	},
);
```

Changing the player's `key` mounts a new player on the play `restart` hands over, and Vite needs
each scene module's path written out. Wrap the player in an `IntlProvider` as `Game` does, and
render `import.meta.env.DEV ? <DevGame locale={ctx.locale} /> : <Game locale={ctx.locale} />` in
the page.

> [!NOTE]
> Keep `@sdxc/novel/dev` behind that check. Its panel lets anyone jump to any scene and rewrite
> state, and drawing the scene graph imports every scene module.

## Play offline

An opt-in service worker caches the novel's declared files and scene chunks as they are first
fetched, so a reader keeps playing without a connection. Build it as its own entry, served from
a path whose scope covers the game's page:

```typescript {% title="bootstrap/offline-worker.ts" %}
import { serveOffline } from "@sdxc/novel/offline/worker";

serveOffline({
	version: import.meta.env.VITE_BUILD_ID,
	budget: 200_000_000,
	modules: (url) => url.pathname.startsWith("/assets/scenes/"),
});
```

A new `version` deletes the older caches, `budget` evicts the least recently used files past
that many bytes, and `modules` matches the scene chunks, which Vite's `chunkFileNames` can place
under `/assets/scenes/`. The game registers the worker once it runs in the browser:

```tsx {% title="resources/components/game.tsx" %}
import { registerOffline } from "@sdxc/novel/offline";

handle.queueTask(() => {
	void registerOffline(novel, { url: "/offline-worker.js", type: "module" });
});
```

## Where to go next

- [`@sdxc/novel`](/api/novel) — every directive, option, event and player part.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the catalogs and
  translators the novel's lines go through.
- [Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it) —
  the browser entry that loads the game's island.
