/**
 * The RRULE expansion engine of RFC 5545 §3.3.10, working on wall clocks: each period of the
 * rule's frequency contributes every day and time its `BYxxx` parts select, `BYSETPOS` picks
 * from that set, and the caller turns each wall clock into an instant through its zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { calendarDayFromEpochDay, DAY_MS, epochDayOf } from "@sdxc/dates/zone";
import { failure, success } from "@sdxc/result";

import type { ICalendar } from "../types.js";

import { RecurrenceRuleError } from "./errors.js";
import { FREQUENCIES, validateRecurrence, WEEKDAYS } from "./recurrence.js";
import { daysInMonth } from "./values.js";

/** Frequency indexes, coarsest first, matching `FREQUENCIES`. */
const YEARLY = 0;
const MONTHLY = 1;
const WEEKLY = 2;
const DAILY = 3;
const HOURLY = 4;
const MINUTELY = 5;

/** Milliseconds per unit of the sub-daily frequencies, indexed by frequency. */
const SUB_DAILY_UNIT_MS: Record<number, number> = { 4: 3_600_000, 5: 60_000, 6: 1000 };

/**
 * Periods one expansion may visit. Every expansion is also bounded by a horizon, so this
 * only stops a `COUNT` rule whose first instances lie far before the window at a fine
 * frequency, and a failure says so.
 */
const MAX_PERIODS = 500_000;

/** A rule with its `DTSTART` defaults applied and its lists turned into lookups. */
interface Plan {
	frequency: number;
	interval: number;
	byMonth: Set<number> | null;
	byWeekNumber: number[] | null;
	byYearDay: number[] | null;
	byMonthDay: number[] | null;
	byWeekday: Set<number> | null;
	byNthWeekday: { weekday: number; ordinal: number }[] | null;
	byHour: number[] | null;
	byMinute: number[] | null;
	bySecond: number[] | null;
	bySetPosition: number[] | null;
	weekStart: number;
}

/** How far and from where an expansion runs, and how its wall clocks become instants. */
export interface ExpandOptions {
	/** The last wall clock, in wall milliseconds, the caller can use. */
	horizon: number;
	/** A wall clock the caller needs nothing before; honored only for rules without `COUNT`. */
	skipTo?: number;
	/** The instant a wall clock names in the start's zone. */
	toInstant: (wall: number) => number;
	/** The inclusive last instant `UNTIL` allows, or `null` without one. */
	until: number | null;
}

/**
 * A wall clock as milliseconds on a zone-less timeline, where every day is exactly 24 hours.
 *
 * @param wall - The wall clock
 * @returns Wall milliseconds
 */
export function wallMs(wall: ICalendar.WallClock): number {
	return epochDayOf(wall) * DAY_MS + ((wall.hour * 60 + wall.minute) * 60 + wall.second) * 1000;
}

/**
 * The wall clock wall milliseconds name, the inverse of `wallMs`.
 *
 * @param ms - Wall milliseconds
 * @returns The wall clock
 */
export function wallFromMs(ms: number): ICalendar.WallClock {
	let epochDay = Math.floor(ms / DAY_MS);
	let seconds = Math.floor((ms - epochDay * DAY_MS) / 1000);
	return {
		...calendarDayFromEpochDay(epochDay),
		hour: Math.floor(seconds / 3600),
		minute: Math.floor((seconds % 3600) / 60),
		second: seconds % 60,
	};
}

/**
 * The weekday of a day index, `0` Sunday through `6` Saturday.
 *
 * @param epochDay - Whole days since 1970-01-01, a Thursday
 * @returns The weekday index
 */
function weekdayOfEpochDay(epochDay: number): number {
	return (((epochDay + 4) % 7) + 7) % 7;
}

/**
 * The first day of week 1 of a year: the week, starting on `weekStart`, that holds January
 * 4th and so at least four days of the year.
 *
 * @param year - Calendar year
 * @param weekStart - Weekday index weeks start on
 * @returns The day index week 1 starts on
 */
function firstWeekStart(year: number, weekStart: number): number {
	let january4 = epochDayOf({ year, month: 1, day: 4 });
	return january4 - ((weekdayOfEpochDay(january4) - weekStart + 7) % 7);
}

/**
 * Whether a day falls in one of the listed week numbers. The day's week is numbered in the
 * year holding most of that week, so late December can be week 1 and early January week 52
 * or 53, and negative numbers count back from that year's last week.
 *
 * @param epochDay - The day to test
 * @param plan - The rule, for its week numbers and week start
 * @returns `true` when the day's week is listed
 */
