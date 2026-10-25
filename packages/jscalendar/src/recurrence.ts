import type { ZonedParts } from "@sdxc/dates/zone";
/**
 * Expands a recurring Event or Task into its occurrences inside a window: the union of its
 * recurrence rules, minus what its excluded rules generate, with its overrides adding,
 * removing and patching instances. Rules expand through `@sdxc/icalendar`'s RRULE engine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "@sdxc/icalendar";
import type { Result } from "@sdxc/result";

import { DAY_MS, isValidTimeZone } from "@sdxc/dates/zone";
import { occurrences as expandEvent } from "@sdxc/icalendar/rrule";
import { failure, isFailure, success } from "@sdxc/result";

import type { DurationParts } from "./lib/values.js";
import type { JSCalendar } from "./types.js";

import { RecurrenceError } from "./lib/errors.js";
import { applyPatch } from "./lib/patch.js";
import { toICalendarRule } from "./lib/rules.js";
import {
	addDuration,
	formatLocalDateTime,
	isUTCZone,
	parseDuration,
	parseLocalDateTime,
	toInstant,
	wallFromMs,
	wallMs,
} from "./lib/values.js";

export { RecurrenceError } from "./lib/errors.js";

/** The window an expansion covers and the zone floating times are read in. */
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
	/**
	 * The IANA zone an object without a `timeZone` is read in.
	 * @default "UTC"
	 */
	timeZone?: string;
}

/** One occurrence: when it runs, and the instance with its override applied. */
export interface Occurrence<T extends JSCalendar.Entry = JSCalendar.Entry> {
	/** The LocalDateTime the recurrence generated; unset for an object that does not recur. */
	recurrenceId?: JSCalendar.LocalDateTime;
	start: number;
	/** Equals `start` for an instant-long occurrence. */
	end: number;
	/**
	 * The instance: the object without its recurrence properties, shifted to this occurrence,
	 * with `recurrenceId` set and its override patched in.
	 */
	object: T;
}

/** The default most occurrences one call returns. */
const DEFAULT_LIMIT = 1000;

/** The most rule instances one expansion reads before it stops asking for more. */
const MAX_RAW = 1_000_000;

/** The weekdays in `Date#getUTCDay` order. */
const WEEKDAYS: JSCalendar.Weekday[] = ["su", "mo", "tu", "we", "th", "fr", "sa"];

/** Patch pointers RFC 8984 §4.3.5 makes an override ignore. */
const IGNORED_PREFIXES = new Set([
	"@type",
	"excludedRecurrenceRules",
	"method",
	"privacy",
	"prodId",
	"recurrenceId",
	"recurrenceIdTimeZone",
	"recurrenceOverrides",
	"recurrenceRules",
	"relatedTo",
	"replyTo",
	"sentBy",
	"timeZones",
	"uid",
	"excluded",
]);

/**
 * The LocalDateTime a recurrence applies its rules to: an event's start, a task's start or,
 * without one, its due date.
 *
 * @param object - The event or task
 * @returns The LocalDateTime, or `undefined` for a task with neither
 */
function anchorOf(object: JSCalendar.Entry): string | undefined {
	return object["@type"] === "Event" ? object.start : (object.start ?? object.due);
}

/**
 * When an instance runs: an event from its start for its duration, a task from its start
 * (or due date) to its due date.
 *
 * @param object - The instance
 * @param timeZone - The zone its LocalDateTimes are read in
 * @returns The span in epoch milliseconds, or `null` when it has no date
 */
function spanOf(object: JSCalendar.Entry, timeZone: string): { start: number; end: number } | null {
	let anchor = anchorOf(object);
	let parts = anchor === undefined ? null : parseLocalDateTime(anchor);
	if (!parts) return null;
	let wall = wallMs(parts);
	let start = toInstant(wall, timeZone);
	if (object["@type"] === "Event") {
		let length = object.duration === undefined ? null : parseDuration(object.duration);
		return { start, end: length ? addDuration(wall, length, timeZone) : start };
	}
	let due = object.due === undefined ? null : parseLocalDateTime(object.due);
	return {
		start,
		end: due && object.start !== undefined ? toInstant(wallMs(due), timeZone) : start,
	};
}

