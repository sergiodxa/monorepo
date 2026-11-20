---
title: Saves, settings and unlocks
description: Keep the reader's saves, settings and persistent data in the browser, hand them back to the player, and unlock an option on a second playthrough.
section:
    title: Visual novels
    order: 4.7
order: 2
lastUpdated: 2026-11-19
outcomes:
    - "Where the player hands you saves, settings and persistent data, and how to give them back"
    - "How to lock a menu option until an earlier playthrough reached an ending"
    - "When to raise the novel's version so older saves upgrade"
---

The novel stores nothing: it emits JSON and your app decides where the reader's games live. This
guide keeps the café's saves, settings and persistent data (lines read, endings reached, unlocked
pictures and music) in `localStorage`, and uses that data to offer regulars "the usual" once they
have reached the good ending.

```bash
npm add @sdxc/novel @sdxc/result remix
```

## Store what the player hands you

The player dispatches a bubbling `novel:save` event when the reader saves or the play autosaves,
and `novel:settings` when a setting changes. The novel emits `persist` whenever its persistent
data changes. This module keeps all three:

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

## Hand it back to the player

The game reads storage once it runs in the browser, then passes it back through `start`, `saves`
and `settings`, and listens to the player's events with `on()`:

```tsx {% title="resources/components/game.tsx" %}
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { on } from "remix/component";

import { novel } from "~/app/initializers/novel";
import type { Stored } from "~/resources/novel/storage";
import { readStored, storeSave, storeSettings } from "~/resources/novel/storage";

export function StoredGame(handle: Handle) {
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
}
```

Render `StoredGame` inside the `IntlProvider` of the `Game` entry from
[Make your first novel](/docs/visual-novels/first-novel). `start={{ from: stored.saves.quick }}`
resumes the quick save instead of starting over. The player reads `start` once, so mount a new
player, with a new `key`, to start another play.

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

When saved state changes shape in a way schema defaults cannot fill, raise the novel's
`version` and add a step from the version before. Each step answers a `Result`, so a save no
step can upgrade fails with `migration-failed` instead of loading half-converted:

```typescript {% title="app/initializers/novel.ts" %}
import { createNovel } from "@sdxc/novel";
import { success } from "@sdxc/result";

import { SCENES, STATE } from "~/resources/novel/declarations";

export const novel = createNovel({
	scenes: SCENES,
	state: STATE,
	initial: SCENES.prologue.opening,
	version: 2,
	migrate: {
		1: (save) =>
			success({ ...save, state: { ...(save.state as object), warmth: 0 } }),
	},
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

- [Test your story](/docs/visual-novels/test-your-story) — the next guide: reach every ending
  and replay each path.
- [Notifications, autosave and read lines](/docs/visual-novels/notifications-autosave-and-read-lines)
  — the autosave slot your `novel:save` listener already stores.
- [Make your first novel](/docs/visual-novels/first-novel) — the previous guide, where the café
  starts.
