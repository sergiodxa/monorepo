/**
 * The six-week day grid a composed calendar lays one month out as, and the key naming
 * each of its days. Six weeks always, padded at both ends with the neighbouring
 * months' days, so a grid keeps its height and every row keeps its seven cells however
 * the month falls.
 *
 * Days are built from local year/month/day components and named from the same, because
 * a calendar grid's cells are matched against a model that counts days locally; reading
 * a day in a named zone instead would move a cell's key across midnight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Weeks a grid always holds, so its height stays put as the visible month changes. */
const WEEKS_PER_GRID = 6;

const DAYS_PER_WEEK = 7;

/** One day cell of a month grid. */
export interface MonthDay {
	/** Local midnight on this day. */
	date: Date;
	/** The day's local `YYYY-MM-DD` key, which a calendar cell carries as `data-date`. */
	key: string;
	/** Whether this day belongs to the month before or after the one being laid out. */
	outsideMonth: boolean;
}

/** One row of a month grid, Sunday through Saturday. */
export interface MonthWeek {
	/** The week's first day key, naming the row across renders of the same month. */
	key: string;
	days: MonthDay[];
}

/**
 * The local `YYYY-MM-DD` key naming a day.
 *
 * @param date - Any instant; its local year, month and day are what get read.
 * @returns The zero-padded key.
 * @example dayKey(new Date(2026, 5, 1)) // "2026-06-01"
 */
export function dayKey(date: Date): string {
	let year = String(date.getFullYear()).padStart(4, "0");
	let month = String(date.getMonth() + 1).padStart(2, "0");
	let day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * The six weeks a calendar shows a month as, starting on the Sunday on or before its
 * first day and running seven days a row from there.
 *
 * @param month - Any day of the month to lay out.
 * @returns Six weeks of seven days each, in calendar order.
 * @example monthGrid(new Date(2026, 5, 15)).at(0)?.key // "2026-05-31"
 */
export function monthGrid(month: Date): MonthWeek[] {
	let year = month.getFullYear();
	let index = month.getMonth();
	let leading = new Date(year, index, 1).getDay();

	let weeks: MonthWeek[] = [];

	for (let week = 0; week < WEEKS_PER_GRID; week++) {
		let weekStart = new Date(year, index, 1 - leading + week * DAYS_PER_WEEK);
		let days: MonthDay[] = [];

		for (let offset = 0; offset < DAYS_PER_WEEK; offset++) {
			let date = new Date(
				weekStart.getFullYear(),
				weekStart.getMonth(),
				weekStart.getDate() + offset,
			);
			days.push({ date, key: dayKey(date), outsideMonth: date.getMonth() !== index });
		}

		weeks.push({ key: dayKey(weekStart), days });
	}

	return weeks;
}
