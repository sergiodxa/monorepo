---
title: Generated audio and images
description: Declare music, sounds and pictures the page renders itself as Blobs, such as a song from @sdxc/synth, and play them without a file to host.
section:
    title: Visual novels
    order: 4.7
order: 11
lastUpdated: 2026-11-25
outcomes:
    - "How to declare a Blob as an asset beside URLs"
    - "How the player plays and draws a Blob, and when a generated asset belongs in a file instead"
    - "How to give the menus hover and select sounds rendered with @sdxc/synth"
---

A jam game has no composer, and a procedural story draws its own skies. Every asset kind takes a
`Blob` wherever it takes a URL: a string is a file to fetch, and a Blob is a file the page already
holds, which plays or draws without a request. This guide gives the café a theme rendered by
[`@sdxc/synth`](/api/synth) and a sky drawn as SVG.

```bash
npm add @sdxc/novel @sdxc/synth
```

## Render the files

`renderSong` writes a song from a seed, and `encodeWav` turns its samples into a WAV file. A
picture is any image the browser decodes, such as an SVG written as text:

```typescript {% title="resources/novel/generated.ts" %}
import { encodeWav, renderSong, seedFrom } from "@sdxc/synth";

const SAMPLE_RATE = 22_050;

export function song(id: string): Blob {
	let samples = renderSong(
		{
			seed: seedFrom(id),
			style: "lofi",
			key: "A2",
			mode: "dorian",
			duration: 45,
		},
		{ sampleRate: SAMPLE_RATE },
	);
	return new Blob([encodeWav(samples, SAMPLE_RATE)], { type: "audio/wav" });
}

export function sky(top: string, bottom: string): Blob {
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9">
		<linearGradient id="g" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
		<rect width="16" height="9" fill="url(#g)"/>
	</svg>`;
	return new Blob([svg], { type: "image/svg+xml" });
}
```

The same seed gives the same song on every run, so a reload plays the theme the reader heard
before.

## Declare them beside URLs

Pass the Blobs to `assets()` where a URL would go. A group can mix both, and a per-locale map
takes either for each locale:

```typescript {% title="resources/novel/declarations.ts" %}
import { assets } from "@sdxc/novel";

import { sky, song } from "~/resources/novel/generated";

import cafe from "./images/cafe.webp";
import rain from "./audio/rain.ogg";

export const ASSETS = assets({
	backgrounds: { cafe, dusk: sky("#f4a261", "#264653") },
	music: { theme: song("cafe-theme") },
	ambience: { rain },
});
```

Scenes use them like any other asset: `ctx.show(ASSETS.backgrounds.dusk)`,
`ctx.play(ASSETS.music.theme, { fade: 1500 })`.

## How the player handles a Blob

- **Images, music and ambience** use one object URL per Blob, made the first time it shows or
  plays and kept for the life of the page, so every replay reuses it.
- **Sounds and voices** decode straight from the Blob's bytes.
- **The server** draws a Blob image without `src`, and the browser sets it as it hydrates.
- **Prefetch, `novel.links()` and the offline cache** list URLs only, since a Blob has nothing
  to fetch.
- **Saves** keep asset ids, so a loaded save draws the Blob the declaration holds now.

> [!WARNING]
> A Blob is made when the declarations module runs, on the server too when it renders the page.
> Keep generated files short, like the 45-second loop above. A long soundtrack, or one the server
> loads on every request, belongs in files rendered once at build time and declared by URL.

## Sound the interface

A short note makes a good interface sound. `renderScore` plays one on an instrument, and its
release becomes the file's tail:

```typescript {% title="resources/novel/generated.ts" %}
import { PRESETS, encodeWav, renderScore } from "@sdxc/synth";

export function blip(pitch: string, length = 0.125): Blob {
	let samples = renderScore(
		{
			tempo: 120,
			tracks: [
				{ instrument: PRESETS.pluck, notes: [{ at: 0, length, pitch }] },
			],
		},
		{ sampleRate: SAMPLE_RATE },
	);
	return new Blob([encodeWav(samples, SAMPLE_RATE)], { type: "audio/wav" });
}
```

Declare them as sounds, and give the player a `hover` and a `select`:

```typescript {% title="resources/novel/declarations.ts" %}
export const ASSETS = assets({
	sounds: { hover: blip("E6", 0.0625), select: blip("A5") },
});
```

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Default
	novel={novel}
	titleScreen={{ heading: "The Café" }}
	sounds={{ hover: ASSETS.sounds.hover, select: ASSETS.sounds.select }}
/>
```

The hover sound plays as the pointer enters a button, tab or link, or keyboard and gamepad focus
moves to one, and the select sound as the reader picks one, on the title screen and in play.
Clicking the stage to advance stays silent. Both play on their own channel, which the settings
screen lists as **Interface**, so a reader can turn them down without losing the story's sounds.

## Test the declarations

`check()` reads Blob assets like any other, so the declaration test from
[Make your first novel](/docs/visual-novels/first-novel) covers them. A test can also assert that
a rendered file is what the player expects:

```typescript {% title="resources/novel/generated.test.ts" %}
import { expect, test } from "vitest";

import { song } from "~/resources/novel/generated";

test("the theme is a WAV file", async () => {
	let theme = song("cafe-theme");
	let header = new TextDecoder().decode((await theme.arrayBuffer()).slice(0, 4));

	expect(theme.type).toBe("audio/wav");
	expect(header).toBe("RIFF");
});
```

## Where to go next

- [Extras, dev tools and offline](/docs/visual-novels/extras-dev-tools-and-offline) — the next
  guide: a title screen, the scene editor's tools, and playing without a connection.
- [Notifications, autosave and read lines](/docs/visual-novels/notifications-autosave-and-read-lines)
  — the previous guide.
- [`@sdxc/synth`](/api/synth) — styles, keys, modes and the scores behind a generated song.
