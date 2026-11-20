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
[`@sdxc/novel`](/api/novel) declares a novel the way an app declares routes: scenes, a cast and
assets are typed maps, each scene is a module mapped onto its declaration, and a play runs as an
async generator of frames. Its `NovelPlayer` renders those frames with a textbox, menus, a
backlog, save slots, settings and an extras menu.

```bash
npm add @sdxc/i18n @sdxc/novel @sdxc/ui remix
```

## Write the messages

Every line, name, option and title in a novel is a message key, so the story translates like
the rest of the app. Write the catalog `as const`, so a scene that names a missing key or leaves
out a value fails the type check:

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

Lines take MessageFormat markup: `{#b}`, `{#i}` and `{#shake}` style their text,
`{#speed rate=2}…{/speed}` types it at that multiple of the reader's text speed, and
`{#pause ms=600/}` holds the typewriter.

## Declare the story

The declarations are data and types only, so a page, a test or the server imports them without
loading a single scene:

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

- **A chapter** groups scenes for the chapter select. A plain object groups them without one.
- **A character** has `sprites`, `layers` (`{ body: { … }, face: { … } }`, one variant per
  layer), or no image at all, like `you`, who speaks but never stands on stage.
- **An asset** is a URL. Importing the file through Vite gives the build's content-hashed URL;
  a map of locale to URL (`{ en: letterEn, ja: letterJa }`) localizes a picture with text in it.
- **`NovelTypes`** types every scene from your state and catalog: `set` takes only paths the
  state has, and `say` asks for exactly the values a message declares.

> [!WARNING]
> A scene's name is its path, `prologue.counter` here, and saves and the record of read lines are
> keyed by it. Renaming a scene, or moving it into another group, refuses every save that stands
> in it.

## Write a scene

A scene's module default-exports `createScene()`, which runs its builder once and keeps the list
of directives it returns. The play stops at every line, menu, `wait` and interaction; staging
directives (`show`, `enter`, `play`) run through to the next stop.

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

- **State is read only inside callbacks.** `when`, `set` and a line's values receive the state
  at play time and `{ random, persistent }`: `random` is the play's seeded stream, saved with it,
  and `persistent` is what every earlier playthrough read, chose, reached and unlocked.
- **A line's values are computed once**, when it is shown, and kept as shown in the backlog and
  the record of read lines, so they must be JSON.
- **A line's key is its place in the scene.** A save stands on the key of its line or menu, so
  adding or removing lines elsewhere in the scene keeps every save valid. A key appears once per
  scene; `check()` reports a repeat.
- **An option** is a list of directives, or an object with its directives in `do` when it needs
  more. A failed `when` hides it, or shows it locked with its `reason` when `visibility` is
  `"disabled"`. `once: true` drops it after it is taken, and a menu with `repeat: true` comes
  back after each branch until an option with `done: true` leaves it.
- **Characters stand** at `left`, `center` and `right`, or at any column `n/d` (`1/4`).
- **`call(scene)`** plays another scene and comes back, `wait(ms)` pauses without a line, and
  `ending(key)` records the ending and finishes the play.

## Create the novel

Build the novel once, from the declarations and the state schema, and map each scene onto its
module. `lazy()` imports a scene the first time a play reaches it, so a long novel starts without
loading every chapter:

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

With `messages`, a line whose key a catalog lacks is reported on the `error` event, and the
checks below list it per locale.

## Keep saves, settings and unlocks

Where a game is kept is yours to decide. The novel emits each save and every change to its
persistent data (lines read, options taken, endings, chapters, unlocked pictures and tracks) as
JSON, and the player dispatches a `novel:settings` event whenever the reader changes a setting.
This module keeps all three in the browser:

```typescript {% title="resources/novel/storage.ts" %}
import type { GameState } from "@sdxc/novel";
import type { NovelSettings, StoredSettings } from "@sdxc/novel/ui";

import { novel } from "~/app/initializers/novel";

export interface Stored {
	saves: Record<string, GameState>;
	persistent: unknown;
	settings: StoredSettings | undefined;
}

function read<Value>(key: string): Value | undefined {
	let value = localStorage.getItem(key);
	return value === null ? undefined : (JSON.parse(value) as Value);
}

function write(key: string, value: unknown) {
	localStorage.setItem(key, JSON.stringify(value));
}

export function readStored(): Stored {
	return {
		saves: read<Record<string, GameState>>("novel:saves") ?? {},
		persistent: read("novel:persistent"),
		settings: read<StoredSettings>("novel:settings"),
	};
}

export function storeSettings(settings: NovelSettings) {
	write("novel:settings", settings);
}

novel.on("save", ({ slot, state }) => {
	let saves = read<Record<string, GameState>>("novel:saves");
	write("novel:saves", { ...saves, [slot]: state });
});

novel.on("persist", (persistent) => write("novel:persistent", persistent));
```

