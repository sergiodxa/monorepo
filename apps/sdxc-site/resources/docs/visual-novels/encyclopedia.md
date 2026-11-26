---
title: Keep an encyclopedia
description: Gather the cast, the gallery, the music and your own topics in one book the reader fills as they play, with entries and character bios that open where the story reveals them.
section:
    title: Visual novels
    order: 4.7
order: 12.5
lastUpdated: 2026-11-25
outcomes:
    - "How to declare topics and entries, and open each one where the story reveals it"
    - "How a character's page grows from a description into a bio, section by section"
    - "How to pick the encyclopedia's pages, restyle it and test what a scene teaches"
---

A long story asks the reader to remember places, words and people. The Encyclopedia is one
book that remembers for them: the cast, the gallery, the music, and topics you declare, such as
places or terms. Every entry stays hidden until the story reveals it, so the book fills in as
the reader plays. This guide adds one to the café from
[Make your first novel](/docs/visual-novels/first-novel).

```bash
npm add @sdxc/novel remix
```

## Write the entries

An entry is a title, a one-line summary, a body and titled sections, each a message key. A blank
line in a message starts a new paragraph. Add these keys beside the story's messages, including
the line and the bio this guide uses for Mika:

```typescript {% title="resources/locales/en.ts" %}
export default {
	about: { mika: "Runs Kissa alone, and remembers every order." },
	bio: {
		mika: {
			cafe: "The café",
			cafeText:
				"She took it over from her aunt, and kept the stools and the bell.",
			sea: "At sea",
			seaText: "Before the café she worked three years on a ferry crew.",
		},
	},
	counter: {
		sailor: "I learned to make coffee in a ship's galley, believe it or not.",
	},
	lore: {
		places: "Places",
		terms: "Terms",
		cafe: {
			title: "Kissa",
			summary: "A café by the station, open until the last train.",
			body: "Six stools, two tables and a window that fogs up whenever it rains.\n\nMika runs it alone.",
			historyTitle: "History",
			history: "Her aunt opened it forty years ago, the week the station did.",
		},
		regular: {
			title: "Regulars",
			summary: "The customers Mika knows by order.",
			body: "Come back often enough and Mika starts the coffee when the bell rings.",
		},
	},
} as const;
```

## Declare the encyclopedia

`encyclopedia()` takes topics, each a `topic()` with a name and its entries. `known: true` opens
an entry from the first play, for what the reader would already know:

```typescript {% title="resources/novel/declarations.ts" %}
import { encyclopedia, entry, topic } from "@sdxc/novel";

export const LORE = encyclopedia({
	places: topic({
		name: "lore.places",
		entries: {
			cafe: entry({
				title: "lore.cafe.title",
				summary: "lore.cafe.summary",
				body: "lore.cafe.body",
				sections: [
					{ title: "lore.cafe.historyTitle", body: "lore.cafe.history" },
				],
				known: true,
			}),
		},
	}),
	terms: topic({
		name: "lore.terms",
		entries: {
			regular: entry({
				title: "lore.regular.title",
				summary: "lore.regular.summary",
				body: "lore.regular.body",
			}),
		},
	}),
});
```

Pass it to `createNovel` beside the cast and assets:

```typescript {% title="app/initializers/novel.ts" %}
export const novel = createNovel({
	scenes: SCENES,
	cast: CAST,
	assets: ASSETS,
	encyclopedia: LORE,
	state: STATE,
	initial: SCENES.prologue.opening,
	messages: { en },
});
```

## Reveal an entry

`ctx.learn(entry)` opens an entry at the line where the story first brings it up. The player
shows a "New entry: Regulars" toast the first time. The entry stays open in every later play,
replays included:

```typescript {% title="resources/novel/scenes/counter.ts" %}
export default createScene(SCENES.prologue.counter, (ctx) => [
	ctx.say(CAST.mika, "counter.served", (state) => ({ cups: state.cups })),
	ctx.learn(LORE.terms.entries.regular),
	// …
]);
```

An entry id is `<topic>.<entry>` (`terms.regular`), and persistent data keeps it in
`unlocked.entries`. `check()` reports a scene that teaches an entry the encyclopedia lacks.

