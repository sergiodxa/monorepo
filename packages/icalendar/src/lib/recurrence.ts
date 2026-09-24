/**
 * The RECUR value type of RFC 5545 §3.3.10, read into a typed rule and written back with
 * its parts in a fixed order. Reading is strict: an unknown or repeated part, an
 * out-of-range number or `COUNT` beside `UNTIL` fails, and the calendar reader keeps such
 * an `RRULE` verbatim instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { ICalendar } from "../types.js";

import { RecurrenceRuleError } from "./errors.js";
import { formatDateValue, parseDateValue } from "./values.js";

/** Every `FREQ` value, coarsest first; the index orders frequencies. */
export const FREQUENCIES = [
	"YEARLY",
	"MONTHLY",
	"WEEKLY",
	"DAILY",
	"HOURLY",
	"MINUTELY",
	"SECONDLY",
] as const satisfies readonly ICalendar.RecurrenceRule["frequency"][];

/** Weekdays indexed like `Date#getUTCDay`, Sunday first. */
export const WEEKDAYS = [
	"SU",
	"MO",
	"TU",
	"WE",
	"TH",
	"FR",
	"SA",
] as const satisfies readonly ICalendar.Weekday[];

/** The numeric `BYxxx` parts, their field on the rule, and the magnitudes each accepts. */
const NUMERIC_PARTS = {
	BYSECOND: { field: "bySecond", min: 0, max: 60, signed: false },
	BYMINUTE: { field: "byMinute", min: 0, max: 59, signed: false },
	BYHOUR: { field: "byHour", min: 0, max: 23, signed: false },
	BYMONTHDAY: { field: "byMonthDay", min: 1, max: 31, signed: true },
	BYYEARDAY: { field: "byYearDay", min: 1, max: 366, signed: true },
	BYWEEKNO: { field: "byWeekNumber", min: 1, max: 53, signed: true },
	BYMONTH: { field: "byMonth", min: 1, max: 12, signed: false },
	BYSETPOS: { field: "bySetPosition", min: 1, max: 366, signed: true },
} as const;

/** The name of a numeric `BYxxx` part. */
type NumericPart = keyof typeof NUMERIC_PARTS;

/**
 * Whether a number is valid for a numeric part: an integer whose magnitude is in range,
 * negative only where the part counts from the end.
 *
 * @param part - The part's name
 * @param value - The number to check
 * @returns `true` when the value is allowed
 */
function inRange(part: NumericPart, value: number): boolean {
	let { min, max, signed } = NUMERIC_PARTS[part];
	if (!Number.isInteger(value)) return false;
	if (value < 0 && !signed) return false;
	let magnitude = Math.abs(value);
	return magnitude >= min && magnitude <= max;
}

/**
 * Reads a comma list of signed integers.
 *
 * @param text - The written list
 * @returns The numbers, or `null` when any item is not an integer
 */
function parseIntegers(text: string): number[] | null {
	let items = text.split(",");
	if (!items.every((item) => /^[+-]?\d+$/.test(item))) return null;
	return items.map(Number);
}

/**
 * Whether a string is one of the seven weekday codes.
 *
 * @param text - Upper-cased text
 * @returns `true` for `SU` through `SA`
 */
function isWeekday(text: string): text is ICalendar.Weekday {
	return (WEEKDAYS as readonly string[]).includes(text);
}

/**
 * Reads a BYDAY list: each item a weekday code with an optional signed ordinal.
 *
 * @param text - The written list
 * @returns The entries, or `null` when an item is malformed
 */
function parseByDay(text: string): NonNullable<ICalendar.RecurrenceRule["byDay"]> | null {
	let entries: NonNullable<ICalendar.RecurrenceRule["byDay"]> = [];
	for (let item of text.split(",")) {
		let match = /^([+-]?\d{1,2})?([A-Z]{2})$/.exec(item);
		if (!match || !isWeekday(match[2] ?? "")) return null;
		let weekday = match[2] as ICalendar.Weekday;
		if (match[1] === undefined) {
			entries.push({ weekday });
			continue;
		}
		let ordinal = Number(match[1]);
		if (ordinal === 0 || Math.abs(ordinal) > 53) return null;
		entries.push({ weekday, ordinal });
	}
	return entries;
}

/**
 * Reads an `RRULE` value. Part names and values are case-insensitive and a trailing `;` is
 * tolerated; everything else the grammar does not allow is a failure.
 *
 * @param value - The value after `RRULE:`
 * @returns The rule, or why it is not one
 */
