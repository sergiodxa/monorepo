/**
 * The Foundations of `@sdxc/ui/schedule`: what the calendar kit is for, the rules its parts share
 * (server-placed events, edits that post forms, dates as plain strings), and each variable it
 * reads, with the fallback the parts declare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const SCHEDULE: Foundations = {
	module: "schedule",
	slug: "schedule-foundations",
	title: "Schedule foundations",
	summary: "What @sdxc/ui/schedule is for, the rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/schedule",
	source: "ui/src/schedule/time-grid.tsx",
	intro: [
		"The parts of a calendar app: a time grid of days and hours, a month, an agenda, a phone's strip of days, and a people-by-hours grid for finding a time.",
		"They draw what the server places: days are `YYYY-MM-DD` strings and times are minutes of the day, so the app decides the zone and the parts never guess it.",
	],
	reachFor: [
		"A day, three-day or week calendar whose events can be dragged, resized and created.",
		"A month or agenda over the same events, and a phone layout with a strip of dates.",
		"Comparing several people's busy times to offer a meeting slot.",
	],
	ideas: [
		{
			title: "Placed on the server",
			body: "Overlapping events split their cluster into columns, and all-day spans stack into rows, before any script runs.",
		},
		{
			title: "Edits post forms",
			body: "A drag or an Alt+arrow move fills the grid's `edit` form with `date`, `start` and `end`, so a no-script form does the same job.",
		},
		{
			title: "Zones as columns",
			body: "Each zone is a column of hour labels the app reads for that day, so a second zone shows its own DST offset.",
		},
		{
			title: "A moving now line",
			body: "The server draws the present minute, and the island moves it on from the instant it was read, even on a cached page.",
		},
		{
			title: "Opens on the day",
			body: "The grid opens scrolled to `scrollTo`, and keeps its scroll when a post redraws it.",
		},
		{
			title: "Phones get their own view",
			body: "`DayStrip` scrolls inside its own box, and a month narrows its days to dots without widening the page.",
		},
	],
	roles:
		"Reads the neutral role for hairlines, labels and off-hours tint, and brand for today, the current day and a default event colour; each event tints itself from its own colour.",
	variables: [
		{
			title: "Scale and colour",
			lead: "None is declared in `theme.css`; set any of them on a part or an ancestor.",
			variables: [
				{
					name: "--ui-time-grid-hour",
					default: "3rem",
					controls:
						"One hour's height in a `TimeGrid`, which every event's offset and length multiplies.",
				},
				{
					name: "--ui-time-grid-gutter",
					default: "3.5rem",
					controls: "The width of each time zone's column of hour labels.",
				},
				{
					name: "--ui-time-grid-now",
					default: "var(--ui-danger-bg-solid)",
					controls: "The now line and its dot.",
				},
				{
					name: "--ui-day-strip-cell",
					default: "3rem",
					controls:
						"The width of each day in a `DayStrip`; widen it for longer notes such as amounts.",
				},
			],
		},
	],
};

export default SCHEDULE;
