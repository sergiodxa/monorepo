/**
 * Recurrence rules on their own subpath: read and write the RRULE value, and expand an
 * event's recurrence set (DTSTART, RRULE and RDATE, minus EXDATE) into the occurrences that
 * overlap a window. Every expansion is bounded by that window and a limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { DAY_MS } from "@sdxc/dates/zone";
import { failure, isFailure, success } from "@sdxc/result";

import type { WallResolver } from "./lib/zones.js";
import type { ICalendar } from "./types.js";

import { RecurrenceRuleError } from "./lib/errors.js";
import { expand, wallMs } from "./lib/expand.js";
import { resolverFor, wallOf } from "./lib/zones.js";

export { RecurrenceRuleError } from "./lib/errors.js";
export { parseRecurrence, stringifyRecurrence } from "./lib/recurrence.js";

/** The window an expansion covers and how it reads zones. */
export interface OccurrenceOptions {
	/** Epoch milliseconds, inclusive: occurrences still running at `from` are included. */
	from: number;
	/** Epoch milliseconds, exclusive. */
	to: number;
	/**
	 * The most occurrences returned, earliest first.
	 * @default 1_000
	 */
	limit?: number;
	/** Resolves `TZID`s through its `VTIMEZONE`s before `Intl`. */
	calendar?: ICalendar.Calendar;
	/**
	 * The IANA zone floating times and all-day dates are read in.
	 * @default "UTC"
	 */
	timeZone?: string;
}

/** One occurrence, as instants; `end` equals `start` for an instant-long event. */
export interface Occurrence {
	start: number;
	end: number;
}

/** The default most occurrences one call returns. */
const DEFAULT_LIMIT = 1000;

/**
 * Adds a duration to an occurrence: weeks and days on the wall clock, so a day across a DST
 * change keeps its local time, then hours, minutes and seconds as exact time.
 *
 * @param duration - The duration
 * @param wall - The occurrence's start, in wall milliseconds
 * @param instant - The occurrence's start instant
 * @param resolve - The start's zone
 * @returns The end instant
 */
function addDuration(
	duration: ICalendar.Duration,
	wall: number,
	instant: number,
	resolve: WallResolver,
): number {
	let sign = duration.negative ? -1 : 1;
	let days = (duration.weeks ?? 0) * 7 + (duration.days ?? 0);
	let exact =
		(((duration.hours ?? 0) * 60 + (duration.minutes ?? 0)) * 60 + (duration.seconds ?? 0)) * 1000;
	let base = days === 0 ? instant : resolve(wall + sign * days * DAY_MS);
	return base + sign * exact;
}

/**
 * How long each occurrence of an event lasts, per RFC 5545 §3.8.5.3: a `DTEND` gives every
 * occurrence the same exact length (whole days between two DATEs stay nominal), a
 * `DURATION` the same nominal one, and neither gives a DATE one day and a DATE-TIME none.
 *
 * @param event - The event
 * @param resolve - The start's zone
 * @param context - Where the end's own zone resolves
 * @returns A function from an occurrence's start to its end, or why the end cannot resolve
 */
function lengthOf(
	event: ICalendar.Event,
	resolve: WallResolver,
	context: Parameters<typeof resolverFor>[1],
): Result<(wall: number, instant: number) => number, RecurrenceRuleError> {
	let { end, duration, start } = event;
	if (end && start.type === "date" && end.type === "date") {
		let days = Math.round((wallMs(wallOf(end)) - wallMs(wallOf(start))) / DAY_MS);
		return success((wall, instant) =>
			addDuration({ days: Math.abs(days), negative: days < 0 }, wall, instant, resolve),
		);
	}
	if (end) {
		let resolveEnd = resolverFor(end, context);
		if (!resolveEnd) return failure(new RecurrenceRuleError("DTEND's zone does not resolve"));
		let exact = resolveEnd(wallMs(wallOf(end))) - resolve(wallMs(wallOf(start)));
		return success((_, instant) => instant + exact);
	}
	if (duration) return success((wall, instant) => addDuration(duration, wall, instant, resolve));
	if (start.type === "date")
		return success((wall, instant) => addDuration({ days: 1 }, wall, instant, resolve));
	return success((_, instant) => instant);
}

