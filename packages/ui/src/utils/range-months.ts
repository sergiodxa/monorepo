/**
 * Day-key arithmetic and selection rules behind a link-driven range calendar. Every day is a
 * `YYYY-MM-DD` string counted in UTC, so the server and the browser lay out identical weeks and
 * two keys compare in date order as plain strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Milliseconds in one UTC day, the step every day key advances by. */
const DAY_MS = 86_400_000;

/** A Sunday, the reference week weekday names are formatted from. */
const REFERENCE_SUNDAY = Date.UTC(2023, 0, 1);

/** The selection a calendar draws: its two ends, `YYYY-MM-DD`, and whether it picks one day. */
export interface DaySelection {
	start?: string;
	end?: string;
	single: boolean;
}

/** Where a day sits in a drawn selection. */
export type RangePosition = "start" | "middle" | "end" | "only";

/**
 * The selection a click on `date` makes: single mode picks the day; otherwise a missing start
 * or a finished range restarts at the day, and a pending start takes a later day as its end and
 * an earlier or equal one as its replacement.
 *
 * @example nextSelection("2026-03-14", { start: "2026-03-10", single: false }); // { start: "2026-03-10", end: "2026-03-14" }
 */
export function nextSelection(
	date: string,
	selection: DaySelection,
): { start: string; end?: string } {
	let { start, end, single } = selection;
	if (single || start === undefined || end !== undefined || date <= start) return { start: date };
	return { start, end: date };
}

/**
 * Where `date` sits in a selection: `"only"` for a lone picked day or a start still waiting for
 * its end, `"start"`/`"middle"`/`"end"` along a finished range, `undefined` outside it.
 */
export function rangePosition(date: string, selection: DaySelection): RangePosition | undefined {
	let { start, single } = selection;
	let end = single ? undefined : selection.end;
	if (start === undefined) return undefined;
	if (end === undefined || start === end) return date === start ? "only" : undefined;
	if (date === start) return "start";
	if (date === end) return "end";
	if (date > start && date < end) return "middle";
	return undefined;
}

/**
 * The first day after `start`, up to `last`, that `isUnavailable` reports: a pending range ends
 * before it, so no range spans a day already taken.
 *
 * @returns The blocking day, or `undefined` when every day through `last` is free.
 */
export function firstUnavailableAfter(
	start: string,
	last: string,
	isUnavailable: ((date: string) => boolean) | undefined,
): string | undefined {
	if (isUnavailable === undefined) return undefined;
	for (let date = addDays(start, 1); date <= last; date = addDays(date, 1)) {
		if (isUnavailable(date)) return date;
	}
	return undefined;
}

/** Midnight UTC of a `YYYY-MM-DD` day, or of the first day of a `YYYY-MM` month. */
export function dayTime(date: string): number {
	let day = date.length > 7 ? Number(date.slice(8, 10)) : 1;
	return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, day);
}

/** Formats a UTC instant as its `YYYY-MM-DD` day. */
export function toDayKey(time: number): string {
	return new Date(time).toISOString().slice(0, 10);
}

/** The day `count` days after a `YYYY-MM-DD` day, counted in UTC so no offset shifts it. */
export function addDays(date: string, count: number): string {
	return toDayKey(dayTime(date) + count * DAY_MS);
}

/** The `YYYY-MM` month `delta` months after `month`, rolling over year ends. */
export function shiftMonth(month: string, delta: number): string {
	return toDayKey(
		Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1),
	).slice(0, 7);
}

/** The UTC instant of the `index`th weekday column of a week opening on `weekStartsOn`. */
export function weekdayTime(weekStartsOn: number, index: number): number {
	return REFERENCE_SUNDAY + ((((weekStartsOn + index) % 7) + 7) % 7) * DAY_MS;
}

/**
 * The weeks of a `YYYY-MM` month, each seven entries long from `weekStartsOn` (0 is Sunday): a
 * day key for each day of the month and `null` for the columns that belong to its neighbours.
 */
export function monthWeeks(month: string, weekStartsOn: number): Array<Array<string | null>> {
	let first = dayTime(month);
	let offset = (((new Date(first).getUTCDay() - weekStartsOn) % 7) + 7) % 7;
	let length = new Date(
		Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
	).getUTCDate();
	let cells: Array<string | null> = Array.from({ length: offset }, () => null);
	for (let day = 0; day < length; day++) cells.push(toDayKey(first + day * DAY_MS));
	while (cells.length % 7 !== 0) cells.push(null);
	let weeks: Array<Array<string | null>> = [];
	for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
	return weeks;
}
