/**
 * The `sdxc-jscalendar expand` handler: every occurrence of the events and tasks in a
 * JSCalendar or iCalendar document inside a window, earliest first, one per line or as JSON.
 * Exits 1 when a recurrence cannot be expanded, and 2 for a bad window or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { createCommand, failure, success, usage } from "@sdxc/cli";
import { instantFromParts, isValidTimeZone } from "@sdxc/dates/zone";
import { isFailure } from "@sdxc/result";

import type { Occurrence, RecurrenceError } from "./recurrence.js";
import type { JSCalendar } from "./types.js";

import { JSCALENDAR_COMMANDS } from "./cli-contract.js";
import { detectFormat, readCalendar, readInput } from "./cli-input.js";
import { occurrences } from "./recurrence.js";

import { formatUTCDateTime, parseLocalDateTime } from "./index.js";

/** A date-time carrying `Z` or a numeric offset, which names one instant in any zone. */
const ABSOLUTE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

/** A calendar date alone, read as the midnight that starts it. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A window bound as epoch milliseconds: a date-time with `Z` or an offset as written, and a
 * date or a LocalDateTime as wall-clock time in `timeZone`.
 *
 * @param value - The flag's value
 * @param timeZone - The zone a bound without an offset is read in
 * @returns Epoch milliseconds, or `null` when the value is none of those forms
 */
function instantOf(value: string, timeZone: string): number | null {
	if (ABSOLUTE_PATTERN.test(value)) {
		let instant = Date.parse(value);
		return Number.isNaN(instant) ? null : instant;
	}
	let parts = parseLocalDateTime(DATE_PATTERN.test(value) ? `${value}T00:00:00` : value);
	return parts ? instantFromParts(parts, timeZone) : null;
}

/**
 * The occurrences of every entry of a Group, or of the one Event or Task, merged earliest
 * first and cut to `limit` across all of them.
 *
 * @param object - The document
 * @param options - The window, the limit and the zone floating times are read in
 * @returns The occurrences, or the first recurrence that cannot be expanded
 */
function expand(
	object: JSCalendar.CalendarObject,
	options: { from: number; to: number; limit: number; timeZone: string },
): Result<Occurrence[], RecurrenceError> {
	let entries = object["@type"] === "Group" ? object.entries : [object];
	let found: Occurrence[] = [];
	for (let entry of entries) {
		let expanded = occurrences(entry, options);
		if (isFailure(expanded)) return expanded;
		found.push(...expanded.data);
	}
	found.sort((a, b) => a.start - b.start || a.end - b.end);
	return success(found.slice(0, options.limit));
}

/**
 * Lists the occurrences overlapping `[--from, --until)`: one tab-separated line per occurrence
 * (start, end, uid, title) for people, or `{ occurrences }` with each instance under `--json`.
 * An empty window still exits 0.
 */
export default createCommand(JSCALENDAR_COMMANDS.expand, async (ctx) => {
	let { timeZone, limit } = ctx.flags;
	if (!isValidTimeZone(timeZone)) return usage(`--time-zone ${timeZone} is not an IANA zone`);
	if (!Number.isInteger(limit) || limit < 1) return usage("--limit expects a positive integer");
	let from = instantOf(ctx.flags.from, timeZone);
	if (from === null) return usage(`--from expects a date or date-time; got ${ctx.flags.from}`);
	let to = instantOf(ctx.flags.until, timeZone);
	if (to === null) return usage(`--until expects a date or date-time; got ${ctx.flags.until}`);
	if (to <= from) return usage("--until has to be later than --from");

	let text = await readInput(ctx, ctx.arguments.file);
	if (isFailure(text)) return text;
	let object = readCalendar(text.data, detectFormat(text.data));
	if (isFailure(object)) return object;
	let found = expand(object.data, { from, to, limit, timeZone });
	if (isFailure(found)) return failure(found.error);

	if (ctx.flags.json) {
		let report = found.data.map((occurrence) => ({
			uid: occurrence.object.uid,
			recurrenceId: occurrence.recurrenceId ?? null,
			start: formatUTCDateTime(occurrence.start),
			end: formatUTCDateTime(occurrence.end),
			object: occurrence.object,
		}));
		ctx.stdout(`${JSON.stringify({ occurrences: report }, null, 2)}\n`);
		return success();
	}
	for (let occurrence of found.data) {
		let { uid, title } = occurrence.object;
		let start = formatUTCDateTime(occurrence.start);
		let end = formatUTCDateTime(occurrence.end);
		ctx.stdout(`${start}\t${end}\t${uid}\t${title ?? ""}\n`);
	}
	if (found.data.length === 0) ctx.stderr("No occurrences in the window\n");
	return success();
});
