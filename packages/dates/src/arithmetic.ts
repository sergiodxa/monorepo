/**
 * Instant arithmetic: moving a point in time by a fixed length, and measuring the
 * length between two points. None of it takes a zone, because a length of time is
 * the same length everywhere; only naming a calendar day needs a zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { toMs } from "@pkg/duration";

import { DAY_MS } from "./zone";

/**
 * Move an instant forward by whole 24-hour days.
 *
 * This is instant arithmetic, not calendar arithmetic: across a DST transition the
 * result lands an hour off the original wall clock, which is correct for "24 hours
 * later" and wrong for "the same time tomorrow". Use `eachDayOfInterval` or
 * `startOfDay` when the calendar day is what matters.
 *
 * @param date - Instant to move.
 * @param count - Days to add; negative moves back.
 * @returns A new `Date`; the input is never mutated.
 *
 * @example
 * addDays(new Date("2026-07-29T10:00:00Z"), 3); // 2026-08-01T10:00:00Z
 */
export function addDays(date: Date, count: number): Date {
	return new Date(date.getTime() + count * DAY_MS);
}

/**
 * Move an instant back by whole 24-hour days, with the same instant semantics as
 * `addDays`.
 *
 * @param date - Instant to move.
 * @param count - Days to subtract; negative moves forward.
 * @returns A new `Date`; the input is never mutated.
 *
 * @example
 * subDays(new Date("2026-07-29T10:00:00Z"), 1); // 2026-07-28T10:00:00Z
 */
export function subDays(date: Date, count: number): Date {
	return new Date(date.getTime() - count * DAY_MS);
}

/**
 * Move an instant forward by a duration, written with its unit at the call site so
 * the shift is readable and the unit is never implied.
 *
 * @param date - Instant to move.
 * @param duration - A duration string, or a number of milliseconds.
 * @returns A new `Date`; the input is never mutated.
 *
 * @example
 * add(new Date("2026-07-29T10:00:00Z"), "90 minutes"); // 2026-07-29T11:30:00Z
 */
export function add(date: Date, duration: DurationInput): Date {
	return new Date(date.getTime() + toMs(duration));
}

/**
 * Move an instant back by a duration.
 *
 * @param date - Instant to move.
 * @param duration - A duration string, or a number of milliseconds.
 * @returns A new `Date`; the input is never mutated.
 *
 * @example
 * subtract(new Date("2026-07-29T10:00:00Z"), "30 minutes"); // 2026-07-29T09:30:00Z
 */
export function subtract(date: Date, duration: DurationInput): Date {
	return new Date(date.getTime() - toMs(duration));
}

/**
 * Milliseconds between an instant and now, positive once the instant is in the
 * past. The current time is an argument with a default so a caller measuring real
 * elapsed time writes nothing extra, while a test passes both ends and needs no
 * frozen clock.
 *
 * @param since - The earlier instant, as a `Date` or a timestamp.
 * @param now - The instant to measure to; defaults to the current time.
 * @returns Elapsed milliseconds, negative when `since` is in the future.
 *
 * @example
 * let startedAt = Date.now();
 * logger.info("done", { ms: elapsed(startedAt) });
 * @example
 * elapsed(new Date("2026-07-29T10:00:00Z"), new Date("2026-07-29T10:00:05Z")); // 5000
 */
export function elapsed(since: Date | number, now: Date | number = Date.now()): number {
	let end = typeof now === "number" ? now : now.getTime();
	let start = typeof since === "number" ? since : since.getTime();
	return end - start;
}
