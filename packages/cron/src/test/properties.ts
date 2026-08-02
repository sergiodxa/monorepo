/**
 * The properties every generated expression is held to, written once because every
 * sweep in the package asserts the same ones. They are stated as invariants over a
 * schedule's own answers, so a case that fails names the rule it broke rather than an
 * instant somebody transcribed by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect } from "bun:test";

import { isSuccess, unwrap } from "@pkg/result";

import type { ScheduleDescriptor } from "../describe";
import type { CronFieldSet } from "../fields";
import type { InvalidCronExpression } from "../invalid-cron-expression";
import type { Schedule } from "../schedule";

import { describeFields } from "../describe";
import { parseExpression } from "../parse-expression";
import { Schedule as CronSchedule } from "../schedule";
import { offsetAt } from "../time-zone";

/** One minute in milliseconds, the resolution every occurrence lands on. */
const MINUTE_MS = 60_000;

/** Times of day a descriptor spells out before falling back to the expression. */
const MAX_DESCRIBED_TIMES = 24;

/** Parse an expression, failing the test if the package rejected it. */
export function scheduleFor(expression: string): Schedule {
	return unwrap(CronSchedule.parse(expression));
}

/** Parse an expression into its field sets, failing the test if it was rejected. */
export function fieldsFor(expression: string): CronFieldSet {
	return unwrap(parseExpression(expression));
}

/** Parse an expression, failing the test if the package accepted it. */
export function rejectionOf(expression: string): InvalidCronExpression {
	let result = CronSchedule.parse(expression);
	if (isSuccess(result)) throw new Error(`unexpected success for ${JSON.stringify(expression)}`);
	return result.error;
}

/**
 * Whether the zone's offset moves within a day of an instant. On such a day a run can
 * be carried out of a wall time the clock skipped, and a carried run does not match
 * the fields it came from, so the properties that read the wall clock do not hold
 * there. Which instant is carried is pinned by name in `occurrences.test.ts`; here the
 * day is simply excluded from those two checks and still held to the rest.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name.
 * @returns `true` when the offset differs anywhere in the surrounding day.
 */
function offsetMovesAround(instant: number, timeZone: string): boolean {
	let before = offsetAt(instant - 12 * 60 * MINUTE_MS, timeZone);
	let after = offsetAt(instant + 12 * 60 * MINUTE_MS, timeZone);
	return before !== after;
}

/**
 * Normalization is stable: an expression written back reads as itself, and it reads
 * back into the same field sets, which is what makes the two fire on the same minutes.
 * Storage depends on both, since what a repository keeps is the normalized text rather
 * than what the user typed.
 *
 * @param expression - Any expression the package accepts.
 *
 * @example
 * expectStableNormalization("5/10 * * * *");
 */
export function expectStableNormalization(expression: string): void {
	let once = scheduleFor(expression).toString();
	let twice = scheduleFor(once).toString();

	expect({ expression, normalized: twice }).toEqual({ expression, normalized: once });
	expect({ expression, fields: fieldsFor(once) }).toEqual({
		expression,
		fields: fieldsFor(expression),
	});
}

/**
 * Every invariant an occurrence search owes its caller, checked against one schedule
 * from one instant:
 *
 * - occurrences come back in strictly increasing order and never repeat;
 * - each one lands on a whole minute, seconds and milliseconds zero;
 * - asking for `count` of them gives the same answers as asking one at a time;
 * - each one is reachable again from a millisecond before it, and from the occurrence
 *   before it, so `next` and `prev` agree on which instants are occurrences;
 * - each one matches the schedule, and the minutes either side match exactly when they
 *   are themselves occurrences;
 * - `expectedBy` is the next occurrence plus the grace period, and `isDue` turns true
 *   on that instant and not a millisecond earlier.
 *
 * @param expression - Any expression the package accepts.
 * @param options - Where to start, the zone to evaluate in, and how many to take.
 *
 * @example
 * expectOccurrenceInvariants("0 9 * * 1-5", { from: "2026-03-01T00:00:00Z", timeZone: "UTC" });
 */
