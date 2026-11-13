/**
 * Undercurrent's sample episodes: the latest one with its chapters and transcript, and the
 * three before it. The issue, the player and the episode list read from here, so a number,
 * a title or a running time is the same wherever the page shows it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EpisodePlayer } from "@sdxc/ui/landing";

/** One episode as the list shows it. */
export interface Episode {
	number: number;
	title: string;
	/** Machine-readable release date. */
	dateTime: string;
	date: string;
	/** Running time in seconds. */
	duration: number;
	/** Who joins the host, in a few words. */
	guest: string;
}

/**
 * The latest episode's audio: a placeholder that chimes once at the start of each chapter
 * and is silent between, so seeking to a chapter is audible.
 */
export const LATEST_AUDIO = "/demos/newsletter/episode-63.mp3";

/** The latest episode's captions, one cue per transcript passage. */
export const LATEST_CAPTIONS = "/demos/newsletter/episode-63.vtt";

/** The latest episode and the three before it, newest first. */
export const EPISODES: readonly Episode[] = [
	{
		number: 63,
		title: "The pressure at the top of the hill",
		dateTime: "2026-11-08",
		date: "8 November",
		duration: 860,
		guest: "with Rafi Mendes, network operator",
	},
	{
		number: 62,
		title: "Who repaints the lines",
		dateTime: "2026-10-25",
		date: "25 October",
		duration: 1450,
		guest: "with a road-marking crew of three",
	},
	{
		number: 61,
		title: "A night at the sorting office",
		dateTime: "2026-10-11",
		date: "11 October",
		duration: 1865,
		guest: "with Ama Owusu, night-shift supervisor",
	},
	{
		number: 60,
		title: "The substation behind the bakery",
		dateTime: "2026-09-27",
		date: "27 September",
		duration: 1357,
		guest: "with Lena Brandt, grid planner",
	},
];

/** The latest episode's chapters, where the placeholder audio chimes. */
export const LATEST_CHAPTERS: readonly EpisodePlayer.Chapter[] = [
	{ start: 0, title: "The shower on the ninth floor" },
	{ start: 112, title: "What pressure means at a tap" },
	{ start: 270, title: "The tower on Linden Hill" },
	{ start: 465, title: "Night flow and the 3 a.m. test" },
	{ start: 658, title: "Mailbag: why August water tastes different" },
	{ start: 785, title: "Credits and next week" },
];

/** The latest episode's transcript, one passage per change of speaker or chapter. */
export const LATEST_TRANSCRIPT: readonly EpisodePlayer.Cue[] = [
	{
		start: 0,
		speaker: "Tove",
		text: "This is Undercurrent, and I'm Tove Adler. A reader on the ninth floor of a building on Linden Hill wrote in to say her shower turns to a trickle every morning at seven. She asked whether that is her building's fault. It is not, quite.",
	},
	{
		start: 112,
		speaker: "Rafi",
		text: "Pressure at a tap is height you borrow. The water in the tower stands forty metres above the street, and every metre of it pushes. Your ninth floor is twenty-seven metres up, so you only get what is left over.",
	},
	{
		start: 196,
		speaker: "Tove",
		text: "And at seven in the morning, when everyone on the hill showers at once?",
	},
	{
		start: 204,
		speaker: "Rafi",
		text: "The pipes lose some of it to friction on the way. Fast water loses more. That is the dip she feels.",
	},
	{
		start: 270,
		speaker: "Tove",
		text: "The tower on Linden Hill was built in 1931 for a neighbourhood of two-storey houses. We climbed it on a Tuesday with the operator who checks it every week.",
	},
	{
		start: 465,
		speaker: "Rafi",
		text: "At three in the morning almost nobody uses water, so whatever still flows is a leak. We measure it every night. On Linden Hill it is about four litres a second.",
	},
	{
		start: 658,
		speaker: "Tove",
		text: "From the mailbag: Jonas in Harbour Ward asks why his water tastes different in August. Warm reservoirs, a little more chlorine, and a switch to the river intake. Rafi has the long answer in Thursday's letter.",
	},
	{
		start: 785,
		speaker: "Tove",
		text: "Undercurrent is written and read by me, with sound by Ines Cardoso. Next time: what happens to the bins after the lorry turns the corner.",
	},
];