/**
 * The inclusive last instant a rule's `UNTIL` allows: a UTC value as is, a DATE through the
 * end of that day, and a local one in the start's zone.
 *
 * @param until - The rule's `UNTIL`
 * @param resolve - The start's zone
 * @returns Epoch milliseconds, or `null` without an `UNTIL`
 */
function untilInstant(
	until: ICalendar.DateValue | undefined,
	resolve: WallResolver,
): number | null {
	if (!until) return null;
	if (until.type === "date") return resolve(wallMs(wallOf(until)) + DAY_MS) - 1;
	if (until.zone === "utc") return wallMs(until.wall);
	return resolve(wallMs(until.wall));
}

/**
 * Describes why a value's zone does not resolve.
 *
 * @param value - The value
 * @returns The failure
 */
function unresolved(value: ICalendar.DateValue): RecurrenceRuleError {
	if (value.type === "date-time" && typeof value.zone === "object") {
		return new RecurrenceRuleError(
			`TZID ${value.zone.tzid} resolves through neither the calendar nor Intl`,
		);
	}
	return new RecurrenceRuleError("the time zone for floating times is not one Intl knows");
}

/**
 * The occurrences of an event overlapping a window, earliest first: `DTSTART`, which always
 * counts as the first instance, the `RRULE`'s instances and the `RDATE`s, minus every start
 * an `EXDATE` names. A duplicate start counts once, and at most `limit` come back.
 *
 * @param event - The event to expand
 * @param options - The window, the limit and how zones resolve
 * @returns The occurrences, or why the event cannot be expanded
 */
export function occurrences(
	event: ICalendar.Event,
	options: OccurrenceOptions,
): Result<Occurrence[], RecurrenceRuleError> {
	let { from, to, limit = DEFAULT_LIMIT } = options;
	if (!(to > from) || limit <= 0) return success([]);
	let context = { calendar: options.calendar, timeZone: options.timeZone ?? "UTC" };
	let resolve = resolverFor(event.start, context);
	if (!resolve) return failure(unresolved(event.start));
	let length = lengthOf(event, resolve, context);
	if (isFailure(length)) return length;
	let endOf = length.data;

	let excluded = new Set<number>();
	for (let value of event.exceptionDates ?? []) {
		let resolveExcluded = resolverFor(value, context);
		if (resolveExcluded) excluded.add(resolveExcluded(wallMs(wallOf(value))));
	}
	let found = new Map<number, Occurrence>();
	/** Records an occurrence overlapping the window, the first one at a start winning. */
	let add = (start: number, end: number) => {
		let overlaps = start < to && (end > from || (end <= start && start >= from));
		if (overlaps && !excluded.has(start) && !found.has(start)) found.set(start, { start, end });
	};

	let startWall = wallMs(wallOf(event.start));
	let startInstant = resolve(startWall);
	if (event.recurrence) {
		let span = Math.max(0, endOf(startWall, startInstant) - startInstant);
		let expanded = expand(
			event.recurrence,
			wallOf(event.start),
			{
				horizon: to + 2 * DAY_MS,
				skipTo: from - span - 2 * DAY_MS,
				toInstant: resolve,
				until: untilInstant(event.recurrence.until, resolve),
			},
			(wall, instant) => {
				add(instant, endOf(wall, instant));
				return found.size < limit + excluded.size;
			},
		);
		if (isFailure(expanded)) return expanded;
	} else add(startInstant, endOf(startWall, startInstant));

	for (let value of event.recurrenceDates ?? []) {
		let start = value.type === "period" ? value.start : value;
		let resolveStart = resolverFor(start, context);
		if (!resolveStart) return failure(unresolved(start));
		let wall = wallMs(wallOf(start));
		let instant = resolveStart(wall);
		if (value.type !== "period") add(instant, endOf(wall, instant));
		else if (value.end) {
			let resolveEnd = resolverFor(value.end, context);
			if (!resolveEnd) return failure(unresolved(value.end));
			add(instant, resolveEnd(wallMs(wallOf(value.end))));
		} else add(instant, addDuration(value.duration ?? {}, wall, instant, resolveStart));
	}
	return success([...found.values()].sort((a, b) => a.start - b.start).slice(0, limit));
}
