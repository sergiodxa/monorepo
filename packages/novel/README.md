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

let started = novel.start({
	from: JSON.parse(localStorage.getItem("save:1") ?? "null") ?? undefined,
	persistent: JSON.parse(localStorage.getItem("persistent") ?? "null"),
});
if (started.status === "failure") showError(started.error); // an invalid or unmigratable save
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
- `@sdxc/novel/ui`: `NovelPlayer` and the parts it is built from (`Stage`, `Textbox`, `ChoiceMenu`, `Backlog`, `SaveScreen`, `SettingsScreen`, `QuickMenu`, `AudioMixer`), and the library screens (`Memories`, `Gallery`, `MusicRoom`, `EndingsList`, `ChapterSelect`, `SceneReplay`), as `remix/component` components.
- `@sdxc/novel/test`: `createTestPlay`, which drives a play by naming each reply; `check`, the static checks over every scene; and `explore`, which plays every combination of choices.
- `@sdxc/novel/dev`: `createDevTools` and the `NovelDevTools` panel, for development builds only.
- `@sdxc/novel/offline` and `@sdxc/novel/offline/worker`: `registerOffline` for the page and `serveOffline` for an opt-in service worker.

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

export const Game = clientEntry("/app/game.tsx#Game", function Game() {
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

The player's Extras menu opens Memories, the CG gallery, the music room, the endings list, chapter select and scene replay. Each is also a component a title screen can place itself, reading the stored persistent data; a chosen chapter or scene starts as a replay, which saves nothing and records only the lines it shows:

```tsx
<ChapterSelect
	novel={novel}
	persistent={loadPersistent()}
	onSelect={(scene) => play({ scene, replay: "chapter", persistent: loadPersistent() })}
/>
```

While a play runs, the player prefetches the scenes one jump ahead of the current one (their modules, images, sounds, voices and music); `prefetch={2}` looks further and `prefetch={false}` turns it off.

Lines may use MessageFormat markup: `{#b}`, `{#i}` and `{#shake}` style their text, `{#speed rate=2}…{/speed}` types its text at that multiple of the reader's text speed (half without `rate`), and `{#pause ms=600/}` holds the typewriter (400ms without `ms`). Pass `markup` to add your own names, as elements or as components receiving `Trans.MarkupProps`.

Saves reach the novel's `save` event (and `onSave`), so `novel.on("save", …)` stores them; pass them back through `saves` for the load screen. Space, Enter and a click advance, `a` toggles auto, `k` or a held Control skips, ↑ and the wheel roll back, `l` opens the backlog, `q`/`w` quick save and load, `h` hides the interface, `f` goes full screen and Escape opens the settings.

## Prefetching

`novel.links(scene, { depth, locale })` reads the scene arrays and answers `<link>` descriptors: `preload` for the images and sounds the starting scene shows, `prefetch` for its music and voices and for every file of the scenes within `depth` jumps (1 by default). It imports the lazy modules on the way, so it is async; `data:` URLs are left out. `novel.reachable(scene, { depth, locale })` answers the same scenes with their files, for a player to prefetch while a play runs.

```tsx
let links = await novel.links(scenes.prologue.opening, { locale: "en" });
<head>
	{links.map((link) => (
		<link rel={link.rel} href={link.href} as={link.as} crossorigin={link.crossorigin} />
	))}
</head>;
```

## Developer tools

`createDevTools(novel, { restart })` follows the play through the novel's events, and `NovelDevTools` renders it: the play's position and state, a jump to any scene with state edited as JSON and checked against the schema, persistent data with resets, the scene graph as a flowchart, the event log, and `check()`'s problems with missing messages. Every edited play reaches the app through `restart`, which passes the options to the player as `start`. `devtools.reload(modules)` swaps hot-reloaded scenes and resumes the play on the same line:

```tsx
let devtools = createDevTools(novel, { restart: (start) => remountPlayer(start) });
import.meta.hot?.accept(["./scenes/opening.ts", "./scenes/cafe.ts"], (modules) =>
	devtools.reload(modules),
);
<NovelDevTools devtools={devtools} />;
```

## Offline

The app's worker script calls `serveOffline()`, and the page registers it with `registerOffline()`, which sends the novel's declared files (add voice files through `extra`). The worker caches only those files and the scene module chunks `modules` names, as they are first fetched: content-hashed files (`/assets/<name>-<hash>.<ext>`) cache-first, any other file from the network first with the cache as its offline fallback. It never answers a navigation, deletes older versions' caches on activation, and keeps an optional `budget` in bytes by evicting the least recently used files.

```typescript
// sw.ts, built as its own entry and served from the game's scope
import { serveOffline } from "@sdxc/novel/offline/worker";
serveOffline({
	version: BUILD_ID,
	budget: 200_000_000,
	modules: (url) => url.pathname.startsWith("/assets/scenes/"),
});

// the page
import { registerOffline } from "@sdxc/novel/offline";
await registerOffline(novel, { url: "/sw.js", type: "module", extra: Object.values(VOICES) });
```
