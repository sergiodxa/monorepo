/**
 * The properties every generated expression is held to, written once because every
 * sweep in the package asserts the same ones. They are stated as invariants over a
 * schedule's own answers, so a case that fails names the rule it broke rather than an
 * instant somebody transcribed by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, unwrap } from "@pkg/result";
import { expect } from "vitest";

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
 * Whether the zone's offset moves within a day of an instant, since on such a day a run
 * can be carried out of a wall time the clock skipped and no longer matches the fields
 * it came from. That day is excluded from the wall-clock checks here, and held to the rest.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name.
 * @returns `true` when the offset differs anywhere in the surrounding day.
 * @see occurrences.test.ts pins which instant is carried, by name.
 */
function offsetMovesAround(instant: number, timeZone: string): boolean {
	let before = offsetAt(instant - 12 * 60 * MINUTE_MS, timeZone);
	let after = offsetAt(instant + 12 * 60 * MINUTE_MS, timeZone);
	return before !== after;
}

/**
 * Normalization is stable: an expression written back reads as itself, and reads back
 * into the same field sets, which is what lets the two fire on the same minutes. Storage
 * depends on both, since a repository persists only the normalized text.
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
 * Every invariant an occurrence search owes its caller, checked against one schedule from
 * one instant — strictly increasing whole-minute results, batch-versus-single agreement,
 * `next`/`prev` reachability, schedule-matching at each occurrence, and `expectedBy`/`isDue` timing.
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
 * Walking a window forward and backward finds the same instants, since the two directions
 * are separate code paths and any instant either one invents or loses shows up as a
 * difference — a run missing from the backward walk is a monitor computing lateness from the wrong baseline.
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
 * The descriptor a schedule reports is the one its fields call for, computed independently
 * of `describe()` so a schedule that quietly starts falling back to the raw expression
 * fails instead of passing — that fallback is a sentence a user stops being shown.
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
		expect(where).toEqual({ expression, kind: "expression" });
		return;
	}

	if (fields.hours.length === 24) {
		expectOneOf(where, ["interval", "hourly"]);
		return;
	}

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