function inWeekNumbers(epochDay: number, plan: Plan): boolean {
	let weekStart = epochDay - ((weekdayOfEpochDay(epochDay) - plan.weekStart + 7) % 7);
	let weekYear = calendarDayFromEpochDay(weekStart + 3).year;
	let first = firstWeekStart(weekYear, plan.weekStart);
	let week = (weekStart - first) / 7 + 1;
	let weeks = (firstWeekStart(weekYear + 1, plan.weekStart) - first) / 7;
	return (plan.byWeekNumber ?? []).some((number) => number === week || number === week - weeks - 1);
}

/**
 * Whether a year has 366 days.
 *
 * @param year - Calendar year
 * @returns `true` for a leap year
 */
function isLeapYear(year: number): boolean {
	return daysInMonth(year, 2) === 29;
}

/**
 * Whether a day passes every day-level `BYxxx` part. An ordinal `BYDAY` counts within the
 * month for `MONTHLY` and for `YEARLY` with `BYMONTH`, and within the year otherwise.
 *
 * @param epochDay - The day to test
 * @param plan - The rule
 * @returns `true` when the day is selected
 */
function dayMatches(epochDay: number, plan: Plan): boolean {
	let { year, month, day } = calendarDayFromEpochDay(epochDay);
	if (plan.byMonth && !plan.byMonth.has(month)) return false;
	if (plan.byWeekNumber && !inWeekNumbers(epochDay, plan)) return false;
	let yearLength = isLeapYear(year) ? 366 : 365;
	let yearDay = epochDay - epochDayOf({ year, month: 1, day: 1 }) + 1;
	if (plan.byYearDay?.every((n) => n !== yearDay && n !== yearDay - yearLength - 1)) return false;
	let monthLength = daysInMonth(year, month);
	if (plan.byMonthDay?.every((n) => n !== day && n !== day - monthLength - 1)) return false;
	if (!plan.byWeekday && !plan.byNthWeekday) return true;
	let weekday = weekdayOfEpochDay(epochDay);
	if (plan.byWeekday?.has(weekday)) return true;
	let withinMonth = plan.frequency === MONTHLY || plan.byMonth !== null;
	let index = withinMonth ? day : yearDay;
	let length = withinMonth ? monthLength : yearLength;
	let fromStart = Math.floor((index - 1) / 7) + 1;
	let fromEnd = -(Math.floor((length - index) / 7) + 1);
	return (plan.byNthWeekday ?? []).some(
		(entry) =>
			entry.weekday === weekday && (entry.ordinal === fromStart || entry.ordinal === fromEnd),
	);
}

/**
 * Sorts and deduplicates a list of numbers.
 *
 * @param values - The numbers
 * @returns Them ascending, each once
 */
