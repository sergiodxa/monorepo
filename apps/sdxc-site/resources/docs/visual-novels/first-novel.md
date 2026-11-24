---
title: Make your first novel
description: Write the messages, declare the scenes, cast and assets, write each scene as a list of directives, and play the novel in a page with NovelPlayer.
section:
    title: Visual novels
    order: 4.7
order: 1
lastUpdated: 2026-11-24
outcomes:
    - "How to declare a novel's scenes, cast and assets, typed from your state and messages"
    - "How to write a scene as a list of directives and map it onto its declaration"
    - "Where to render `NovelPlayer.Default` so a page plays the novel"
---

This guide builds a short visual novel: a rainy evening in a café, a menu that changes what
happens at the counter, and two endings. With [`@sdxc/novel`](/api/novel), scenes, a cast and
assets are typed declarations, each scene is a module mapped onto its declaration, and
`NovelPlayer` plays the result with a textbox, menus, a backlog, saves, settings and extras. The
rest of this section builds on the café.

Here is the café, live. Click the stage or press Space to read on, and pick a different order
to reach the other ending:

<frame src="/frames/guides/first-novel/cafe">
The café novel playing in a 16:9 stage: Mika behind the counter of a café on a rainy night,
with the textbox, a menu of three orders and the player's controls.
</frame>

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
		leave: "Nothing, I was just leaving",
	},
	counter: {
		served: "Here you go. That's cup number {$cups} tonight.",
		warm: "You wrap both hands around the mug.",
		smile: "{#b}Come back soon{/b}, okay?",
		quiet: "Mika goes back to her crossword.",
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
		known: true,
		sprites: { smile: mikaSmile, laugh: mikaLaugh },
	}),
	you: character({ name: "cast.you", known: true }),
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
`you`) speaks without standing on stage. A character shows as `???` until a scene runs
`ctx.introduce(CAST.mika)`, and a replay names everyone met in any playthrough; `known: true`
names one from the first line, as both are here. `NovelTypes` types every scene from your state and
catalog: `set` takes only paths the state has, and `say` asks for exactly the values a message
declares.

> [!WARNING]
> A scene's name is its path, `prologue.counter` here, and saves are keyed by it. Renaming a
> scene, or moving it into another group, refuses every save that stands in it.

## Write the scenes

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
- **An option** is a list of directives, or an object with `when`, `do` and more, which
  [Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) uses.
- **`exit(character)`** takes one character off stage, and `clear()` takes every character off
  at once, each with the same optional transition (`ctx.clear({ transition: "fade" })`), so a
  chapter's last scene hands the next one an empty stage.
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

## Check the story

`check()` from `@sdxc/novel/test` reads every scene without playing it, and reports repeated
keys, jumps to unmapped scenes, undeclared assets and scenes nothing reaches:

```typescript {% title="app/initializers/novel.test.ts" %}
import { check } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("the story has no problems", async () => {
	expect((await check(novel)).problems).toEqual([]);
});
```

## Where to go next

- [Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) — keep the reader's
  games, settings and what earlier playthroughs reached, and unlock an option with it.
- [Test your story](/docs/visual-novels/test-your-story) — drive a play by name and reach every
  ending.
- [`@sdxc/novel`](/api/novel) — every directive, option, event and player part.