## Grow a character's page

The encyclopedia's Characters page shows each character the reader has met, with their portrait
and every look the stage drew them in. A `description` adds a line about them, and a `bio` adds
titled sections that open one by one:

```typescript {% title="resources/novel/declarations.ts" %}
export const CAST = cast({
	mika: character({
		name: "cast.mika",
		color: "#e86a92",
		known: true,
		description: "about.mika",
		bio: {
			cafe: { title: "bio.mika.cafe", body: "bio.mika.cafeText", known: true },
			sea: { title: "bio.mika.sea", body: "bio.mika.seaText" },
		},
		sprites: { smile: mikaSmile, laugh: mikaLaugh },
	}),
});
```

A section marked `known` shows as soon as the reader meets the character. Any other waits for
`ctx.learn(character, section)`, at the line where the story reveals it:

```typescript {% title="resources/novel/scenes/counter.ts" %}
export default createScene(SCENES.prologue.counter, (ctx) => [
	ctx.say(CAST.mika, "counter.served", (state) => ({ cups: state.cups })),
	ctx.learn(LORE.terms.entries.regular),
	ctx.say(CAST.mika, "counter.sailor"),
	ctx.learn(CAST.mika, "sea"),
	// …
]);
```

The page numbers the sections in the order the `bio` declares them, so declare them in the order
a reader reads a life; the story is free to reveal them in any order.

## Pick the pages

`NovelPlayer.Default` offers the Encyclopedia in its Extras menu and on the title screen, and
a speaker's name in the textbox opens it on that character. Its pages are every learned entry,
Characters, each topic, the Gallery and the Music room. A novel without topics has no page of
every entry. `pages` picks and orders them, where `topics` stands for any topic not named:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Extras>
	<Memories />
	<Encyclopedia pages={["characters", "topics", "gallery"]} titles={TRACK_TITLES} />
	<EndingsList />
</NovelPlayer.Extras>
```

`titles` names the Music room's tracks. The title screen takes the same element in its `screens`.

## Restyle it

The book reads the same variables as the settings screen: `--novel-settings-tab-*` for the page
tabs, and `--novel-settings-panel-background`, `-panel-color` and `-divider` for the page. Three
more style the open entry: `--novel-encyclopedia-page-padding`,
`--novel-encyclopedia-current-background` and `--novel-encyclopedia-current-color`. Every part
carries a data attribute for anything the variables leave out:

```tsx {% title="resources/components/game.tsx" %}
mix={css({
	"--novel-settings-panel-background": "#f3ead6",
	"--novel-encyclopedia-current-background": "#0f6b43",
	"--novel-encyclopedia-current-color": "#f6e6bd",
	"& [data-novel-encyclopedia-article] h3": { fontFamily: "Georgia, serif" },
})}
```

The attributes are `data-novel-encyclopedia`, `-page`, `-content`, `-search`, `-article`,
`-topic`, `-summary` and `-contents`, and on a character's page `data-novel-character-bio`.

## Test what a scene teaches

`createTestPlay` records what a play learns in `persistent`, and `check()` reads every `learn`
without playing:

```typescript {% title="resources/novel/scenes/counter.test.ts" %}
import { createTestPlay } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SCENES } from "~/resources/novel/declarations";

test("the counter teaches the reader about regulars and Mika's past", async () => {
	let play = createTestPlay(novel, {
		scene: SCENES.prologue.counter,
		state: { cups: 1 },
	});

	while (play.ending === undefined) await play.advance();

	expect(play.persistent.unlocked.entries).toContain("terms.regular");
	expect(play.persistent.unlocked.bios).toContain("mika:sea");
});
```

## Where to go next

- [Extras, dev tools and offline](/docs/visual-novels/extras-dev-tools-and-offline) — the other
  library screens and the title screen that offers them.
- [Test your story](/docs/visual-novels/test-your-story) — drive a play by name and reach every
  ending.
- [`@sdxc/novel`](/api/novel) — every option of `entry()`, `topic()` and `Encyclopedia`.
