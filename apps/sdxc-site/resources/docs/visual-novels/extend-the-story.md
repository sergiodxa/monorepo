---
title: Extend the story
description: Add directives of your own with a story extension, keep a slice of state per play, and keep achievements that last across playthroughs with a toast when one unlocks.
section:
    title: Visual novels
    order: 4.7
order: 5
lastUpdated: 2026-11-19
outcomes:
    - "How to add directives every scene can call, with a slice of state saved with the play"
    - "How to keep data across playthroughs with `persistent` and `ctx.remember`"
    - "Why an updater passed to `remember` must give the same result when repeated"
---

A dating sim tracks affection, and a game with achievements keeps them after the play ends. A
story extension adds both to every scene: directives of your own, a slice of state saved with
the play, and lasting data kept with the reader's persistent record. This guide adds affection
for Mika and an achievement with a toast.

```bash
npm add @sdxc/novel remix
```

## Declare an extension

`extension()` takes the slice's schema, its `initial` value, and the directives scenes call.
Methods answer ordinary directives, written with the scene directives plus `ctx.update()` for
the slice. Pass the list to `createNovel({ extensions: EXTENSIONS })` and add it to
`NovelTypes`:

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

## Keep data across playthroughs

Affection belongs to one play; an achievement outlives it. Declare lasting data with
`persistent: { state, initial }` and write it with `ctx.remember()`. Callbacks read it as
`tools.persistent.<name>`. An extension may keep lasting data only, with no per-play slice:

```typescript {% title="resources/novel/extensions.ts" %}
import type { Directive, LineKey } from "@sdxc/novel";

export const achievements = extension("achievements", {
	persistent: { state: s.array(s.string()), initial: [] },
	directives: (ctx) => ({
		unlock: (id: string, key: LineKey) => [
			ctx.remember((all) => (all.includes(id) ? all : [...all, id])),
			ctx.notify(key),
		],
		ifUnlocked: (id: string, directives: Directive[]) =>
			ctx.when(
				(_state, tools) => tools.persistent.achievements.includes(id),
				directives,
			),
	}),
});

export const EXTENSIONS = [affection, achievements] as const;
```

The list sits under `achievements` in the record `persist` emits, so the storage from
[Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) keeps it with no change. A
stored record without it, or one its schema refuses, reads as `initial`.

> [!WARNING]
> A rollback keeps lasting data, and passing a `remember` again after one applies it again. Write
> updaters that give the same result when repeated, like adding an id only when it is absent; a
> counter that adds one would count the same moment twice.

## Unlock an achievement with a toast

`ctx.notify(key, values)` passes without a stop and emits `notify`, which `NovelPlayer.Default`
shows as a toast. Add the message, then call the extension from a scene:

```typescript {% title="resources/locales/en.ts" %}
achievements: { regular: "Achievement unlocked: A regular" },
```

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.achievements.unlock("regular", "achievements.regular"),
ctx.ending("endings.regular"),
```

The toast plays once per pass: a rollback or a load that lands past it does not show it again,
and a replay never shows it. A title screen reads the list from the stored record as
`persistent.achievements`.

## Test the extension

A test play takes stored persistent data, lasting slices included, and logs every event:

```typescript {% title="resources/novel/extensions.test.ts" %}
import { createTestPlay } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("reaching the counter unlocks the regular achievement once", async () => {
	let play = createTestPlay(novel);
	await play.advanceUntil("choice");
	await play.choose("opening.coffee");
	await play.advanceUntil("custom");
	await play.complete({ score: 0 });
	while (play.ending === undefined) await play.advance();

	expect(play.persistent.achievements).toEqual(["regular"]);
	expect(play.events).toContainEqual({
		type: "notify",
		payload: {
			scene: "prologue.counter",
			key: "achievements.regular",
			values: undefined,
		},
	});
});

test("a second playthrough keeps the list as it was", async () => {
	let play = createTestPlay(novel, { persistent: { achievements: ["regular"] } });
	await play.advanceUntil("choice");
	await play.choose("opening.coffee");
	await play.advanceUntil("custom");
	await play.complete({ score: 0 });
	while (play.ending === undefined) await play.advance();

	expect(play.persistent.achievements).toEqual(["regular"]);
});
```

## Where to go next

- [Branch at runtime](/docs/visual-novels/branch-at-runtime) — the next guide: let the play pick
  a scene, weighted by affection.
- [Notifications, autosave and read lines](/docs/visual-novels/notifications-autosave-and-read-lines)
  — style the toast, or push one from code.
- [Add an interaction](/docs/visual-novels/add-an-interaction) — the previous guide.
