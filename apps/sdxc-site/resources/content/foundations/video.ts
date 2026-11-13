/**
 * The Foundations of `@sdxc/ui/video`: what the player is for, the native-first and
 * data-once rules its parts share, and each variable it reads, with the fallback the
 * player declares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const VIDEO: Foundations = {
	module: "video",
	slug: "video-foundations",
	title: "Video foundations",
	summary:
		"What @sdxc/ui/video is for, the native-first rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/video",
	source: "ui/src/video/video-player.tsx",
	intro: [
		"One video player in parts: a screen, a chapter scrubber, chapters and a transcript beside it, and a control bar with a settings menu.",
		"Chapters and lines are written once as data and feed the captions, the scrubber and the lists alike.",
	],
	reachFor: [
		"A lesson, talk or demo video with chapters and a transcript.",
		"A product video on a landing or docs page that should play before script loads.",
		"A player whose settings menu needs the page's own toggles, such as ambient mode.",
	],
	ideas: [
		{
			title: "Native first",
			body: "The server renders `<video controls>`; the island hides them and reveals `.Controls`.",
		},
		{
			title: "Links seek",
			body: "Every time is a `#t=` link into the first source, so it plays from there with no script.",
		},
		{
			title: "Data once",
			body: "Chapters and the transcript become WebVTT tracks as `data:` URLs, so captions need no file.",
		},
		{
			title: "Real controls",
			body: "Settings rows are checkboxes and radios; the page reads them by `name` from `change`.",
		},
		{
			title: "Keyboard",
			body: "The menu walks with the arrows; → opens a submenu, ← leaves it, Enter picks.",
		},
		{
			title: "On the picture",
			body: "The bar and the menu stay dark with light ink in either page scheme.",
		},
	],
	roles:
		"Reads the neutral role for text, hairlines and the plain surface, and brand for the current chapter, line and scrubber fill.",
	variables: [
		{
			title: "Shape",
			lead: "None is declared in `theme.css`; set any of them on the player or an ancestor.",
			variables: [
				{
					name: "--ui-video-player-radius",
					default: "var(--ui-landing-radius-frame, 0.75rem)",
					controls: "Outer radius of the player; the screen nests a smaller one.",
				},
				{
					name: "--ui-video-player-transcript-height",
					default: "11rem",
					controls: "Height of the transcript's scroll region.",
				},
				{
					name: "--ui-video-player-progress-color",
					default: "oklch(0.63 0.22 27)",
					controls: "Fill of the seek slider, the captions mark, an on switch and the gear badge.",
				},
			],
		},
		{
			title: "Set by the tone",
			lead: '`tone="plain"` follows the page; `tone="theater"` keeps a dark room in either scheme.',
			variables: [
				{
					name: "--ui-video-player-bg",
					default: "var(--ui-surface-raised, Canvas)",
					controls: "The player's surface.",
				},
				{
					name: "--ui-video-player-accent",
					default: "var(--ui-brand-fg)",
					controls: "The current chapter, the current line's time and the scrubber's fill.",
				},
				{
					name: "--ui-video-player-line",
					default: "var(--ui-landing-hairline, …)",
					controls: "Hairlines and the scrubber's unplayed track.",
				},
			],
		},
	],
};

export default VIDEO;
