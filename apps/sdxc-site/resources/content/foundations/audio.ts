/**
 * The Foundations of `@sdxc/ui/audio`: what the music kit is for, the rules its parts share
 * (a player outside the swapped frame, play controls that post without script, one playing
 * mark), and each variable it reads, with the fallback the parts declare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const AUDIO: Foundations = {
	module: "audio",
	slug: "audio-foundations",
	title: "Audio foundations",
	summary: "What @sdxc/ui/audio is for, the rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/audio",
	source: "ui/src/audio/player-bar.tsx",
	intro: [
		"The parts of a music app: a track table, artwork tiles, a player bar with its phone mini player, a queue and the playing mark.",
		"They draw; a player drives them with the play queue and Media Session helpers the namespace ships beside them.",
	],
	reachFor: [
		"An album, playlist or artist page whose tracks play from a table.",
		"A player bar that stays mounted while the rest of the app swaps beneath it.",
		"Lock-screen and media-key controls for any page that plays audio.",
	],
	ideas: [
		{
			title: "Outside the frame",
			body: "Mount the bar beside the swapped `main` frame, so navigating never restarts the music.",
		},
		{
			title: "Rows play",
			body: "`TrackList.PlayButton` covers its row, so a press anywhere on it plays the track.",
		},
		{
			title: "One mark",
			body: 'The playing row is `aria-current="true"`; any `[data-audio-paused]` ancestor stills every `Equalizer`.',
		},
		{
			title: "Queue as data",
			body: "`createPlayQueue` and friends return new queues; shuffle keeps the playing track first.",
		},
		{
			title: "System controls",
			body: "`syncMediaSession` publishes the track and routes media keys back to the player.",
		},
		{
			title: "Thumb-sized",
			body: "Under a coarse pointer the buttons reach the target size and the ranges grow tall.",
		},
	],
	roles:
		"Reads the neutral role for text, hairlines and washes, and brand for the playing row, toggles that are on and a slider under the pointer.",
	variables: [
		{
			title: "Shape and fill",
			lead: "None is declared in `theme.css`; set any of them on a part or an ancestor.",
			variables: [
				{
					name: "--ui-media-tile-radius",
					default: "var(--ui-radius-md, 0.375rem)",
					controls: "Corner of a square tile's art.",
				},
				{
					name: "--ui-player-bar-fill",
					default: "var(--ui-neutral-fg-emphasis)",
					controls: "The played part of the seek and volume ranges.",
				},
				{
					name: "--ui-player-bar-track",
					default: "color-mix(in oklch, currentColor 22%, transparent)",
					controls: "The unplayed part of a range.",
				},
				{
					name: "--ui-player-bar-mini-bg",
					default: "a mix of the raised surface and the brand",
					controls: "The phone mini player's card.",
				},
			],
		},
	],
};

export default AUDIO;
