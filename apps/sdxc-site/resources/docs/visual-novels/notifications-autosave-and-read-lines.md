---
title: Notifications, autosave and read lines
description: Show toasts for unlocks, endings and your own news, keep an autosave the reader can load, and tint the lines a reader has already read.
section:
    title: Visual novels
    order: 4.7
order: 10
lastUpdated: 2026-11-19
outcomes:
    - "What the player shows as a toast, and how to push one of your own"
    - "When the play autosaves, and where the autosave reaches your storage"
    - "How to style lines read in an earlier playthrough"
---

Three conveniences come with `NovelPlayer.Default`: toasts for what the reader unlocks, an
autosave they can load after closing the tab, and a tint on lines they have read before. Each is
a behavior with a part or a style hook, so this guide is mostly about adjusting them.

```bash
npm add @sdxc/novel remix
```

## Show notifications

`NovelPlayer.Notifications`, part of `NovelPlayer.Default`, shows a toast when a picture or a
track unlocks for the first time ("CG unlocked", "Track unlocked"), when the reader reaches an
ending ("Ending 2/3"), and for every `ctx.notify(key, values)` a scene passes, translated like a
line. Replays show none. Place the part yourself in a composed player:

```tsx {% title="resources/components/cafe-player.tsx" %}
<NovelPlayer novel={novel}>
	<NovelPlayer.Stage>
		<NovelPlayer.Textbox />
	</NovelPlayer.Stage>
	<NovelPlayer.Notifications duration={6000} />
</NovelPlayer>
```

The toasts live in a `popover="manual"` element, so they sit in the top layer over the stage,
any open dialog and full screen. The region is a polite live region, each toast leaves after
`duration` milliseconds (4000 by default), and reduced motion drops the entrance animation.

## Push your own

News that does not come from a scene, such as a cloud save finishing, goes straight to the queue
the player holds. A toast is plain text, or a message key and values the part translates:

```tsx {% title="resources/components/cloud-sync.tsx" %}
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { on } from "remix/component";

export function CloudSync(handle: Handle) {
	let player = handle.context.get(NovelPlayer);
	return () => (
		<button
			type="button"
			mix={on("click", async () => {
				await fetch("/saves", {
					method: "PUT",
					body: JSON.stringify(player.saves.get("quick")),
				});
				player.notifications.push({ key: "cloud.synced", kind: "cloud" });
			})}
		>
			Sync
		</button>
	);
}
```

Each toast carries `data-kind` (`image`, `music`, `ending`, `notify`, or your own `kind`), and
the `--novel-notification-*` variables set its look:

```tsx {% title="resources/components/cafe-player.tsx" %}
<NovelPlayer.Default
	novel={novel}
	mix={css({
		"--novel-notification-inset": "auto auto 1rem 1rem",
		"--novel-notification-background": "#2b1d14",
		"--novel-notification-border": "1px solid #e8a55c",
	})}
/>
```

The words of the built-in toasts are the `imageUnlocked`, `musicUnlocked` and `endingReached`
labels, which the `labels` prop replaces like any other.

## Keep an autosave

The play saves into the `"auto"` slot (`AUTO_SLOT`) when a chapter starts, a new game's first
chapter included, every 20 lines, and when the reader switches away from the tab with lines read
since the last autosave. It saves through the player's own save path, so each
autosave reaches your `novel:save` listener with `event.slot === "auto"`, and the storage from
[Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) keeps it with no change. A
replay never autosaves.

The save and load screens list the autosave first, under the `autosave` label. It is load-only:
the reader loads it but never overwrites it. To resume from it on the next visit, start from it:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Default
	novel={novel}
	start={{ from: stored.saves.auto, persistent: stored.persistent }}
	saves={stored.saves}
/>
```

`behaviors={{ autosave: new AutosaveModel({ every: 10 }) }}` saves more often, and
[Customize behaviors](/docs/visual-novels/customize-behaviors) writes one that saves only at
chapters.

## Tint read lines

The textbox, its line and each backlog entry carry `data-novel-read` on a line the reader read
in an earlier playthrough, the same lines skip's read-only mode passes. `--novel-read-color`
(`inherit` by default) tints them:

```tsx {% title="resources/components/cafe-player.tsx" %}
<NovelPlayer.Default novel={novel} mix={css({ "--novel-read-color": "#b8b8d0" })} />
```

A rule of your own can target `[data-novel-read]` for anything beyond a color.

## Test the notifications

A scene's `notify` is an event of the play, so a test play logs it without a browser:

```typescript {% title="resources/novel/scenes/counter.test.ts" %}
import { createTestPlay } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SCENES } from "~/resources/novel/declarations";

test("the counter notifies the achievement once", async () => {
	let play = createTestPlay(novel, { scene: SCENES.prologue.counter });
	await play.advanceUntil("custom");
	await play.complete({ score: 3 });
	while (play.ending === undefined) await play.advance();

	let notified = play.events.filter((event) => event.type === "notify");
	expect(notified).toHaveLength(1);
});
```

## Where to go next

- [Generated audio and images](/docs/visual-novels/generated-audio-and-images) — the next guide:
  assets the page renders itself.
- [Add your own behaviors](/docs/visual-novels/add-your-own-behaviors) — the previous guide.
- [`@sdxc/novel`](/api/novel) — the behaviors' options and every theme variable.
