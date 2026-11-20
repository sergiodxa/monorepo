---
title: Add your own behaviors
description: Build a behavior the player has no slot for, follow the play through the context's frame, phase and ending events, and publish it to your parts from a provider part.
section:
    title: Visual novels
    order: 4.7
order: 9
lastUpdated: 2026-11-19
outcomes:
    - "How a behavior follows the play through the context's `frame`, `phase` and `ending` events"
    - "How a provider part creates a behavior and publishes it to the parts inside it"
    - "Why the events carry no data, and where a listener reads the current value"
---

The built-in slots cover auto, skip, saves and the rest, and a game soon wants a behavior of its
own: a reading timer, a mood meter that follows who is speaking, a hint that appears when the
reader idles at a menu. This guide builds a session counter, the lines read and endings reached
since the page opened, and shows it in a corner of the stage.

```bash
npm add @sdxc/i18n @sdxc/novel remix
```

## Follow the play

The player's context is a `TypedEventTarget` that dispatches `frame`, `phase` and `ending` as
soon as each changes, before the parts render. The events carry no data: a listener reads the
context's getters, which always answer the current value. A behavior is a class that subscribes
with an `AbortSignal` and dispatches `change` when its own state moves:

```typescript {% title="resources/novel/session.ts" %}
import type { NovelPlayer } from "@sdxc/novel/ui";

import { TypedEventTarget } from "remix/component";

export class Session extends TypedEventTarget<{ change: Event }> {
	lines = 0;
	endings = 0;

	constructor(player: NovelPlayer.Context, signal: AbortSignal) {
		super();
		player.addEventListener(
			"frame",
			() => {
				if (player.frame?.type !== "line" || player.replaying) return;
				this.lines += 1;
				this.dispatchEvent(new Event("change"));
			},
			{ signal },
		);
		player.addEventListener(
			"ending",
			() => {
				if (player.ending === undefined) return;
				this.endings += 1;
				this.dispatchEvent(new Event("change"));
			},
			{ signal },
		);
	}
}
```

`phase` follows the frame's progress (`staging`, `typing`, `waiting`, `replying`), which suits a
behavior that reacts to the reader rather than the story, such as a hint shown after a minute
in `waiting`.

## Publish it from a provider part

A provider part creates the behavior with its own `handle.signal`, so the listeners go away
with it, and publishes it on its context:

```tsx {% title="resources/components/session.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { css } from "remix/component";

import { Session } from "~/resources/novel/session";

export function SessionProvider(handle: Handle<{ children?: RemixNode }, Session>) {
	handle.context.set(new Session(handle.context.get(NovelPlayer), handle.signal));
	return () => handle.props.children;
}

export function SessionCounter(handle: Handle) {
	let session = handle.context.get(SessionProvider);
	session.addEventListener("change", () => void handle.update(), {
		signal: handle.signal,
	});
	return () => (
		<p
			data-session-counter=""
			mix={css({
				position: "absolute",
				insetBlockStart: "1rem",
				insetInlineStart: "1rem",
			})}
		>
			Read {session.lines}, ended {session.endings}
		</p>
	);
}
```

Place the provider inside the player, around the parts that read it:

```tsx {% title="resources/components/cafe-player.tsx" %}
<NovelPlayer novel={novel} mix={keyboardControls()}>
	<SessionProvider>
		<NovelPlayer.Stage>
			<NovelPlayer.Textbox />
			<NovelPlayer.Choices />
			<SessionCounter />
		</NovelPlayer.Stage>
	</SessionProvider>
</NovelPlayer>
```

> [!NOTE]
> The behavior lives in the browser, beside the player, and never in the game state, so a save
> or a rollback leaves it as it was. Data the story itself must keep, and roll back, belongs in a
> [story extension](/docs/visual-novels/extend-the-story).

## Test it in a browser

Mount the provider inside a player in a Vitest Browser Mode test. Once the first line waits for
the reader (`data-phase="waiting"`), a click on the stage advances as the reader's would:

```tsx {% title="resources/components/session.browser.test.tsx" %}
import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { NovelPlayer } from "@sdxc/novel/ui";
import { render } from "remix/component/test";
import { expect, test, vi } from "vitest";

import { novel } from "~/app/initializers/novel";
import { SessionCounter, SessionProvider } from "~/resources/components/session";
import en from "~/resources/locales/en";

test("counts the lines the reader reads", async () => {
	let intl = createI18n({
		locale: "en",
		fallbackLanguage: "en",
		resources: { en },
	});
	let result = render(
		<IntlProvider intl={intl}>
			<NovelPlayer novel={novel} settings={{ textSpeed: 0 }}>
				<SessionProvider>
					<NovelPlayer.Stage>
						<NovelPlayer.Textbox />
						<SessionCounter />
					</NovelPlayer.Stage>
				</SessionProvider>
			</NovelPlayer>
		</IntlProvider>,
	);

	await vi.waitFor(() => {
		expect(result.$("[data-session-counter]")?.textContent).toBe(
			"Read 1, ended 0",
		);
		expect(result.$("[data-novel-player]")?.getAttribute("data-phase")).toBe(
			"waiting",
		);
	});
	result.$("[data-novel-surface]")?.click();
	await vi.waitFor(() => {
		expect(result.$("[data-session-counter]")?.textContent).toBe(
			"Read 2, ended 0",
		);
	});
	result.cleanup();
});
```

## Where to go next

- [Notifications, autosave and read lines](/docs/visual-novels/notifications-autosave-and-read-lines)
  — the next guide: the three conveniences the player ships.
- [Customize behaviors](/docs/visual-novels/customize-behaviors) — the previous guide, for the
  behaviors the player already has slots for.
- [`@sdxc/novel`](/api/novel) — everything the player's context reads and does.
