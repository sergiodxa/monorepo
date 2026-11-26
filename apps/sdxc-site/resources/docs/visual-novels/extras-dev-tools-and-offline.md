---
title: Extras, dev tools and offline
description: Put chapter select and the encyclopedia on a title screen, show the cast, edit scenes with hot reload in the dev tools, and let readers keep playing without a connection.
section:
    title: Visual novels
    order: 4.7
order: 12
lastUpdated: 2026-11-24
outcomes:
    - "How a title screen places the library screens, starts a chapter replay and keeps an encyclopedia"
    - "How to run the dev tools beside the player in development only"
    - "What the offline worker caches, and how a page registers it"
---

The last pieces finish a game around the story: a title screen with chapter select and the
gallery, the dev tools that let you jump anywhere and edit a scene without losing your place,
and an offline cache so a reader on a train keeps playing.

```bash
npm add @sdxc/novel remix
```

## Show the extras on a title screen

The player's Extras menu holds Memories, the gallery, the characters screen, the music room, the
endings list, chapter select and scene replay, all read from persistent data. Each is also a component a title screen
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

A character stays `???` on the screen until they are `known` or a scene introduces them, and
each sprite stays locked until the stage shows the character in it once, in any playthrough.

## Keep an encyclopedia

The Encyclopedia gathers what the reader has learned in one book: the cast, the gallery, the
music, and topics you declare, such as places or terms. Declare the entries and pass them to
`createNovel`:

```typescript {% title="resources/novel/declarations.ts" %}
export const LORE = encyclopedia({
	places: topic({
		name: "lore.places",
		entries: {
			pier: entry({
				title: "lore.pier.title",
				summary: "lore.pier.summary",
				body: "lore.pier.body",
				sections: [
					{ title: "lore.pier.historyTitle", body: "lore.pier.history" },
				],
			}),
		},
	}),
});
```

An entry stays hidden until a scene teaches it with `ctx.learn(LORE.places.entries.pier)`, which
also shows a "New entry" toast. `known: true` opens it from the first play. The player offers
the Encyclopedia in its extras menu and on the title screen, and a named speaker's name on the
textbox opens it on them. `<Encyclopedia pages={["characters", "places", "gallery"]} />` picks
the pages and their order.

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

> [!WARNING]
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
- [Make your first novel](/docs/visual-novels/first-novel) — back to the start of the section.
- [Generated audio and images](/docs/visual-novels/generated-audio-and-images) — the previous
  guide.