Storage is untrusted, and the novel treats it that way: a play started from a save migrates and
validates it against your state schema first, and persistent data the schema refuses starts
empty. When saved state changes shape in a way schema defaults cannot fill, raise
`createNovel({ version: 2, migrate: { 1: (game) => success(upgrade(game)) } })`, with `success`
from `@sdxc/result`, and older saves upgrade step by step. Listeners also hear `scene`, `line`,
`choice`, `ending`, `unlock`, `chapter` and `error`, each with the payload and the play it fired
for, which is where analytics or achievements go.

## Render the player

A novel holds functions, so it cannot travel from the server as props. Render `NovelPlayer`
inside a client entry of your own, which imports the novel itself. The player reads its
translator from `IntlProvider`, and storage is read once the island runs in the browser:

```tsx {% title="resources/components/game.tsx" %}
import type { Handle } from "remix/component";

import type { Stored } from "~/resources/novel/storage";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry, css, on } from "remix/component";

import { novel } from "~/app/initializers/novel";
import en from "~/resources/locales/en";
import { LatteArt } from "~/resources/components/latte-art";
import { INTERACTIONS } from "~/resources/novel/declarations";
import { readStored, storeSettings } from "~/resources/novel/storage";

const RESOURCES = { en };

export const Game = clientEntry(
	import.meta.url,
	function Game(handle: Handle<{ locale: string }>) {
		let stored: Stored | undefined;
		handle.queueTask(() => {
			stored = readStored();
			void handle.update();
		});

		return () => {
			let i18n = createI18n({
				locale: handle.props.locale,
				fallbackLanguage: "en",
				resources: RESOURCES,
			});
			return (
				<div mix={css({ blockSize: "100dvh" })}>
					{stored === undefined ? null : (
						<IntlProvider intl={i18n}>
							<NovelPlayer.Default
								novel={novel}
								start={{ persistent: stored.persistent }}
								saves={stored.saves}
								settings={stored.settings}
								mix={on("novel:settings", (event) =>
									storeSettings(event.settings),
								)}
							>
								<NovelPlayer.Interaction interactions={INTERACTIONS}>
									{(frame) => {
										switch (frame.interaction) {
											case "latteArt":
												return (
													<LatteArt
														pattern={frame.input.pattern}
													/>
												);
										}
									}}
								</NovelPlayer.Interaction>
							</NovelPlayer.Default>
						</IntlProvider>
					)}
				</div>
			);
		};
	},
);
```

The player fills its parent with a 16:9 stage, letterboxed. Its screens are built from
`@sdxc/ui`, so load `@sdxc/ui/theme.css` in your document, as
[Build the interface](/docs/building-remix-apps/interface-with-remix-ui) does. `start` also takes
`from` (a save to resume, such as `stored.saves.quick`), `scene`, `state` and `seed`. The reader
advances with a click, Space or Enter, toggles auto with `a`, skips with `k` or a held Control,
rolls back with ↑ or the wheel, and opens the backlog with `l`, the save and load screens with
`s` and `o`, quick save and load with `q` and `w`, and the settings with Escape; touch and gamepads work too, and `labels` translates the
player's own words. The player also dispatches `novel:save` and `novel:ending`, which bubble, so
any ancestor can listen with `on()`.

`NovelPlayer.Default` is the whole player in one component. `NovelPlayer` itself is a provider
that draws the parts you place inside it, and the keyboard, touch and gamepad controls are mixins
you apply to it, so a game composes only what it uses:

