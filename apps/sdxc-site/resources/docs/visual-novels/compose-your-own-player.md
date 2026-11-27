---
title: Compose your own player
description: Place only the parts your game uses inside NovelPlayer, write a part of your own from the player's context, and restyle everything with --novel-* variables.
section:
    title: Visual novels
    order: 4.7
order: 7
lastUpdated: 2026-11-19
outcomes:
    - "How to compose a player from its parts and input mixins"
    - "How a part of your own reads the play and answers it through the context"
    - "Where every color, image and size of the player is set"
---

`NovelPlayer.Default` is a fine start, but a game soon wants three save slots instead of six, a
menu drawn as phone messages, or a textbox framed by its own artwork. `NovelPlayer` is a provider
that draws only the parts you place inside it, and the controls are mixins you apply to it, so a
game keeps what it uses and replaces the rest.

```bash
npm add @sdxc/i18n @sdxc/novel remix
```

## Place the parts

Every part is a member of `NovelPlayer`, renders a real element that takes `mix`, and renders
nothing while it has nothing to show. Leaving a part out removes it:

```tsx {% title="resources/components/cafe-player.tsx" %}
import type { Handle } from "remix/component";

import {
	EndingsList,
	Gallery,
	keyboardControls,
	NovelPlayer,
	touchControls,
} from "@sdxc/novel/ui";

import { novel } from "~/app/initializers/novel";

export function CafePlayer(_handle: Handle) {
	return () => (
		<NovelPlayer novel={novel} mix={[keyboardControls(), touchControls()]}>
			<NovelPlayer.Stage>
				<NovelPlayer.Textbox />
				<NovelPlayer.Choices />
				<NovelPlayer.QuickMenu>
					<NovelPlayer.Extras>
						<Gallery />
						<EndingsList />
					</NovelPlayer.Extras>
				</NovelPlayer.QuickMenu>
			</NovelPlayer.Stage>
			<NovelPlayer.Backlog />
			<NovelPlayer.Saves slots={3} />
			<NovelPlayer.Settings />
			<NovelPlayer.Notifications />
		</NovelPlayer>
	);
}
```

`gamepadControls()` adds a standard gamepad. Each control mixin stands down while a dialog or a
field has focus, and a click on the stage advances without any of them.

## Write a part of your own

A part reads the play with `handle.context.get(NovelPlayer)`. The context is one stable object
whose getters always read the current play: `frame`, `phase`, `state`, `persistent`, and actions
such as `answer(reply)`, `advance()`, `save(slot)` and `open(screen)`. A reply comes from the
frame's own method, so a part never builds one by hand:

```tsx {% title="resources/components/phone-choices.tsx" %}
import type { Handle } from "remix/component";

import { Message, NovelPlayer } from "@sdxc/novel/ui";
import { css, on } from "remix/component";

export function PhoneChoices(handle: Handle) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let frame = player.frame;
		if (frame?.type !== "choice") return null;
		return (
			<ul mix={css({ display: "grid", gap: "0.5rem", justifyItems: "end" })}>
				{frame.options.map((option) => (
					<li key={option.id}>
						<button
							type="button"
							disabled={option.disabled}
							mix={on("click", () =>
								player.answer(frame.choose(option.id)),
							)}
						>
							<Message i18nKey={option.label} />
						</button>
					</li>
				))}
			</ul>
		);
	};
}
```

Place `<PhoneChoices />` inside `NovelPlayer.Stage` where `NovelPlayer.Choices` was. `Message`
renders a message key with the line markup, through the translator `IntlProvider` publishes.

## Restyle it

Every color, image, size and timing the parts draw is a `--novel-*` custom property, and
`NOVEL_THEME_VARIABLES` maps each name to its default. Set them on the player or any ancestor
through `theme()` from `@sdxc/novel/ui`, which turns a misspelled name into a type error; the
`border-image-*` variables frame a box with your own artwork:

```tsx {% title="resources/components/cafe-player.tsx" %}
<NovelPlayer
	novel={novel}
	mix={[
		keyboardControls(),
		css(
			theme({
				"--novel-textbox-background": "rgb(30 20 10 / 0.85)",
				"--novel-textbox-border-image-source": "url(/ui/frame.png)",
				"--novel-textbox-border-image-slice": "24",
				"--novel-textbox-border-image-width": "24px",
				"--novel-nameplate-font-family": "Caveat, cursive",
				"--novel-next-content": '"❤"',
				"--novel-accent": "#e8a55c",
			}),
		),
	]}
>
	<NovelPlayer.Stage>
		<NovelPlayer.Textbox />
	</NovelPlayer.Stage>
</NovelPlayer>
```

The variables cover the stage, speaker focus, the text, the textbox, the name plate, the
next-line indicator, the choices, the quick menu, the dialogs, the settings screen, captions,
read lines and the
notifications. The root also carries `data-novel-player` with `data-phase`, `data-auto`,
`data-skip` and `data-hidden`, for a rule that depends on what the player is doing.

The dialogs read `--novel-dialog-*`: `-background` and `-color` for the panel, `-border`,
`-shadow`, `-font` and `-title-*` for its frame and type. Every `@sdxc/ui` control inside one,
from the close button to a `Button`, `Select`, `Slider` or `Switch` of your own, takes its colors
from the dialog: text from `--novel-dialog-color`, fills and focus rings from
`--novel-dialog-accent` (with `--novel-dialog-on-accent` on them), borders from
`--novel-dialog-line` and fields from `--novel-dialog-field`, whatever the app's `@sdxc/ui` theme
says:

```tsx {% title="resources/components/cafe-player.tsx" %}
css(
	theme({
		"--novel-dialog-background": "linear-gradient(#0f2a1f, #07170f)",
		"--novel-dialog-color": "#f3e7cc",
		"--novel-dialog-accent": "#d4b06a",
		"--novel-dialog-border": "1px solid #d4b06a",
		"--novel-dialog-title-font": "Cinzel, serif",
	}),
);
```

## Test the part

A part needs a browser, so render it inside a player in a Vitest Browser Mode test. A click on
the stage advances, as the reader's would, until the menu shows:

```tsx {% title="resources/components/phone-choices.browser.test.tsx" %}
import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { NovelPlayer } from "@sdxc/novel/ui";
import { render } from "remix/component/test";
import { expect, test, vi } from "vitest";

import { novel } from "~/app/initializers/novel";
import { PhoneChoices } from "~/resources/components/phone-choices";
import en from "~/resources/locales/en";

test("draws the opening menu as phone buttons", async () => {
	let intl = createI18n({
		locale: "en",
		fallbackLanguage: "en",
		resources: { en },
	});
	let result = render(
		<IntlProvider intl={intl}>
			<NovelPlayer novel={novel} settings={{ textSpeed: 0 }}>
				<NovelPlayer.Stage>
					<NovelPlayer.Textbox />
					<PhoneChoices />
				</NovelPlayer.Stage>
			</NovelPlayer>
		</IntlProvider>,
	);

	await vi.waitFor(() => {
		result.$("[data-novel-surface]")?.click();
		expect(result.$("ul button")?.textContent).toBe("Coffee, black");
	});
	result.cleanup();
});
```

## Where to go next

- [Customize behaviors](/docs/visual-novels/customize-behaviors) — the next guide: change how
  auto, skip and autosave work.
- [Branch at runtime](/docs/visual-novels/branch-at-runtime) — the previous guide.
- [`@sdxc/novel`](/api/novel) — every part, its props, and the whole list of theme variables.