/**
 * Makes the parts RFC 8984 §4.3.3.1 adds to a rule explicit, so the rule expands the same
 * from any start; that is what lets an excluded rule test whether it matches the object's
 * own start.
 *
 * @param rule - The rule
 * @param anchor - The date-time the rule applies to
 * @returns The rule with its implicit parts written out
 */
function withImplicitParts(
	rule: JSCalendar.RecurrenceRule,
	anchor: ZonedParts,
): JSCalendar.RecurrenceRule {
	let explicit = { ...rule };
	let { frequency } = rule;
	let weekday = WEEKDAYS[new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day)).getUTCDay()];
	if (frequency !== "secondly" && !explicit.bySecond) explicit.bySecond = [anchor.second];
	if (frequency !== "secondly" && frequency !== "minutely" && !explicit.byMinute) {
		explicit.byMinute = [anchor.minute];
	}
	if (!["secondly", "minutely", "hourly"].includes(frequency) && !explicit.byHour) {
		explicit.byHour = [anchor.hour];
	}
	if (frequency === "weekly" && !explicit.byDay && weekday) explicit.byDay = [{ day: weekday }];
	if (frequency === "monthly" && !explicit.byDay && !explicit.byMonthDay) {
		explicit.byMonthDay = [anchor.day];
	}
	if (frequency === "yearly" && !rule.byYearDay) {
		if (!rule.byMonth && !rule.byWeekNo && (rule.byMonthDay || !rule.byDay)) {
			explicit.byMonth = [String(anchor.month)];
		}
		if (!rule.byMonthDay && !rule.byWeekNo && !rule.byDay) explicit.byMonthDay = [anchor.day];
		if (rule.byWeekNo && !rule.byMonthDay && !rule.byDay && weekday) {
			explicit.byDay = [{ day: weekday }];
		}
	}
	return explicit;
}

/**
 * A floating DATE-TIME for wall milliseconds, the form the RRULE engine expands on a
 * zone-less timeline when it reads floating times in UTC.
 *
 * @param wall - Wall milliseconds
 * @returns The iCalendar value
 */
function floating(wall: number): ICalendar.DateValue {
	let { year, month, day, hour, minute, second } = wallFromMs(wall);
	return { type: "date-time", wall: { year, month, day, hour, minute, second }, zone: "floating" };
}

/** What one rule generated inside a window. */
interface RuleStarts {
	starts: number[];
	/** Whether the expansion stopped at its limit, so later starts may be missing. */
	truncated: boolean;
}

/**
 * The wall-clock starts a rule generates from an anchor inside a wall-clock window, the
 * anchor always first as RFC 8984 counts it.
 *
 * @param rule - The rule
 * @param anchor - Wall milliseconds of the date-time it applies to
 * @param window - Wall milliseconds, `from` inclusive and `to` exclusive
 * @param limit - The most starts read
 * @returns The starts, or why the rule cannot be expanded
 */
function ruleStarts(
	rule: JSCalendar.RecurrenceRule,
	anchor: number,
	window: { from: number; to: number },
	limit: number,
): Result<RuleStarts, RecurrenceError> {
	let converted = toICalendarRule(rule, (until) => {
		let parts = parseLocalDateTime(until);
		return floating(parts ? wallMs(parts) : anchor);
	});
	if (isFailure(converted)) return converted;
	let event: ICalendar.Event = {
		uid: "",
		dtstamp: new Date(0),
		start: floating(anchor),
		recurrence: converted.data,
		properties: [],
	};
	let expanded = expandEvent(event, { ...window, limit, timeZone: "UTC" });
	if (isFailure(expanded)) return failure(new RecurrenceError(expanded.error.message));
	return success({
		starts: expanded.data.map((occurrence) => occurrence.start),
		truncated: expanded.data.length >= limit,
	});
}

