/**
 * Structured descriptions of a schedule: the shapes an app maps to i18n keys
 * and interpolates numbers into, keeping all wording owned by the app that
 * renders it. Coverage is partial by design, and anything without a concise
 * shape falls back to the raw expression.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CronFieldSet } from "./fields.js";
import type { TimeOfDay } from "./types.js";

/**
 * How many times of day a descriptor will spell out before giving up. Past a day's
 * worth of entries a list stops explaining anything, and the expression reads better.
 */
const MAX_DESCRIBED_TIMES = 24;

/**
 * A schedule that repeats on a fixed spacing all day, every day, such as every 15
 * minutes or every 3 hours. Hour intervals fire on the hour.
 */
export interface IntervalDescriptor {
	kind: "interval";
	unit: "minute" | "hour";
	every: number;
}

/** A schedule that fires every hour, at these minutes past the hour. */
export interface HourlyDescriptor {
	kind: "hourly";
	minutes: readonly number[];
}

/** A schedule that fires every day, at these times of day. */
export interface DailyDescriptor {
	kind: "daily";
	at: readonly TimeOfDay[];
}

/**
 * A schedule that fires on given weekdays, at these times of day. Weekdays are
 * numbered with `0` for Sunday, as the cron field is.
 */
export interface WeeklyDescriptor {
	kind: "weekly";
	weekdays: readonly number[];
	at: readonly TimeOfDay[];
}

/** A schedule that fires on given days of every month, at these times of day. */
export interface MonthlyDescriptor {
	kind: "monthly";
	days: readonly number[];
	at: readonly TimeOfDay[];
}

/**
 * A schedule that fires on given days of given months, at these times of day.
 * Months are numbered from `1` for January, as the cron field is.
 */
export interface YearlyDescriptor {
	kind: "yearly";
	months: readonly number[];
	days: readonly number[];
	at: readonly TimeOfDay[];
}

/**
 * The fallback when no concise shape fits, including every schedule that restricts
 * both day fields, where the either-or rule cannot be phrased in one sentence. The
 * app shows the normalized expression instead.
 */
export interface ExpressionDescriptor {
	kind: "expression";
}

/** What `describe()` returns, discriminated on `kind`. */
export type ScheduleDescriptor =
	| IntervalDescriptor
	| HourlyDescriptor
	| DailyDescriptor
	| WeeklyDescriptor
	| MonthlyDescriptor
	| YearlyDescriptor
	| ExpressionDescriptor;

/**
 * Reduce a parsed schedule to the descriptor that explains it, or to
 * `{ kind: "expression" }` when nothing shorter than the expression does.
 *
 * @param fields - The parsed schedule.
 * @returns A frozen descriptor, safe to hand to a template.
 *
 * @example
 * describeFields(fields); // { kind: "interval", unit: "minute", every: 15 }
 * @example
 * describeFields(fields); // { kind: "weekly", weekdays: [1, 3, 5], at: [{ hour: 9, minute: 0 }] }
 */
export function describeFields(fields: CronFieldSet): ScheduleDescriptor {
	let everyMonth = fields.months.length === 12;
	let everyDay = !fields.dayOfMonthRestricted && !fields.dayOfWeekRestricted;

	if (everyMonth && everyDay) return describeEveryDay(fields);

	if (everyMonth && !fields.dayOfMonthRestricted && fields.dayOfWeekRestricted) {
		let at = timesOf(fields);
		if (at === null) return frozen({ kind: "expression" });
		return frozen({ kind: "weekly", weekdays: [...fields.daysOfWeek], at });
	}

	if (fields.dayOfMonthRestricted && !fields.dayOfWeekRestricted) {
		let at = timesOf(fields);
		if (at === null) return frozen({ kind: "expression" });
		if (everyMonth) return frozen({ kind: "monthly", days: [...fields.daysOfMonth], at });
		return frozen({
			kind: "yearly",
			months: [...fields.months],
			days: [...fields.daysOfMonth],
			at,
		});
	}

	return frozen({ kind: "expression" });
}

/**
 * Describe a schedule with no date restriction, where the time fields alone decide
 * the shape: a spacing, a set of minutes past every hour, or a set of daily times.
 *
 * @param fields - The parsed schedule, known to fire on every date.
 * @returns The interval, hourly, or daily descriptor, or the expression fallback.
 */
function describeEveryDay(fields: CronFieldSet): ScheduleDescriptor {
	if (fields.hours.length === 24) {
		if (fields.minutes.length === 60) {
			return frozen({ kind: "interval", unit: "minute", every: 1 });
		}
		let minuteStep = stepFromStart(fields.minutes, 0, 59);
		if (minuteStep !== null) {
			return frozen({ kind: "interval", unit: "minute", every: minuteStep });
		}
		return frozen({ kind: "hourly", minutes: [...fields.minutes] });
	}

	let hourStep = stepFromStart(fields.hours, 0, 23);
	if (hourStep !== null && fields.minutes.length === 1 && fields.minutes[0] === 0) {
		return frozen({ kind: "interval", unit: "hour", every: hourStep });
	}

	let at = timesOf(fields);
	if (at === null) return frozen({ kind: "expression" });
	return frozen({ kind: "daily", at });
}

/**
 * Every time of day the hour and minute fields combine into, in clock order.
 *
 * @param fields - The parsed schedule.
 * @returns The times, or `null` when there are more than a descriptor spells out.
 */
function timesOf(fields: CronFieldSet): readonly TimeOfDay[] | null {
	if (fields.hours.length * fields.minutes.length > MAX_DESCRIBED_TIMES) return null;

	let times: TimeOfDay[] = [];
	for (let hour of fields.hours) {
		for (let minute of fields.minutes) times.push(Object.freeze({ hour, minute }));
	}
	return Object.freeze(times);
}

/**
 * The spacing a value set repeats on, when it starts at the field's minimum and
 * steps evenly to the end of its range, which is what `*` with a step produces.
 *
 * @param values - Sorted field values.
 * @param min - The field's smallest value.
 * @param max - The field's largest value.
 * @returns The spacing above one, or `null` when the set is not such a series.
 *
 * @example
 * stepFromStart([0, 15, 30, 45], 0, 59); // 15
 * @example
 * stepFromStart([5, 15, 25], 0, 59); // null, it does not start at 0
 */
export function stepFromStart(values: readonly number[], min: number, max: number): number | null {
	if (values.length < 2) return null;
	if (values[0] !== min) return null;

	let step = (values[1] ?? min) - min;
	if (step < 2) return null;

	for (let index = 1; index < values.length; index++) {
		if ((values[index] ?? -1) - (values[index - 1] ?? -1) !== step) return null;
	}

	let last = values[values.length - 1] ?? min;
	if (last + step <= max) return null;

	return step;
}

/**
 * Freeze a descriptor so a consumer cannot mutate what a schedule reports about
 * itself, keeping `describe()` safe to call more than once.
 *
 * @param descriptor - The descriptor to freeze.
 * @returns The same object, frozen.
 */
function frozen(descriptor: ScheduleDescriptor): ScheduleDescriptor {
	return Object.freeze(descriptor);
}