```tsx
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

A part of your own reads the same state and actions with `handle.context.get(NovelPlayer)`:
`player.frame`, `player.state`, `player.answer(reply)`, `player.advance()`, and the reveal, auto,
skip, backlog, saves and settings behaviors a built-in part uses. The context also dispatches
`frame`, `phase` and `ending` events as each changes, for a class of your own to follow the play.
Each behavior is an interface with a built-in default, and the `behaviors` prop replaces any of
them, such as `behaviors={{ auto: new SlowAuto() }}` for a subclass of `AutoModel` that overrides
`delay(line)`. Every color, image and size the parts draw is a
`--novel-*` variable, listed in `NOVEL_THEME_VARIABLES`, so restyling the textbox is a `css()`
mixin on the player:

```tsx
css({
	"--novel-textbox-background": "rgb(30 20 10 / 0.85)",
	"--novel-textbox-border-image-source": "url(/ui/frame.png)",
	"--novel-textbox-border-image-slice": "24",
	"--novel-textbox-border-image-width": "24px",
	"--novel-accent": "#e8a55c",
});
```

`Game` is a client entry in your own `resources/`, so the browser entry that
[Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it#register-the-client-entry)
sets up already loads it. The page renders it, and `novel.links()` answers the `<link>` tags that
preload the opening scene's pictures and sounds and prefetch the scenes one jump away:

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

The layout renders them in its `<head>`, from a `links` prop typed as `NovelLink[]`:

```tsx {% title="resources/layouts/document.tsx" %}
<head>
	{handle.props.links?.map((link) => (
		<link
			key={link.href}
			rel={link.rel}
			href={link.href}
			as={link.as}
			crossorigin={link.crossorigin}
		/>
	))}
</head>
```

`ctx.locale` comes from the `@sdxc/i18n` middleware, as
[Translate your app](/docs/building-remix-apps/translate-your-app) sets up. While a play runs,
the player prefetches the next scenes itself as the reader enters each one; `prefetch={2}` looks
two jumps ahead and `prefetch={false}` turns it off.

## Test a scene

`createTestPlay` from `@sdxc/novel/test` drives a play by naming each reply, with no browser.
A fixed `seed` replays every random draw, and `persistent` stands in for earlier playthroughs:

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
	).toMatchObject({
		disabled: true,
		reason: "opening.regularsOnly",
	});

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

`play.transcript` lists every line shown and option taken, and `play.events` every event the play
emitted, for a test that asserts on the story as read.

## Test every ending

`check()` reads every scene without playing it: repeated keys, jumps to unmapped scenes,
undeclared assets and scenes nothing reaches. `explore()` plays every combination of choices from
the initial scene and reports each ending with the shortest path to it, menus where every option
is locked, and keys a catalog lacks:

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

A path that returns to the same place with the same state is walked once, so hubs and loops
finish. For a novel with thousands of branches, `maxPaths` and `maxDepth` cap the walk and
`report.capped` says when a cap stopped it.

## Add your own interaction

A minigame, a map or a puzzle is an interaction: the app renders it, and the engine validates
what it answers. Declare it with `interactions()` and `interaction()`, from schemas for what goes
in and what comes back, add it to `NovelTypes`, and pass it to
`createNovel({ interactions: INTERACTIONS })`:

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

declare module "@sdxc/novel" {
	interface NovelTypes {
		state: s.InferOutput<typeof STATE>;
		messages: typeof en;
		interactions: typeof INTERACTIONS;
	}
}
```

A scene hands it the input and names where the output goes; `into` accepts only a state path
whose type fits the output:

```typescript {% title="resources/novel/scenes/counter.ts" %}
import { createScene } from "@sdxc/novel";

import { ASSETS, CAST, INTERACTIONS, SCENES } from "~/resources/novel/declarations";

export default createScene(SCENES.prologue.counter, (ctx) => [
	ctx.play(ASSETS.music.theme, { fade: 1500 }),
	ctx.say(CAST.mika, "counter.served", (state) => ({ cups: state.cups })),
	ctx.custom(INTERACTIONS.latteArt, { input: { pattern: "heart" }, into: "latte" }),
	ctx.when(
		(state) => (state.latte?.score ?? 0) >= 3,
		[ctx.say(CAST.mika, "counter.prettyHeart")],
	),
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

The `Game` entry above draws it with one `NovelPlayer.Interaction` over `INTERACTIONS`. Its
children function receives the frame narrowed by `frame.interaction`, and must return something
for every interaction, so a `switch` that misses one fails to compile. The component finishes by
dispatching an `InteractionCompleteEvent`, which bubbles to the part and is typed by the
interaction's output schema:

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

An ancestor that also needs the result listens with `on("novel:complete", …)`.

`explore()` needs outputs to try for each interaction, and reports any it has none for under
`unexplored`:

```typescript {% title="app/initializers/novel.test.ts" %}
let report = await explore(novel, {
	interactions: { latteArt: () => [{ score: 0 }, { score: 3 }] },
});
```

## Extend the story

Interactions and the player's behaviors change how the reader experiences the play. A story
extension changes what the story itself can do: it adds directives every scene can call and a
slice of state saved with the play. Declare it with `extension()`, pass it to `createNovel`, and
add it to `NovelTypes`:

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

With `createNovel({ …, extensions: EXTENSIONS })`, a scene calls
`ctx.affection.increase(CAST.mika, 10)` and reads `state.affection.mika` in its conditions. The
slice lives at `state.affection`, so it is saved, rolled back, explored and tested like the rest
of the state, and a save made before the extension existed loads with its `initial` value.

## Show the extras on a title screen

The player's Extras menu opens Memories (each scene's lines as read), the CG gallery, the music
room, the endings list, chapter select and scene replay, all read from persistent data. In a
composed player, `NovelPlayer.Extras` offers the screens you give it as children, such as
`<MusicRoom titles={{ "music.theme": "tracks.theme" }} />` to name each track by a message key.
Each screen is also a component from `@sdxc/novel/ui` that a title screen places itself:

```tsx {% title="resources/components/title-screen.tsx" %}
<>
	<EndingsList novel={novel} persistent={stored.persistent} />
	<ChapterSelect
		novel={novel}
		persistent={stored.persistent}
		onSelect={(scene) =>
			play({ scene, replay: "chapter", persistent: stored.persistent })
		}
	/>
