---
title: Customize behaviors
description: Change how auto mode, skip, saves or autosave work by passing your own implementation of a behavior to NovelPlayer through behaviors.
section:
    title: Visual novels
    order: 4.7
order: 8
lastUpdated: 2026-11-19
outcomes:
    - "What a player behavior is, and which ones the player has"
    - "How to tune a built-in behavior, subclass it, or write one from its interface"
    - "Why swapping a behavior never changes a save"
---

How the reader experiences a play, such as how long auto mode waits or when the game autosaves,
lives in the player's behaviors. Each one is an interface with a built-in class as its default,
and `NovelPlayer` takes replacements through its `behaviors` prop. Behaviors run in the browser
and never enter the game state, so swapping one changes no save.

```bash
npm add @sdxc/novel remix
```

## Know the slots

| Slot            | Interface               | Default              |
| --------------- | ----------------------- | -------------------- |
| `reveal`        | `RevealBehavior`        | `RevealModel`        |
| `auto`          | `AutoBehavior`          | `AutoModel`          |
| `skip`          | `SkipBehavior`          | `SkipModel`          |
| `backlog`       | `BacklogBehavior`       | `BacklogModel`       |
| `saves`         | `SavesBehavior`         | `SaveSlots`          |
| `settings`      | `SettingsBehavior`      | `SettingsModel`      |
| `countdown`     | `CountdownBehavior`     | `CountdownModel`     |
| `autosave`      | `AutosaveBehavior`      | `AutosaveModel`      |
| `notifications` | `NotificationsBehavior` | `NotificationsModel` |
| `read`          | `ReadBehavior`          | `ReadModel`          |

Each interface extends `TypedEventTarget` and dispatches `change` (or, for autosave, `save`) when
its state moves; the parts subscribe to the instance the player holds, as `player.auto`,
`player.skip` and so on.

## Tune a built-in

Several defaults take options. Pass a configured instance through `behaviors`, which the player
reads once, at mount:

```tsx {% title="resources/components/game.tsx" %}
import { AutosaveModel, NovelPlayer } from "@sdxc/novel/ui";

<NovelPlayer.Default
	novel={novel}
	behaviors={{ autosave: new AutosaveModel({ every: 10 }) }}
/>;
```

## Subclass a built-in

`AutoModel` asks `delay(line)` how long a line stays once its voice ends. A slower auto mode
overrides that one method:

```typescript {% title="resources/novel/slow-auto.ts" %}
import { AutoModel } from "@sdxc/novel/ui";

export class SlowAuto extends AutoModel {
	override delay(line: AutoModel.Line) {
		return super.delay(line) * 2;
	}
}
```

Keep the instance when you need a member beyond the interface, since the player's context is
typed by the interfaces:

```tsx {% title="resources/components/game.tsx" %}
let auto = new SlowAuto();

<NovelPlayer.Default novel={novel} behaviors={{ auto }} />;
```

## Write one from its interface

A behavior only has to implement its interface. This autosave saves at each chapter's start and
nowhere else; it asks with a `save` event, and the player saves at the stop it shows, through the
same path as the reader's saves:

```typescript {% title="resources/novel/chapter-autosave.ts" %}
import type { AutosaveBehavior } from "@sdxc/novel/ui";

import { AUTO_SLOT } from "@sdxc/novel/ui";
import { TypedEventTarget } from "remix/component";

export class ChapterAutosave
	extends TypedEventTarget<AutosaveBehavior.EventMap>
	implements AutosaveBehavior
{
	readonly slot = AUTO_SLOT;

	chapter(): void {
		this.dispatchEvent(new Event("save"));
	}

	line(): void {}
}
```

Pass it as `behaviors={{ autosave: new ChapterAutosave() }}`. The save screens list its slot
first, load-only, and the save still reaches your `novel:save` listener.

## Test a behavior

A behavior is a plain class, so a test calls it as the player would and listens for what it
dispatches:

```typescript {% title="resources/novel/chapter-autosave.test.ts" %}
import { AutoModel } from "@sdxc/novel/ui";
import { expect, test, vi } from "vitest";

import { ChapterAutosave } from "~/resources/novel/chapter-autosave";
import { SlowAuto } from "~/resources/novel/slow-auto";

test("saves at a chapter's start and never on a line", () => {
	let autosave = new ChapterAutosave();
	let save = vi.fn();
	autosave.addEventListener("save", save);

	autosave.line();
	autosave.chapter();

	expect(save).toHaveBeenCalledTimes(1);
});

test("slow auto waits twice as long", () => {
	let line = { length: 20, voiced: true, delay: 1000 };
	expect(new SlowAuto().delay(line)).toBe(2 * AutoModel.delayFor(line));
});
```

## Where to go next

- [Add your own behaviors](/docs/visual-novels/add-your-own-behaviors) — the next guide: a
  behavior the player has no slot for.
- [Compose your own player](/docs/visual-novels/compose-your-own-player) — the previous guide.
- [`@sdxc/novel`](/api/novel) — every behavior's interface and its default's options.
