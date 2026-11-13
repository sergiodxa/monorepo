---
title: Play audio and video with chapters and transcripts
description: Publish an episode or a lesson with chapters, captions and a transcript as plain data, link every moment so it plays without script, and seek the page's own player once script runs.
section:
    title: Interface
    order: 4.5
order: 9
lastUpdated: 2026-11-13
outcomes:
    - "How to publish an episode with EpisodePlayer and a lesson with VideoPlayer"
    - "Which island each player needs, and what plays without it"
    - "How to seek your own media element from time links with mediaSync"
---

An episode or a lesson is more than its file: readers skim the chapters, search the transcript
and share a link to the moment that matters. `@sdxc/ui` has two players that take all of that
as data. [`EpisodePlayer`](/api/ui/episode-player) is for audio, built on the browser's own
`<audio>` controls. [`VideoPlayer`](/api/ui/video-player) is for video, with a control bar and
settings menu of its own. In both, every time is a link into the file with a `#t=` media
fragment, so a reader running no script still plays from the moment they press.

```bash
npm add @sdxc/icons @sdxc/ui remix
```

## Publish an episode

Chapters and the transcript are arrays of `{ start, … }` in seconds. The library ships no copy,
so the list's name, the transcript's label and the fallback for a browser without audio are
yours to pass:

```tsx {% title="resources/views/episode.tsx" %}
import { EpisodePlayer } from "@sdxc/ui/landing";

<EpisodePlayer
	src="/audio/63.mp3"
	type="audio/mpeg"
	title="No. 63: The quiet release"
	meta="12 March · 41 min"
	captions={{ src: "/audio/63.vtt", srclang: "en", label: "English" }}
	chapters={[
		{ start: 0, title: "Cold open" },
		{ start: 312, title: "Why we stopped shipping on Fridays" },
	]}
	transcript={[
		{
			start: 0,
			speaker: "Ana",
			text: "Welcome back. This one starts with a confession.",
		},
		{ start: 9, speaker: "Leo", text: "Go on." },
	]}
	chaptersLabel="Chapters"
	transcriptLabel="Read the transcript"
	fallback={<a href="/audio/63.mp3">Download the episode</a>}
/>;
```

The chapters are an ordered list of links and the transcript sits in a closed `<details>`, so
the page stays short and a search in the browser still finds a line inside it. Without script a
link opens the audio at that moment.

## Publish a lesson

`VideoPlayer` writes its chapters and captions as WebVTT tracks from the same kind of data, so
the browser's own captions and chapter menus agree with the lists on the page. Compose the
parts you want; every label is a prop:

```tsx {% title="resources/views/lesson.tsx" %}
import { VideoPlayer } from "@sdxc/ui/video";

<VideoPlayer duration={703} chapters={chapters} transcript={transcript}>
	<VideoPlayer.Screen
		label="Centering 3 kg"
		captionsLabel="English"
		chaptersLabel="Chapters"
	>
		<VideoPlayer.Source
			src="/lesson-1080.webm"
			type="video/webm"
			label="1080p"
			badge="HD"
		/>
		<VideoPlayer.Source src="/lesson-720.webm" type="video/webm" label="720p" />
		<VideoPlayer.Controls label="Video controls">
			<VideoPlayer.Progress label="Seek" />
			<VideoPlayer.Play label="Play" pauseLabel="Pause" />
			<VideoPlayer.Time />
			<VideoPlayer.CaptionsToggle label="Subtitles/closed captions" />
			<VideoPlayer.Settings label="Settings">
				<VideoPlayer.CaptionsMenu
					label="Subtitles/CC"
					offLabel="Off"
					backLabel="Back"
				/>
				<VideoPlayer.SpeedMenu
					label="Playback speed"
					normalLabel="Normal"
					backLabel="Back"
				/>
				<VideoPlayer.QualityMenu label="Quality" backLabel="Back" />
			</VideoPlayer.Settings>
			<VideoPlayer.Fullscreen label="Full screen" />
		</VideoPlayer.Controls>
	</VideoPlayer.Screen>
	<VideoPlayer.Caption meta="Lesson 7 · 11:43">Centering 3 kg</VideoPlayer.Caption>
	<VideoPlayer.Side>
		<VideoPlayer.Chapters label="Chapters" />
		<VideoPlayer.Transcript label="Transcript" />
	</VideoPlayer.Side>
</VideoPlayer>;
```

Without script the video shows the browser's native controls and the chapter and transcript
lists are links into the first source. Once the island runs, the custom bar takes over, the
list items seek this player, and the playing chapter and line carry `aria-current`.
`VideoPlayer.Side` becomes a second column once the player is wide enough, and `tone="theater"`
or the `VideoPlayer.Theater` button sets the player in a dark room.

The settings menu takes your own entries too. `VideoPlayer.SettingsToggle` adds a switch and
`VideoPlayer.SettingsMenu` a submenu of `VideoPlayer.SettingsOption` choices; each is a named
form control, so your island reads the reader's choice by its `name`.

## Map the islands

Each player renders one island. Map the modules you use in the browser entry, as
[Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it#register-the-client-entry)
shows:

```typescript {% title="config/client-modules.ts" %}
export const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/landing/episode-player": () =>
		import("@sdxc/ui/landing/episode-player"),
	"@sdxc/ui/video/video-player": () => import("@sdxc/ui/video/video-player"),
};
```

## Link your own player

For a player you build yourself, the `mediaSync()` mixin from `@sdxc/ui/mixins` does what both
islands do: a press on any `#t=` link inside `root` seeks the media element there and plays,
and the elements matching `marks` get `aria-current` while their moment plays. Apply it inside
your own island:

```tsx {% title="resources/components/clip-sync.tsx" %}
import { mediaSync } from "@sdxc/ui/mixins";

<span
	hidden
	mix={[mediaSync({ root: '[data-slot="clip"]', marks: ["[data-cue]"] })]}
/>;
```

## Test it

The links are the part a reader without script depends on, so a test renders the player on
the server and checks that each chapter opens the file at its moment:

```tsx {% title="resources/views/episode.test.tsx" %}
import { EpisodePlayer } from "@sdxc/ui/landing";
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

test("every chapter links into the audio at its start", async () => {
	let html = await renderToString(
		<EpisodePlayer
			src="/audio/63.mp3"
			title="No. 63"
			captions={{ src: "/audio/63.vtt", srclang: "en", label: "English" }}
			chapters={[{ start: 312, title: "Why we stopped shipping on Fridays" }]}
			chaptersLabel="Chapters"
			transcriptLabel="Read the transcript"
			fallback={<a href="/audio/63.mp3">Download the episode</a>}
		/>,
	);

	expect(html).toContain('href="/audio/63.mp3#t=312"');
});
```

## Where to go next

- [`EpisodePlayer`](/api/ui/episode-player) and [`VideoPlayer`](/api/ui/video-player) — every
  part and prop, with live demos.
- [Build a landing page](/docs/building-remix-apps/landing-pages) — the bands an episode page
  or a course landing sits among.
