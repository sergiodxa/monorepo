/**
 * The week a weekly releases run covers: the seven days before the Friday 17:00 UTC run
 * (noon in Peru), and the ISO year and week that name the post. Consecutive runs cover
 * adjacent windows, so no release falls between two posts or into both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { addDays, diffInDays, subDays } from "@sdxc/dates";

import type { ReleaseWindow } from "~/app/services/releases/github";

/** The UTC weekday of the scheduled run, as `Date#getUTCDay` counts it. */
const RUN_WEEKDAY = 5;

/** The UTC hour of the scheduled run. */
const RUN_HOUR = 17;

/** The days one run covers. */
const WEEK_DAYS = 7;

/** The week one run covers and the post it writes. */
export interface ReleaseWeek extends ReleaseWindow {
	/** The ISO 8601 week-numbering year, which differs from the calendar year around New Year. */
	isoYear: number;
	isoWeek: number;
	/** The post's permalink segment, `<ISO year>-w<ISO week>` with the week zero-padded. */
	slug: string;
}

/**
 * The week a run at `now` covers, anchored to the latest scheduled run at or before `now`:
 * a retried or late run covers the same week and writes the same slug as the run it repeats.
 *
 * @param now When the run happens.
 * @returns The window `[from, to)`, with `to` the scheduled run, and the ISO week of `to`.
 * @example releaseWeek(new Date("2026-10-16T17:00:00Z")).slug; // "2026-w42"
 */
export function releaseWeek(now: Date): ReleaseWeek {
	let to = latestRun(now);
	let { isoYear, isoWeek } = isoWeekOf(to);

	return {
		from: subDays(to, WEEK_DAYS),
		to,
		isoYear,
		isoWeek,
		slug: `${isoYear}-w${String(isoWeek).padStart(2, "0")}`,
	};
}

/** The latest Friday 17:00 UTC at or before `now`. */
function latestRun(now: Date): Date {
	let run = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_HOUR));
	run = subDays(run, (run.getUTCDay() - RUN_WEEKDAY + WEEK_DAYS) % WEEK_DAYS);
	return run > now ? subDays(run, WEEK_DAYS) : run;
}

/**
 * The ISO 8601 week of the UTC day holding `date`. Weeks start on Monday and belong to the
 * year holding their Thursday, so the last days of December can fall in week 1.
 */
function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
	let day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	let mondayIndex = (day.getUTCDay() + 6) % WEEK_DAYS;
	let thursday = addDays(day, 3 - mondayIndex);
	let isoYear = thursday.getUTCFullYear();
	let dayOfYear = diffInDays(thursday, new Date(Date.UTC(isoYear, 0, 1)), "UTC");

	return { isoYear, isoWeek: Math.floor(dayOfYear / WEEK_DAYS) + 1 };
}