export function expectOccurrenceInvariants(
	expression: string,
	options: { from: string; timeZone: string; count?: number },
): void {
	let { timeZone } = options;
	let count = options.count ?? 6;
	let schedule = scheduleFor(expression);
	let from = new Date(options.from);
	let where = { expression, timeZone, from: options.from };

	let batch = schedule.next({ from, timeZone, count });

	let single: Date[] = [];
	let cursor = from;
	for (let taken = 0; taken < count; taken++) {
		let occurrence = schedule.next({ from: cursor, timeZone });
		if (Number.isNaN(occurrence.getTime())) break;
		single.push(occurrence);
		cursor = occurrence;
	}
	expect({ ...where, runs: batch.map(iso) }).toEqual({ ...where, runs: single.map(iso) });

	let previous = from.getTime();
	for (let occurrence of batch) {
		let instant = occurrence.getTime();
		let at = { ...where, at: iso(occurrence) };

		expect({ ...at, increasing: instant > previous }).toEqual({ ...at, increasing: true });
		expect({
			...at,
			seconds: occurrence.getUTCSeconds(),
			ms: occurrence.getUTCMilliseconds(),
		}).toEqual({ ...at, seconds: 0, ms: 0 });
		previous = instant;

		expect({
			...at,
			reached: iso(schedule.next({ from: new Date(instant - 1), timeZone })),
		}).toEqual({
			...at,
			reached: iso(occurrence),
		});

		let back = schedule.prev({ from: occurrence, timeZone });
		if (!Number.isNaN(back.getTime())) {
			expect({ ...at, forward: iso(schedule.next({ from: back, timeZone })) }).toEqual({
				...at,
				forward: iso(occurrence),
			});
		}

		let deadline = schedule.expectedBy(back, { timeZone });
		if (!Number.isNaN(back.getTime()) && !Number.isNaN(deadline.getTime())) {
			expect({ ...at, deadline: iso(deadline) }).toEqual({ ...at, deadline: iso(occurrence) });
			expect({
				...at,
				due: schedule.isDue(back, { now: occurrence, timeZone }),
				early: schedule.isDue(back, { now: new Date(instant - 1), timeZone }),
			}).toEqual({ ...at, due: true, early: false });
			let graced = schedule.expectedBy(back, { timeZone, grace: "5 minutes" });
			expect({ ...at, graced: graced.getTime() - instant }).toEqual({
				...at,
				graced: 5 * MINUTE_MS,
			});
		}

		if (offsetMovesAround(instant, timeZone)) continue;

		expect({ ...at, matches: schedule.matches(occurrence, { timeZone }) }).toEqual({
			...at,
			matches: true,
		});

		let after = new Date(instant + MINUTE_MS);
		let before = new Date(instant - MINUTE_MS);
		expect({
			...at,
			nextMinuteMatches: schedule.matches(after, { timeZone }),
			previousMinuteMatches: schedule.matches(before, { timeZone }),
		}).toEqual({
			...at,
			nextMinuteMatches:
				schedule.next({ from: occurrence, timeZone }).getTime() === after.getTime(),
			previousMinuteMatches:
				schedule.prev({ from: occurrence, timeZone }).getTime() === before.getTime(),
		});
	}
}

/**
 * Walking a window forward and walking it backward find the same instants. It is the
 * sharpest thing that can be asked of an occurrence search without naming a single
 * expected value: the two directions are separate code paths, so any instant one of
 * them invents or loses shows up as a difference rather than as agreement with a
 * transcript. A run missing from the backward walk is a monitor computing lateness
 * from the wrong baseline.
 *
 * @param expression - Any expression the package accepts.
 * @param options - The window as two ISO instants, and the zone to walk it in.
 *
 * @example
 * expectWalksAgree("0 * 4 4 *", { timeZone: "America/Santiago", from: "...", until: "..." });
 */