function sortedUnique(values: number[]): number[] {
	return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Applies `DTSTART`'s defaults to a rule (RFC 5545 §3.3.10): with no day-level part, a
 * `YEARLY` rule keeps the start's month and day, a `MONTHLY` one its day and a `WEEKLY` one
 * its weekday, and every frequency coarser than a time part keeps the start's value for it.
 *
 * @param rule - A validated rule
 * @param start - The start's wall clock
 * @returns The expansion plan
 */
function createPlan(rule: ICalendar.RecurrenceRule, start: ICalendar.WallClock): Plan {
	let frequency = FREQUENCIES.indexOf(rule.frequency);
	let listOrNull = (values: number[] | undefined) => (values?.length ? sortedUnique(values) : null);
	let plan: Plan = {
		frequency,
		interval: rule.interval ?? 1,
		byMonth: rule.byMonth?.length ? new Set(rule.byMonth) : null,
		byWeekNumber: listOrNull(rule.byWeekNumber),
		byYearDay: listOrNull(rule.byYearDay),
		byMonthDay: listOrNull(rule.byMonthDay),
		byWeekday: null,
		byNthWeekday: null,
		byHour: listOrNull(rule.byHour),
		byMinute: listOrNull(rule.byMinute),
		bySecond: listOrNull(rule.bySecond?.filter((second) => second < 60)),
		bySetPosition: listOrNull(rule.bySetPosition),
		weekStart: WEEKDAYS.indexOf(rule.weekStart ?? "MO"),
	};
	for (let entry of rule.byDay ?? []) {
		let weekday = WEEKDAYS.indexOf(entry.weekday);
		if (entry.ordinal && (frequency === MONTHLY || frequency === YEARLY)) {
			(plan.byNthWeekday ??= []).push({ weekday, ordinal: entry.ordinal });
		} else (plan.byWeekday ??= new Set()).add(weekday);
	}
	let hasDayPart =
		plan.byWeekNumber || plan.byYearDay || plan.byMonthDay || plan.byWeekday || plan.byNthWeekday;
	if (!hasDayPart && frequency === YEARLY) {
		plan.byMonth ??= new Set([start.month]);
		plan.byMonthDay = [start.day];
	} else if (!hasDayPart && frequency === MONTHLY) plan.byMonthDay = [start.day];
	else if (!hasDayPart && frequency === WEEKLY) {
		plan.byWeekday = new Set([weekdayOfEpochDay(epochDayOf(start))]);
	}
	if (frequency < HOURLY) plan.byHour ??= [start.hour];
	if (frequency < MINUTELY) plan.byMinute ??= [start.minute];
	if (frequency < MINUTELY + 1) plan.bySecond ??= [start.second];
	return plan;
}

/**
 * Every combination of hours, minutes and seconds, as seconds of the day, ascending.
 *
 * @param hours - Hours to combine
 * @param minutes - Minutes to combine
 * @param seconds - Seconds to combine
 * @returns Seconds since midnight
 */
function timesOfDay(hours: number[], minutes: number[], seconds: number[]): number[] {
	let times: number[] = [];
	for (let hour of hours) {
		for (let minute of minutes)
			for (let second of seconds) times.push((hour * 60 + minute) * 60 + second);
	}
	return times;
}

/**
 * The days a period of a day-based frequency covers.
 *
 * @param plan - The rule
 * @param cursor - The period: a year, a month index (`year * 12 + month - 1`), a week's
 *   first day or a day
 * @returns Day indexes, ascending
 */
function periodDays(plan: Plan, cursor: number): number[] {
	let days: number[] = [];
	let addMonth = (year: number, month: number) => {
		let first = epochDayOf({ year, month, day: 1 });
		for (let day = 0; day < daysInMonth(year, month); day++) days.push(first + day);
	};
	if (plan.frequency === YEARLY) {
		let months = plan.byMonth
			? sortedUnique([...plan.byMonth])
			: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
		for (let month of months) addMonth(cursor, month);
	} else if (plan.frequency === MONTHLY) addMonth(Math.floor(cursor / 12), (cursor % 12) + 1);
	else if (plan.frequency === WEEKLY) for (let day = 0; day < 7; day++) days.push(cursor + day);
	else days.push(cursor);
	return days;
}

/**
 * The first instant of a day-based period, in wall milliseconds.
 *
 * @param plan - The rule
 * @param cursor - The period, as `periodDays` takes it
 * @returns Wall milliseconds
 */
function periodStart(plan: Plan, cursor: number): number {
	if (plan.frequency === YEARLY) return epochDayOf({ year: cursor, month: 1, day: 1 }) * DAY_MS;
	if (plan.frequency === MONTHLY) {
		return epochDayOf({ year: Math.floor(cursor / 12), month: (cursor % 12) + 1, day: 1 }) * DAY_MS;
	}
	return cursor * DAY_MS;
}

/**
 * Picks `BYSETPOS` positions from a period's candidates: positive from the start, negative
 * from the end, out-of-range positions ignored.
 *
 * @param candidates - The period's wall clocks, ascending
 * @param positions - The positions
 * @returns The picked wall clocks, ascending and each once
 */
function pickPositions(candidates: number[], positions: number[]): number[] {
	let picked: number[] = [];
	for (let position of positions) {
		let value = position > 0 ? candidates[position - 1] : candidates[candidates.length + position];
		if (value !== undefined) picked.push(value);
	}
	return sortedUnique(picked);
}

/**
 * Generates a rule's wall clocks after `start`, period by period, ascending, until a period
 * begins past the horizon.
 *
 * @param plan - The rule
 * @param start - The start, in wall milliseconds
 * @param horizon - The last wall clock needed
 * @param skipTo - A wall clock nothing before is needed, or `null`
 * @yields Wall milliseconds of each instance after the start
 * @returns `"capped"` when `MAX_PERIODS` ended the walk, `"done"` otherwise
 */
function* wallClocks(
	plan: Plan,
	start: number,
	horizon: number,
	skipTo: number | null,
): Generator<number, "done" | "capped"> {
	let startWall = wallFromMs(start);
	let startDay = Math.floor(start / DAY_MS);
	let subDaily = plan.frequency >= HOURLY;
	let step = subDaily ? (SUB_DAILY_UNIT_MS[plan.frequency] ?? 1000) * plan.interval : 0;
	let cursor = start;
	if (plan.frequency === YEARLY) cursor = startWall.year;
	else if (plan.frequency === MONTHLY) cursor = startWall.year * 12 + startWall.month - 1;
	else if (plan.frequency === WEEKLY) {
		cursor = startDay - ((weekdayOfEpochDay(startDay) - plan.weekStart + 7) % 7);
	} else if (plan.frequency === DAILY) cursor = startDay;

	if (skipTo !== null && skipTo > start) {
		let target = wallFromMs(skipTo);
		let skipDay = Math.floor(skipTo / DAY_MS);
		let distance = 0;
		let unit = 1;
		if (plan.frequency === YEARLY) distance = target.year - cursor;
		else if (plan.frequency === MONTHLY) distance = target.year * 12 + target.month - 1 - cursor;
		else if (plan.frequency === WEEKLY) [distance, unit] = [skipDay - cursor, 7];
		else if (plan.frequency === DAILY) distance = skipDay - cursor;
		else [distance, unit] = [skipTo - cursor, step / plan.interval];
		let periods = Math.floor(distance / (unit * plan.interval));
		if (periods > 0) cursor += periods * plan.interval * unit;
	}

	let dailyTimes =
		plan.frequency <= DAILY
			? timesOfDay(plan.byHour ?? [], plan.byMinute ?? [], plan.bySecond ?? [])
			: [];
	let checkedDay = Number.NaN;
	let dayPasses = false;
	for (let visited = 0; visited < MAX_PERIODS; visited++) {
		let candidates: number[] = [];
		if (subDaily) {
			if (cursor > horizon) return "done";
			let day = Math.floor(cursor / DAY_MS);
			if (day !== checkedDay) [checkedDay, dayPasses] = [day, dayMatches(day, plan)];
			let { hour, minute, second } = wallFromMs(cursor);
			let hourPasses = !plan.byHour || plan.byHour.includes(hour);
			if (!dayPasses || !hourPasses) {
				let boundary = dayPasses
					? Math.floor(cursor / 3_600_000 + 1) * 3_600_000
					: (day + 1) * DAY_MS;
				cursor += Math.max(1, Math.ceil((boundary - cursor) / step)) * step;
				continue;
			}
			let minutes = plan.frequency === HOURLY ? (plan.byMinute ?? [minute]) : [minute];
			let seconds = plan.frequency === 6 ? [second] : (plan.bySecond ?? [second]);
			if (plan.frequency !== HOURLY && plan.byMinute && !plan.byMinute.includes(minute))
				minutes = [];
			if (plan.frequency === 6 && plan.bySecond && !plan.bySecond.includes(second)) seconds = [];
			for (let time of timesOfDay([hour], minutes, seconds))
				candidates.push(day * DAY_MS + time * 1000);
			cursor += step;
		} else {
			if (periodStart(plan, cursor) > horizon) return "done";
			for (let day of periodDays(plan, cursor)) {
				if (!dayMatches(day, plan)) continue;
				for (let time of dailyTimes) candidates.push(day * DAY_MS + time * 1000);
			}
			if (plan.frequency === MONTHLY) cursor += plan.interval;
			else if (plan.frequency === WEEKLY) cursor += 7 * plan.interval;
			else cursor += plan.interval;
		}
		if (plan.bySetPosition) candidates = pickPositions(candidates, plan.bySetPosition);
		for (let candidate of candidates) {
			if (candidate > horizon) return "done";
			if (candidate > start) yield candidate;
		}
	}
	return "capped";
}

/**
 * Visits a rule's instances in order, `DTSTART` first: RFC 5545 counts it as the first
 * instance, which is why an `EXDATE` is how a rule's own start gets left out. `COUNT` and
 * `UNTIL` end the walk, and so does the visitor returning `false`.
 *
 * @param rule - The rule
 * @param start - The start's wall clock
 * @param options - Horizon, skip point, zone conversion and `UNTIL` instant
 * @param visit - Called with each instance's wall milliseconds and instant
 * @returns Nothing, or why the rule cannot be expanded
 */
export function expand(
	rule: ICalendar.RecurrenceRule,
	start: ICalendar.WallClock,
	options: ExpandOptions,
	visit: (wall: number, instant: number) => boolean,
): Result<void, RecurrenceRuleError> {
	let invalid = validateRecurrence(rule);
	if (invalid) return failure(invalid);
	let plan = createPlan(rule, start);
	let startWall = wallMs(start);
	let skipTo = rule.count === undefined ? (options.skipTo ?? null) : null;
	let emitted = 0;
	/** Emits one instance, reporting whether the walk goes on. */
	let emit = (wall: number): boolean => {
		let instant = options.toInstant(wall);
		if (options.until !== null && instant > options.until) return false;
		emitted++;
		if (!visit(wall, instant)) return false;
		return rule.count === undefined || emitted < rule.count;
	};
	if (!emit(startWall)) return success(undefined);
	let generator = wallClocks(plan, startWall, options.horizon, skipTo);
	for (let next = generator.next(); ; next = generator.next()) {
		if (next.done) {
			if (next.value === "done") return success(undefined);
			return failure(
				new RecurrenceRuleError(
					`expansion stopped after ${MAX_PERIODS} periods without reaching the window`,
				),
			);
		}
		if (!emit(next.value)) return success(undefined);
	}
}
