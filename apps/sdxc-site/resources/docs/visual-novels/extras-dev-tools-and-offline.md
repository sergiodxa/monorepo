---
title: Extras, dev tools and offline
description: Put chapter select and the encyclopedia on a title screen, show the cast, edit scenes with hot reload in the dev tools, and let readers keep playing without a connection.
section:
    title: Visual novels
    order: 4.7
order: 12
lastUpdated: 2026-11-27
outcomes:
    - "How a title screen places the library screens, starts a chapter replay and shows the cast"
    - "How to link the dev tools to the player in development only, and preview any screen over any library"
    - "What the offline worker caches, and how a page registers it"
---

The last pieces finish a game around the story: a title screen with chapter select and the
gallery, the dev tools that let you jump anywhere and edit a scene without losing your place,
and an offline cache so a reader on a train keeps playing.

```bash
npm add @sdxc/novel remix
```

## Show the extras on a title screen

The player's Extras menu holds Memories, the encyclopedia (with the cast, the gallery and the
music room), the endings list, chapter select and scene replay, all read from persistent data. Each is also a component a title screen
places itself, given the novel and the stored `persistent` value. Picking a chapter dispatches a
bubbling `novel:replay` event with the `scene` to start and its `scope`:

```tsx {% title="resources/components/title-screen.tsx" %}
import type { StartOptions } from "@sdxc/novel";
import type { Handle } from "remix/component";

import { ChapterSelect, Gallery, NovelPlayer } from "@sdxc/novel/ui";
import { on } from "remix/component";

import { novel } from "~/app/initializers/novel";

export function TitleScreen(handle: Handle<{ persistent: unknown }>) {
	let start: StartOptions | undefined;
	return () => {
		let { persistent } = handle.props;
		if (start !== undefined)
			return <NovelPlayer.Default novel={novel} start={start} />;
		return (
			<main>
				<ChapterSelect
					novel={novel}
					persistent={persistent}
					mix={on("novel:replay", (event) => {
						start = {
							scene: event.scene,
							replay: event.scope,
							persistent,
						};
						void handle.update();
					})}
				/>
				<Gallery novel={novel} persistent={persistent} />
			</main>
		);
	};
}
```

A replay finishes when the story leaves the chapter, saves nothing and shows no notifications.
It names every character the reader met in any playthrough from its first line.
Keep one `persistent` value while the screen shows, since the screens read it once per render.

## Show the cast

The Characters screen lists the cast beside the chosen character's portrait, name and
description. Give a character a `description` message key for it to show:

```typescript {% title="resources/novel/declarations.ts" %}
export const CAST = cast({
	mika: character({
		name: "cast.mika",
		description: "cast.mikaAbout",
		sprites: { smile: mikaSmile, laugh: mikaLaugh },
	}),
});
```

The screen lists each character once the reader meets them, in any playthrough: a scene
introduces them, they speak a line, or the stage draws them. Each sprite stays locked until the
stage shows the character in it once. `lore: { listed: false }` leaves a passer-by off the list,
such as a prefect who speaks one line.

Give a character a `bio` to let their page grow as the story reveals them, and declare places and
terms the reader learns: [Keep an encyclopedia](/docs/visual-novels/encyclopedia) covers both.

## Edit scenes with the dev tools

`@sdxc/novel/dev` lets you debug a play without playing up to the moment you need. It takes
three pieces, all loaded in development only:

1. `createDevTools(novel, { restart })` connects to the novel. Every play the tools start
   (a jump, a hot reload, edited persistent data) reaches your player through `restart`.
2. `<NovelDevTools.Connect devtools={devtools} />` goes **inside** the player, among its
   parts, and in the title screen's `parts`. It links whichever is showing, so the panel can
   open screens, show toasts and play sounds.
3. `<NovelDevTools devtools={devtools} floating />` is the panel. `floating` adds a
   "Dev tools" button in the corner of the page. Place the panel inside your `IntlProvider`.

