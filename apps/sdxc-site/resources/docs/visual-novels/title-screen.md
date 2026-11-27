---
title: A title screen
description: Open the novel on a title screen with your logo, background and portrait, a Continue that names the save it resumes, and buttons decorated without forking the component.
section:
    title: Visual novels
    order: 4.7
order: 2.5
lastUpdated: 2026-11-25
outcomes:
    - "How to open the novel on a title screen, play what the reader starts and return after it ends"
    - "Where the logo, the background, the portrait and the footer go"
    - "How to restyle and ornament the menu through variables and data attributes"
---

A visual novel usually opens on a title screen: the logo over key art, **New game**,
**Continue**, the extras and the settings. `NovelPlayer.Default` draws one when you give it a
`titleScreen`, swaps to the play the reader starts, and comes back when that play ends. This
guide builds the café's.

```bash
npm add @sdxc/novel remix
```

## Open on the title

Give the player from [Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) a
`titleScreen`. **Continue** shows once a save exists and resumes the newest, naming its scene and
when it was saved. **Chapters**, **Gallery** and **Memories** read what earlier playthroughs
unlocked, and a setting changed on the title carries into the play:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Default
	novel={novel}
	{...stored}
	mix={STORAGE.sync()}
	titleScreen={{
		heading: <img src={logo} alt="The Café" />,
		background: <img src={backdrop} alt="" />,
		art: <img src={portrait} alt="" />,
		footer: "A fan-made story. Not affiliated with any brand.",
	}}
/>
```

- `heading` is text or a logo. An `<img>`, `<svg>` or `<picture>` scales within
  `--novel-title-logo-max-inline-size` and `--novel-title-logo-max-block-size`, and its alt text
  names the heading for screen readers.
- `background` covers the whole screen behind everything. Without it, the screen paints the
  `--novel-title-background` variable.
- `art` is a foreground illustration, such as a portrait, anchored at the bottom right and
  kept at its own ratio. Give it alt text when it carries meaning; without, assistive technology
  skips it.
- `footer` sits under the menu, for a disclaimer or credits.
- `screens` picks the library screens, such as `<><ChapterSelect /><MusicRoom /></>`.

The buttons read the player's `labels`, so `newGame`, `continue` and `titleMenu` translate with
the rest of the interface.

## Come back to the title

When the reader reaches an ending, the ending screen shows its name with a **Back to title**
button (`labels.backToTitle`). During a play, the quick menu's **Title** button
(`labels.toTitle`) leaves for the title at any time, and **Continue** resumes from the newest
save. A chapter or scene replay begun on the title goes back to it as
soon as it ends. The title then reflects the play: **Continue** resumes the newest save,
autosaves included, and the library screens show what the play unlocked.

A button in the title's bottom corner enters and leaves full screen, where the browser allows
it. It fills the screen with the box the title sits in, which the player shares, so starting a
game or coming back to the title stays in full screen. `--novel-title-fullscreen-*` variables
size, place and color it.

## Restyle it with variables

Every color, font, size and position on the title is a `--novel-title-*` variable, and
`NOVEL_THEME_VARIABLES` lists each with its default. Set them through `theme()` in the same `mix`:

```tsx {% title="resources/components/game.tsx" %}
css(
	theme({
		"--novel-title-background-filter": "blur(6px) brightness(0.6)",
		"--novel-title-art-block-size": "92cqh",
		"--novel-title-art-animation": "novel-title-rise 1.2s ease-out both",
		"--novel-title-logo-filter": "drop-shadow(0 0 2cqh rgb(0 0 0 / 0.6))",
		"--novel-title-button-font-family": "Cinzel, serif",
		"--novel-title-button-letter-spacing": "0.14em",
		"--novel-title-button-text-transform": "uppercase",
		"--novel-title-button-shadow":
			"inset 0 0 0 0.35cqh #06140e, inset 0 0 0 calc(0.35cqh + 1px) #d4b06a",
		"--novel-title-button-hover-translate": "0 -0.2cqh",
		"--novel-title-detail-text-transform": "none",
		"--novel-title-footer-font-size": "1.4cqh",
	}),
);
```

`cqh` and `cqw` measure the title screen itself, so the menu keeps its proportions at any size.
`--novel-title-art-animation` plays only for a reader who has not asked for reduced motion, and
`novel-title-rise` is a built-in keyframe that fades the art in from below.

## Ornament the buttons

Each part carries a data attribute: `data-novel-title-heading`, `data-novel-title-menu`,
`data-novel-title-button` (with `data-action="new-game"`, `"continue"`, `"chapters"` and so on),
`data-novel-title-label`, `data-novel-title-detail` and `data-novel-title-footer`. Buttons are
positioned, so a nested selector in the same `mix` adds a gem to each edge:

```tsx {% title="resources/components/game.tsx" %}
css({
	"& [data-novel-title-button]::before, & [data-novel-title-button]::after": {
		content: '""',
		position: "absolute",
		insetBlockStart: "50%",
		inlineSize: "1.5cqh",
		blockSize: "1.5cqh",
		translate: "0 -50%",
		rotate: "45deg",
		background: "linear-gradient(135deg, #6fe0a6, #0f6b43)",
	},
	"& [data-novel-title-button]::before": { insetInlineStart: "-0.75cqh" },
	"& [data-novel-title-button]::after": { insetInlineEnd: "-0.75cqh" },
});
```

## Mount your own player

A game that composes its own player renders `NovelPlayer.Title` instead and mounts a player from
each `novel:start` event. Its `start` holds what the reader picked: a new game, the save to
resume, or the chapter to replay. Give that player `returnsToTitle`, and its `novel:title` event
brings the title back with the persistent data the play left:

```tsx {% title="resources/components/game.tsx" %}
import type { StartOptions } from "@sdxc/novel";
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { on } from "remix/component";

export function TitledGame(handle: Handle) {
	let start: StartOptions | undefined;
	let persistent: unknown = STORAGE.read().start.persistent;
	return () =>
		start === undefined ? (
			<NovelPlayer.Title
				novel={novel}
				heading="The Café"
				start={{ persistent }}
				mix={on("novel:start", (event) => {
					start = event.start;
					void handle.update();
				})}
			/>
		) : (
			<NovelPlayer
				novel={novel}
				start={start}
				returnsToTitle
				mix={on("novel:title", (event) => {
					persistent = event.persistent;
					start = undefined;
					void handle.update();
				})}
			>
				<NovelPlayer.Stage>
					<NovelPlayer.Textbox />
					<NovelPlayer.Choices />
				</NovelPlayer.Stage>
			</NovelPlayer>
		);
}
```

## Where to go next

- [Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) — the store the title's
  Continue and settings read from.
- [Compose your own player](/docs/visual-novels/compose-your-own-player) — the `--novel-*`
  variables of the rest of the player.
- [Extras, dev tools and offline](/docs/visual-novels/extras-dev-tools-and-offline) — the library
  screens the title offers.