</>
```

`play` is your own function that mounts `NovelPlayer` with those options as `start`. A replay
plays the chapter (or with `replay: "scene"`, the scene) and finishes when the story leaves it,
saving nothing and recording only the lines it shows.

## Edit scenes with the dev tools

`@sdxc/novel/dev` follows the play through the novel's events. `NovelDevTools` shows its
position and state, jumps to any scene with state edited as JSON, resets persistent data, draws
the scene graph and lists `check()`'s problems with missing messages. Every edited play reaches
your player through `restart`, and `devtools.reload()` swaps an edited scene in and resumes on
the same line. Render it from a client entry the page uses only in development, so it never
ships to readers:

```tsx {% title="resources/components/dev-game.tsx" %}
import type { StartOptions } from "@sdxc/novel";
import type { DevTools } from "@sdxc/novel/dev";
import type { Handle } from "remix/component";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { createDevTools, NovelDevTools } from "@sdxc/novel/dev";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry } from "remix/component";

import { novel } from "~/app/initializers/novel";
import en from "~/resources/locales/en";

const RESOURCES = { en };

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

		return () => {
			if (devtools === undefined) return null;
			let i18n = createI18n({
				locale: handle.props.locale,
				fallbackLanguage: "en",
				resources: RESOURCES,
			});
			return (
				<IntlProvider intl={i18n}>
					<NovelPlayer.Default key={restarts} novel={novel} start={start} />
					<NovelDevTools devtools={devtools} />
				</IntlProvider>
			);
		};
	},
);
```

Changing the player's `key` mounts a new player on the play `restart` hands over. Vite needs
the accepted paths written out, so list each scene module. In the page, render
`import.meta.env.DEV ? <DevGame locale={ctx.locale} /> : <Game locale={ctx.locale} />`.

> [!NOTE]
> Keep `@sdxc/novel/dev` behind that check. Its panel lets anyone jump to any scene and rewrite
> state, and drawing the scene graph imports every scene module.

## Play offline

An opt-in service worker caches the novel's declared files and its scene chunks as they are
first fetched, so a reader keeps playing without a connection. The worker script imports none of
the engine:

```typescript {% title="bootstrap/offline-worker.ts" %}
import { serveOffline } from "@sdxc/novel/offline/worker";

serveOffline({
	version: import.meta.env.VITE_BUILD_ID,
	budget: 200_000_000,
	modules: (url) => url.pathname.startsWith("/assets/scenes/"),
});
```

Build it as its own entry, served from a path whose scope covers the game's page, and name the
scene chunks so `modules` finds them, such as with Vite's `chunkFileNames` under
`/assets/scenes/`. Content-hashed files are served from the cache first; any other file comes from
the network, with the cache as its fallback. A new `version` deletes the older caches, and
`budget` evicts the least recently used files past that many bytes.

The page registers it once the game runs, sending the list of declared files; add the voice
files your `voice` option finds through `extra`:

```tsx {% title="resources/components/game.tsx" %}
import { registerOffline } from "@sdxc/novel/offline";

handle.queueTask(() => {
	stored = readStored();
	void handle.update();
	void registerOffline(novel, { url: "/offline-worker.js", type: "module" });
});
```

## Where to go next

- [`@sdxc/novel`](/api/novel) — every directive, option and entry point.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the catalogs and
  translators the novel's lines go through.
- [Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it) —
  the browser entry that loads the game's island.