/**
 * Whether an excluded rule generates the object's own start, which RFC 8984 §4.3.4 counts
 * only when the rule matches it. The rule expands from one second earlier with its implicit
 * parts made explicit, so the anchor appears only when the rule selects it.
 *
 * @param rule - The excluded rule
 * @param anchor - The object's start
 * @returns Whether the rule selects the start, or why it cannot be expanded
 */
function matchesAnchor(
	rule: JSCalendar.RecurrenceRule,
	anchor: ZonedParts,
): Result<boolean, RecurrenceError> {
	let explicit = withImplicitParts(rule, anchor);
	if (explicit.count !== undefined) explicit.count += 1;
	let wall = wallMs(anchor);
	let found = ruleStarts(explicit, wall - 1000, { from: wall, to: wall + 1 }, 2);
	if (isFailure(found)) return found;
	return success(found.data.starts.includes(wall));
}

/**
 * A patch without the pointers an override may not change.
 *
 * @param patch - The override's PatchObject
 * @returns The patch RFC 8984 applies
 */
function applicable(patch: JSCalendar.PatchObject): JSCalendar.PatchObject {
	return Object.fromEntries(
		Object.entries(patch).filter(([key]) => !IGNORED_PREFIXES.has(key.split("/")[0] ?? "")),
	);
}

/**
 * The instance a recurrence id stands for: the object without its recurrence properties,
 * its start (and a task's due date) moved by as much as the id lies after the anchor.
 *
 * @param object - The recurring object
 * @param recurrenceId - The instance's id
 * @param delta - Wall milliseconds between the anchor and the id
 * @returns The instance
 */
function instanceOf<T extends JSCalendar.Entry>(object: T, recurrenceId: string, delta: number): T {
	let instance = { ...object, recurrenceId } as JSCalendar.Entry;
	delete instance.recurrenceRules;
	delete instance.excludedRecurrenceRules;
	delete instance.recurrenceOverrides;
	if (object.timeZone) instance.recurrenceIdTimeZone = object.timeZone;
	/** Moves a LocalDateTime by the instance's offset from the anchor. */
	let shift = (value: string) => {
		let parts = parseLocalDateTime(value);
		return parts ? formatLocalDateTime(wallFromMs(wallMs(parts) + delta)) : value;
	};
	if (instance["@type"] === "Event") instance.start = shift(instance.start);
	else {
		if (instance.start !== undefined) instance.start = shift(instance.start);
		if (instance.due !== undefined) instance.due = shift(instance.due);
	}
	return instance as T;
}

/**
 * Whether a span overlaps the window, an instant-long one counting when it lies inside it.
 *
 * @param span - The occurrence
 * @param options - The window
 * @returns `true` when it overlaps
 */
function overlaps(span: { start: number; end: number }, options: OccurrenceOptions): boolean {
	if (span.start >= options.to) return false;
	return span.end > options.from || (span.end <= span.start && span.start >= options.from);
}

/**
 * The longest a rule-generated instance can run, which widens the window so an occurrence
 * that started before `from` and still runs is found.
 *
 * @param object - The recurring object
 * @returns Milliseconds
 */
function longestSpan(object: JSCalendar.Entry): number {
	let length: DurationParts | null = null;
	if (object["@type"] === "Event" && object.duration) length = parseDuration(object.duration);
	if (object["@type"] === "Task" && object.start && object.due) {
		let start = parseLocalDateTime(object.start);
		let due = parseLocalDateTime(object.due);
		if (start && due) return Math.max(0, wallMs(due) - wallMs(start)) + DAY_MS;
	}
	if (!length) return 0;
	let days = (length.weeks ?? 0) * 7 + (length.days ?? 0);
	return (days + 1) * DAY_MS + ((length.hours ?? 0) * 60 + (length.minutes ?? 0)) * 60_000;
}

/**
 * The occurrences of an event or task overlapping a window, earliest first, each with the
 * instance it stands for. An object without recurrence properties occurs once, as itself.
 * A floating object is read in `options.timeZone`.
 *
 * @param object - The event or task to expand
 * @param options - The window, the limit and the zone for floating times
 * @returns The occurrences, or why the recurrence cannot be expanded
 * @template T - Event or Task
 * @example occurrences(event, { from: Date.now(), to: Date.now() + 30 * 86_400_000 });
 */