```tsx {% title="resources/components/game.tsx" %}
import type { StartOptions } from "@sdxc/novel";
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry } from "remix/component";

import { novel } from "~/app/initializers/novel";

type Dev = typeof import("@sdxc/novel/dev");

export const Game = clientEntry(
	import.meta.url,
	function Game(handle: Handle<{ locale: string }>) {
		let start: StartOptions = {};
		let restarts = 0;
		let dev: { module: Dev; devtools: InstanceType<Dev["DevTools"]> } | undefined;

		handle.queueTask(async () => {
			if (!import.meta.env.DEV) return;
			let module = await import("@sdxc/novel/dev");
			let devtools = module.createDevTools(novel, {
				restart(options) {
					start = options;
					restarts += 1;
					void handle.update();
				},
			});
			handle.signal.addEventListener("abort", () => devtools.dispose());
			import.meta.hot?.accept(["../novel/scenes/opening.ts"], (modules) =>
				devtools.reload(modules),
			);
			dev = { module, devtools };
			void handle.update();
		});

		return () => {
			let Panel = dev?.module.NovelDevTools;
			let connect =
				Panel === undefined || dev === undefined ? null : (
					<Panel.Connect devtools={dev.devtools} />
				);
			return (
				<>
					<NovelPlayer.Default
						key={String(restarts)}
						novel={novel}
						start={start}
						titleScreen={{ heading: "The Café", parts: connect }}
						skipTitle={restarts > 0}
					>
						{connect}
					</NovelPlayer.Default>
					{Panel === undefined || dev === undefined ? null : (
						<Panel devtools={dev.devtools} floating />
					)}
				</>
			);
		};
	},
);
```

`import.meta.env.DEV` is `false` in a production build, so the bundler drops the import and the
tools never ship. Changing the player's `key` mounts a new player on the play `restart` hands
over. `skipTitle` opens that remounted player on the play rather than on the title, and keeps the
title for **Back to the title screen** and the ending's button. Vite needs each hot-reloaded scene
module's path written out.

The panel's sections:

- **Play** and **Jump**: where the play stands, and a jump to any scene with its state edited as
  JSON.
- **Screens**: opens any library screen (Memories, the encyclopedia, the cast, the gallery, the
  music room, endings, chapters, scenes) over this play's library, everything unlocked or
  everything locked, without changing what the game stores. The preview draws inside the player,
  so it uses your theme, and its own switch changes the library while it is open. Settings, save,
  load and the backlog open over the play.
- **Persistent** and **Unlocks**: edit the stored record as JSON, or tick each image, track,
  look, entry, bio section, met character, ending and chapter. Lines read toggle all at once.
  Each change restarts the play on its line, and the game stores the new record.
- **Cast**: why each character counts as met: introduced, a read line they speak, or a look the
  stage drew.
- **Player**: shows each toast the player shows by itself ("New entry", a CG, an ending…),
  plays the hover and select sounds you pass as the player's `sounds`, toggles full screen and
  returns to the title screen. While the title shows, the library previews, the settings, the
  sounds and full screen work there too.
- **Flowchart**, **Events** and **Problems**: the scene graph, the event log and `check()`'s
  findings.

> [!WARNING]
> Keep `@sdxc/novel/dev` behind the `import.meta.env.DEV` check. Its panel lets anyone jump to
> any scene and rewrite state, and several sections import every scene module.

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

Generated assets need no caching: a Blob is already in the page, so the worker lists URLs only.

## Test what the worker caches

`offlineAssets()` answers the files the page sends the worker, every asset in every locale,
every sprite and layer, so a test can hold a new file to being cached:

```typescript {% title="app/initializers/novel.test.ts" %}
import { offlineAssets } from "@sdxc/novel/offline";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("the offline cache covers the café", () => {
	let files = offlineAssets(novel);

	expect(files.some((url) => url.includes("cafe"))).toBe(true);
	expect(files.some((url) => url.includes("mika-smile"))).toBe(true);
});
```

## Where to go next

- [`@sdxc/novel`](/api/novel) — the dev tools' API, the offline worker's options and every
  library screen.
- [Keep an encyclopedia](/docs/visual-novels/encyclopedia) — entries and character bios the
  reader fills in as they play.
- [Make your first novel](/docs/visual-novels/first-novel) — back to the start of the section.
- [Generated audio and images](/docs/visual-novels/generated-audio-and-images) — the previous
  guide.