export function parseRecurrence(
	value: string,
): Result<ICalendar.RecurrenceRule, RecurrenceRuleError> {
	let rule: Partial<ICalendar.RecurrenceRule> = {};
	let seen = new Set<string>();
	for (let part of value.split(";")) {
		if (part === "") continue;
		let equals = part.indexOf("=");
		if (equals === -1) return failure(new RecurrenceRuleError(`"${part}" has no "="`));
		let name = part.slice(0, equals).toUpperCase();
		let text = part.slice(equals + 1).toUpperCase();
		if (seen.has(name)) return failure(new RecurrenceRuleError(`${name} appears twice`));
		seen.add(name);
		if (name === "FREQ") {
			let frequency = FREQUENCIES.find((candidate) => candidate === text);
			if (!frequency) return failure(new RecurrenceRuleError(`FREQ=${text} is not a frequency`));
			rule.frequency = frequency;
		} else if (name === "INTERVAL" || name === "COUNT") {
			if (!/^\d+$/.test(text) || Number(text) < 1) {
				return failure(new RecurrenceRuleError(`${name} must be a positive integer`));
			}
			if (name === "INTERVAL") rule.interval = Number(text);
			else rule.count = Number(text);
		} else if (name === "UNTIL") {
			let until = parseDateValue(text, {});
			if (!until)
				return failure(new RecurrenceRuleError(`UNTIL=${text} is not a date or date-time`));
			rule.until = until;
		} else if (name === "WKST") {
			if (!isWeekday(text))
				return failure(new RecurrenceRuleError(`WKST=${text} is not a weekday`));
			rule.weekStart = text;
		} else if (name === "BYDAY") {
			let byDay = parseByDay(text);
			if (!byDay) return failure(new RecurrenceRuleError(`BYDAY=${text} is malformed`));
			rule.byDay = byDay;
		} else if (name in NUMERIC_PARTS) {
			let numbers = parseIntegers(text);
			let numeric = name as NumericPart;
			if (!numbers || !numbers.every((number) => inRange(numeric, number))) {
				return failure(new RecurrenceRuleError(`${name}=${text} is out of range`));
			}
			rule[NUMERIC_PARTS[numeric].field] = numbers;
		} else return failure(new RecurrenceRuleError(`${name} is not a recurrence rule part`));
	}
	if (!rule.frequency) return failure(new RecurrenceRuleError("FREQ is required"));
	if (rule.count !== undefined && rule.until !== undefined) {
		return failure(new RecurrenceRuleError("COUNT and UNTIL are mutually exclusive"));
	}
	return success({ ...rule, frequency: rule.frequency });
}

/**
 * Checks a typed rule the way `parseRecurrence` checks a written one, for rules built in
 * code: a positive integer `INTERVAL` and `COUNT`, in-range `BYxxx` numbers and ordinals,
 * and never both `COUNT` and `UNTIL`.
 *
 * @param rule - The rule to check
 * @returns Why the rule is invalid, or `null` when it is valid
 */
export function validateRecurrence(rule: ICalendar.RecurrenceRule): RecurrenceRuleError | null {
	if (!FREQUENCIES.includes(rule.frequency)) {
		return new RecurrenceRuleError(`${rule.frequency} is not a frequency`);
	}
	for (let [name, value] of [
		["INTERVAL", rule.interval],
		["COUNT", rule.count],
	] as const) {
		if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
			return new RecurrenceRuleError(`${name} must be a positive integer`);
		}
	}
	if (rule.count !== undefined && rule.until !== undefined) {
		return new RecurrenceRuleError("COUNT and UNTIL are mutually exclusive");
	}
	for (let [part, { field }] of Object.entries(NUMERIC_PARTS)) {
		let values = rule[field];
		if (values && !values.every((value) => inRange(part as NumericPart, value))) {
			return new RecurrenceRuleError(`${part} holds a value out of range`);
		}
	}
	if (rule.weekStart !== undefined && !isWeekday(rule.weekStart)) {
		return new RecurrenceRuleError(`WKST=${String(rule.weekStart)} is not a weekday`);
	}
	for (let entry of rule.byDay ?? []) {
		let { ordinal } = entry;
		if (!isWeekday(entry.weekday))
			return new RecurrenceRuleError(`${String(entry.weekday)} is not a weekday`);
		if (
			ordinal !== undefined &&
			(!Number.isInteger(ordinal) || ordinal === 0 || Math.abs(ordinal) > 53)
		) {
			return new RecurrenceRuleError(`BYDAY ordinal ${ordinal} is out of range`);
		}
	}
	return null;
}

/**
 * Writes a rule's parts in a fixed order: `FREQ`, `INTERVAL`, `COUNT` or `UNTIL`, the
 * `BYxxx` parts from seconds to set positions, then `WKST`. Empty lists are left out.
 *
 * @param rule - The rule to write
 * @returns The `RRULE` value
 */
export function stringifyRecurrence(rule: ICalendar.RecurrenceRule): string {
	let parts = [`FREQ=${rule.frequency}`];
	if (rule.interval !== undefined) parts.push(`INTERVAL=${rule.interval}`);
	if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
	else if (rule.until) parts.push(`UNTIL=${formatDateValue(rule.until).value}`);
	let lists: [string, number[] | undefined][] = [
		["BYSECOND", rule.bySecond],
		["BYMINUTE", rule.byMinute],
		["BYHOUR", rule.byHour],
	];
	for (let [name, values] of lists) if (values?.length) parts.push(`${name}=${values.join(",")}`);
	if (rule.byDay?.length) {
		let days = rule.byDay.map((entry) => `${entry.ordinal ?? ""}${entry.weekday}`);
		parts.push(`BYDAY=${days.join(",")}`);
	}
	lists = [
		["BYMONTHDAY", rule.byMonthDay],
		["BYYEARDAY", rule.byYearDay],
		["BYWEEKNO", rule.byWeekNumber],
		["BYMONTH", rule.byMonth],
		["BYSETPOS", rule.bySetPosition],
	];
	for (let [name, values] of lists) if (values?.length) parts.push(`${name}=${values.join(",")}`);
	if (rule.weekStart) parts.push(`WKST=${rule.weekStart}`);
	return parts.join(";");
}