export function occurrences<T extends JSCalendar.Entry>(
	object: T,
	options: OccurrenceOptions,
): Result<Occurrence<T>[], RecurrenceError> {
	let limit = options.limit ?? DEFAULT_LIMIT;
	if (!(options.to > options.from) || limit <= 0) return success([]);
	let floatingZone = options.timeZone ?? "UTC";
	for (let zone of [object.timeZone, floatingZone]) {
		if (zone && !isUTCZone(zone) && !isValidTimeZone(zone)) {
			return failure(new RecurrenceError(`the time zone ${zone} is not one Intl knows`));
		}
	}
	let zoneOf = (instance: JSCalendar.Entry) => instance.timeZone ?? floatingZone;

	let anchorText = anchorOf(object);
	let anchor = anchorText === undefined ? null : parseLocalDateTime(anchorText);
	if (!anchor) return success([]);

	let recurs =
		object.recurrenceId === undefined &&
		(object.recurrenceRules !== undefined || object.recurrenceOverrides !== undefined);
	if (!recurs) {
		let span = spanOf(object, zoneOf(object));
		return success(span && overlaps(span, options) ? [{ ...span, object }] : []);
	}

	let anchorWall = wallMs(anchor);
	let margin = longestSpan(object) + 2 * DAY_MS;
	let window = { from: options.from - margin, to: options.to + 2 * DAY_MS };
	let overrides = object.recurrenceOverrides ?? {};

	for (let raw = limit + Object.keys(overrides).length + 16; ; raw *= 4) {
		let ids = new Map<number, string>();
		let horizon = Number.POSITIVE_INFINITY;
		/** Narrows the trusted window to the last start a truncated expansion returned. */
		let trust = (found: RuleStarts) => {
			if (found.truncated) horizon = Math.min(horizon, found.starts.at(-1) ?? horizon);
		};

		if (!object.recurrenceRules?.length) ids.set(anchorWall, formatLocalDateTime(anchor));
		for (let rule of object.recurrenceRules ?? []) {
			let found = ruleStarts(rule, anchorWall, window, raw);
			if (isFailure(found)) return found;
			trust(found.data);
			for (let start of found.data.starts) ids.set(start, formatLocalDateTime(wallFromMs(start)));
		}
		for (let rule of object.excludedRecurrenceRules ?? []) {
			let found = ruleStarts(rule, anchorWall, window, raw);
			if (isFailure(found)) return found;
			trust(found.data);
			let keepsAnchor = matchesAnchor(rule, anchor);
			if (isFailure(keepsAnchor)) return keepsAnchor;
			for (let start of found.data.starts) {
				if (start !== anchorWall || keepsAnchor.data) ids.delete(start);
			}
		}

		let patches = new Map<number, JSCalendar.PatchObject>();
		for (let [key, patch] of Object.entries(overrides)) {
			let parts = parseLocalDateTime(key);
			if (!parts) continue;
			let wall = wallMs(parts);
			if (patch.excluded === true) {
				ids.delete(wall);
				patches.delete(wall);
			} else {
				ids.set(wall, key);
				patches.set(wall, patch);
			}
		}

		let found: Occurrence<T>[] = [];
		for (let [wall, recurrenceId] of ids) {
			let patch = patches.get(wall);
			if (!patch && wall > horizon) continue;
			let instance = instanceOf(object, recurrenceId, wall - anchorWall);
			if (patch) {
				let patched = applyPatch(instance, applicable(patch));
				if (isFailure(patched)) {
					return failure(
						new RecurrenceError(
							`the override at ${recurrenceId} is invalid: ${patched.error.message}`,
						),
					);
				}
				instance = patched.data;
			}
			let span = spanOf(instance, zoneOf(instance));
			if (span && overlaps(span, options)) found.push({ recurrenceId, ...span, object: instance });
		}
		found.sort((a, b) => a.start - b.start || a.end - b.end);

		let complete = horizon === Number.POSITIVE_INFINITY || found.length >= limit || raw >= MAX_RAW;
		if (complete) return success(found.slice(0, limit));
	}
}