export function expectWalksAgree(
	expression: string,
	options: { timeZone: string; from: string; until: string },
): void {
	let { timeZone } = options;
	let schedule = scheduleFor(expression);
	let start = new Date(options.from).getTime();
	let end = new Date(options.until).getTime();
	let guard = 5_000;

	let forward: string[] = [];
	let cursor = new Date(start);
	for (let taken = 0; taken < guard; taken++) {
		cursor = schedule.next({ from: cursor, timeZone });
		if (Number.isNaN(cursor.getTime()) || cursor.getTime() >= end) break;
		forward.push(cursor.toISOString());
	}

	let backward: string[] = [];
	cursor = new Date(end);
	for (let taken = 0; taken < guard; taken++) {
		cursor = schedule.prev({ from: cursor, timeZone });
		if (Number.isNaN(cursor.getTime()) || cursor.getTime() <= start) break;
		backward.push(cursor.toISOString());
	}
	backward.reverse();

	let where = { expression, timeZone, window: `${options.from}/${options.until}` };
	expect({ ...where, runs: backward }).toEqual({ ...where, runs: forward });
	expect({ ...where, found: forward.length > 0 }).toEqual({ ...where, found: true });
}

/**
 * The descriptor a schedule reports is the one its fields call for. The shape is
 * derived here from the field sets rather than from `describe()`, so a schedule that
 * quietly starts falling back to the raw expression fails instead of passing: that
 * fallback is a sentence a user stops being shown.
 *
 * @param expression - Any expression the package accepts.
 *
 * @example
 * expectDescriptorShape("0 9 * * 1,3,5"); // must be a weekly descriptor
 */
export function expectDescriptorShape(expression: string): void {
	let fields = fieldsFor(expression);
	let descriptor = describeFields(fields);
	let times = fields.hours.length * fields.minutes.length;
	let everyMonth = fields.months.length === 12;
	let spelled = times <= MAX_DESCRIBED_TIMES;
	let where = { expression, kind: descriptor.kind };

	if (fields.dayOfMonthRestricted && fields.dayOfWeekRestricted) {
		// The either-or rule cannot be said in one sentence, so there is nothing to report.
		expect(where).toEqual({ expression, kind: "expression" });
		return;
	}

	if (fields.dayOfMonthRestricted) {
		let kind: ScheduleDescriptor["kind"] = spelled
			? everyMonth
				? "monthly"
				: "yearly"
			: "expression";
		expect(where).toEqual({ expression, kind });
		return;
	}

	if (fields.dayOfWeekRestricted) {
		let kind: ScheduleDescriptor["kind"] = everyMonth && spelled ? "weekly" : "expression";
		expect(where).toEqual({ expression, kind });
		return;
	}

	if (!everyMonth) {
		// Only the month is narrowed, and no descriptor carries a month on its own.
		expect(where).toEqual({ expression, kind: "expression" });
		return;
	}

	if (fields.hours.length === 24) {
		// Firing in every hour is either a spacing or a set of minutes past the hour.
		expectOneOf(where, ["interval", "hourly"]);
		return;
	}

	// A day's worth of named times reads as a spacing of hours or a list of times;
	// past that the list stops explaining anything and the expression reads better.
	if (spelled) expectOneOf(where, ["interval", "daily"]);
	else expect(where).toEqual({ expression, kind: "expression" });
}

/**
 * Assert a descriptor's kind is one of several, carrying the expression into the
 * comparison so a failure says which schedule stopped being described.
 *
 * @param where - The expression and the kind it reported.
 * @param kinds - The kinds its fields allow.
 */
function expectOneOf(
	where: { expression: string; kind: ScheduleDescriptor["kind"] },
	kinds: readonly ScheduleDescriptor["kind"][],
): void {
	expect({ ...where, allowed: kinds.includes(where.kind) }).toEqual({ ...where, allowed: true });
}

/**
 * An instant as text, so a failing comparison prints the time and not the epoch.
 *
 * @param date - The instant.
 * @returns Its ISO form, or `"invalid"` when there is no instant.
 */
function iso(date: Date): string {
	return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}
