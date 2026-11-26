---
title: Saves, settings and unlocks
description: Keep the reader's saves, settings and persistent data in the browser, open on a title screen, and unlock an option on a second playthrough.
section:
    title: Visual novels
    order: 4.7
order: 2
lastUpdated: 2026-11-25
outcomes:
    - "How to keep saves, settings and persistent data in the browser, and what the settings screen offers"
    - "How to lock a menu option until an earlier playthrough reached an ending"
    - "When to raise the novel's version so older saves upgrade"
---

The novel stores nothing: it emits JSON and your app decides where the reader's games live. This
guide keeps the café's saves, settings and persistent data (lines read, endings reached, unlocked
pictures and music) in `localStorage`, opens the café on a title screen, and uses that data to
offer regulars "the usual" once they have reached the good ending.

```bash
npm add @sdxc/novel @sdxc/result remix
```

## Keep it in the browser

The player dispatches a bubbling `novel:save` event when the reader saves or the play autosaves,
and `novel:settings` when a setting changes; the novel emits `persist` whenever its persistent
data changes. `LocalStorageStore` keeps all three in `localStorage`: `read()` answers the player's
`saves`, `settings` and `start`, and the `sync()` mixin stores every change from then on.

```tsx {% title="resources/components/game.tsx" %}
import type { Handle } from "remix/component";

import { LocalStorageStore } from "@sdxc/novel/storage/local-storage";
import { NovelPlayer } from "@sdxc/novel/ui";

import { novel } from "~/app/initializers/novel";

const STORAGE = new LocalStorageStore({ prefix: "cafe" });

export function StoredGame(handle: Handle) {
	let stored: LocalStorageStore.Stored | undefined;
	handle.queueTask(() => {
		stored = STORAGE.read();
		void handle.update();
	});

	return () =>
		stored === undefined ? null : (
			<NovelPlayer.Default novel={novel} {...stored} mix={STORAGE.sync()} />
		);
}
```

Render `StoredGame` inside the `IntlProvider` of the `Game` entry from
[Make your first novel](/docs/visual-novels/first-novel). It reads storage once the game runs in
the browser, since the server has none. A private window or a full quota reads as nothing stored
and the play goes on unsaved. The player reads `start` once, so mount a new player, with a new
`key`, to start another play.

## Let the reader change the settings

Escape, or **Settings** in the quick menu, opens the settings screen, and every change reaches
`sync()` as one `novel:settings` event. It sorts the settings into tabs:

- **Text**: text speed (characters a second, or instantly), the auto-mode delay, what skip passes
  through (read text only, or all of it) and the text size. A sample line types at the chosen
  speed, so the reader sees it before playing.
- **Sound**: the master volume and one per channel (music, ambience, sounds, voices).
- **Accessibility**: a dyslexia-friendly typeface and reading every line aloud.

Each row shows the setting's current value beside its control, and **Reset settings** restores
`DEFAULT_SETTINGS`. Every word on the screen is a label (`settingsText`, `textPreview`,
`resetSettings`, `back` and the rest), so it translates through the player's `labels`, and it
reads the `--novel-settings-*` variables for its tabs, page, dividers and preview:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Default
	novel={novel}
	{...stored}
	labels={{ settingsSound: "Audio", textPreview: "The bell over the door rings." }}
	mix={[
		STORAGE.sync(),
		css({
			"--novel-settings-panel-background": "#fbf4e8",
			"--novel-settings-tab-selected-background": "#e86a92",
			"--novel-settings-tab-selected-color": "#fff",
		}),
	]}
/>
```

## Open on a title screen

Give `NovelPlayer.Default` a `titleScreen` and it opens on a title whose **Continue** resumes the
newest stored save:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Default
	novel={novel}
	{...stored}
	mix={STORAGE.sync()}
	titleScreen={{ heading: "The Café" }}
/>
```

[A title screen](/docs/visual-novels/title-screen) adds your logo, art and styling.

> [!NOTE]
> Storage is untrusted. A play started from a save validates it against your state schema first,
> and a save the schema refuses fails with `invalid-state`, which the player shows.

## Unlock an option on a second playthrough

Every callback receives `persistent` beside the state, which is what earlier playthroughs left.
An option whose `when` fails is hidden, or shown locked with its `reason` when `visibility` is
`"disabled"`. Add the messages, then the option:

```typescript {% title="resources/locales/en.ts" %}
opening: {
	usual: "The usual",
	regularsOnly: "Only regulars have a usual.",
},
```

```typescript {% title="resources/novel/scenes/opening.ts" %}
"opening.usual": {
	when: (_state, { persistent }) => persistent.endings.includes("endings.regular"),
	visibility: "disabled",
	reason: "opening.regularsOnly",
	do: [ctx.set("cups", 2), ctx.goto(SCENES.prologue.counter)],
},
```

The same data feeds the Extras menu: the gallery, the music room, the endings list and chapter
select all read it, so storing `persist` is what fills them.

## Upgrade older saves

When saved state changes shape in a way schema defaults cannot fill, append a step to
`migrate`. Saves are stamped with one more than the number of steps, and an older save runs
every step after its version, in order. Each step answers a `Result`, so a save a step fails on
answers `migration-failed` instead of loading half-converted:

```typescript {% title="app/initializers/novel.ts" %}
import { createNovel } from "@sdxc/novel";
import { success } from "@sdxc/result";

import { SCENES, STATE } from "~/resources/novel/declarations";

export const novel = createNovel({
	scenes: SCENES,
	state: STATE,
	initial: SCENES.prologue.opening,
	migrate: [
		/** Version 1 to 2: adds warmth. */
		(save) =>
			success({ ...save, state: { ...(save.state as object), warmth: 0 } }),
	],
});
```

A field that only gained a schema default needs no step: a save without it loads with the
default.

## Test the unlock

`createTestPlay` takes `persistent`, which stands in for earlier playthroughs:

```typescript {% title="resources/novel/scenes/opening.test.ts" %}
import { createTestPlay } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("a newcomer sees the usual locked", async () => {
	let menu = await createTestPlay(novel).advanceUntil("choice");
	expect(
		menu.options.find((option) => option.id === "opening.usual"),
	).toMatchObject({
		disabled: true,
		reason: "opening.regularsOnly",
	});
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

## Where to go next

- [A title screen](/docs/visual-novels/title-screen) — the next guide: your logo, art and menu
  over the saves stored here.
- [Test your story](/docs/visual-novels/test-your-story) — reach every ending and replay each
  path.
- [Notifications, autosave and read lines](/docs/visual-novels/notifications-autosave-and-read-lines)
  — the autosave slot your `novel:save` listener already stores.
- [Make your first novel](/docs/visual-novels/first-novel) — the previous guide, where the café
  starts.
