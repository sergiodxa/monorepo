/**
 * The English phrases `find` recognizes, each a pattern and the value it resolves to against
 * today: dates ("tomorrow", "next Friday", "Dec 3", "in 2 weeks"), times and ranges ("1pm",
 * "9:30–11"), durations ("for 45 minutes") and repeats ("every other Tuesday until March").
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RepeatRule, Weekday } from "./types.js";

import {
	addDays,
	addMonths,
	dayOf,
	daysIn,
	isRealDay,
	onOrAfter,
	partsOf,
	weekdayOf,
} from "./calendar.js";

/** Small numbers written as words, as "in two weeks" and "every three days" use them. */
const NUMBER_WORDS: Record<string, number> = {
	a: 1,
	an: 1,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
};

/** A count, as digits or a word. */
export const NUMBER = `(?:\\d+|${Object.keys(NUMBER_WORDS).join("|")})`;

/** A weekday's name, full or a common short form; "sat" and "sun" need their full names. */
export const WEEKDAY =
	"(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|saturday|sunday)";

/** A month's name, full or short. */
export const MONTH =
	"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** A clock time: an hour, optional minutes, and an optional am or pm. */
export const CLOCK = "(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?";

/** The weekdays in `Date#getUTCDay` order, as JSCalendar spells them. */
const WEEKDAY_CODES: Weekday[] = ["su", "mo", "tu", "we", "th", "fr", "sa"];

/** A count read from digits or a word. */
export function count(text: string): number {
	return NUMBER_WORDS[text.toLowerCase()] ?? Number(text);
}

/** A weekday name's index, `0` for Sunday. */
export function weekdayIndex(name: string): number {
	return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(name.slice(0, 3).toLowerCase());
}

/** A weekday name's JSCalendar code. */
export function weekdayCode(name: string): Weekday {
	return WEEKDAY_CODES[weekdayIndex(name)] ?? "mo";
}

/** A month name's number, `1` for January. */
export function monthIndex(name: string): number {
	return (
		["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
			name.slice(0, 3).toLowerCase(),
		) + 1
	);
}

/** An `HH:MM` time from minutes of the day. */
export function clock(minutes: number): string {
	let wrapped = ((minutes % 1440) + 1440) % 1440;
	return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/**
 * Minutes of the day for an hour, minutes and meridiem, or `null` for a time no clock shows.
 * Without a meridiem the hour reads on a 24-hour clock.
 */
export function minutesOf(
	hour: number,
	minute: number,
	meridiem: string | undefined,
): number | null {
	if (minute > 59) return null;
	let mer = meridiem?.replaceAll(".", "").toLowerCase();
	if (mer === "am" || mer === "pm") {
		if (hour < 1 || hour > 12) return null;
		let base = hour % 12;
		return (mer === "pm" ? base + 12 : base) * 60 + minute;
	}
	if (hour > 23) return null;
	return hour * 60 + minute;
}

/**
 * The hour a bare number after "at" means on a working day: 1 to 7 read as afternoon or
 * evening, 8 to 11 as morning, and 12 as noon, the way "lunch at 1" is meant.
 */
export function workingHour(hour: number): number {
	return hour >= 1 && hour <= 7 ? hour + 12 : hour;
}

/** The first month day on or after today, rolling into next year when it has passed. */
function upcoming(today: string, month: number, day: number): string | null {
	let { year } = partsOf(today);
	for (let candidate of [year, year + 1]) {
		if (!isRealDay(candidate, month, day)) continue;
		let date = dayOf(candidate, month, day);
		if (date >= today) return date;
	}
	return isRealDay(year + 1, month, day) ? dayOf(year + 1, month, day) : null;
}

/** A day with its year written out, or `null` when it does not exist. */
function exact(year: number, month: number, day: number): string | null {
	return isRealDay(year, month, day) ? dayOf(year, month, day) : null;
}

/** A pattern for one kind of date phrase, and what a match of it resolves to. */
interface DatePattern {
	/** The regular expression source, without flags. */
	source: string;
	/** The day or days the match names, against today; `null` when it names no real day. */
	resolve(match: RegExpExecArray, today: string): { start: string; end?: string } | null;
}

/**
 * Every date phrase, most specific first, so "next Friday" is read whole before "Friday" and a
 * month day range before a single day.
 */
export const DATE_PATTERNS: DatePattern[] = [
	{
		source: "(\\d{4})-(\\d{2})-(\\d{2})",
		resolve(match) {
			let [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
			return isRealDay(year, month, day) ? { start: dayOf(year, month, day) } : null;
		},
	},
	{
		source: `(?:on\\s+)?(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|—|to|through|thru)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?(?:,?\\s+(\\d{4}))?`,
		resolve(match, today) {
			let month = monthIndex(match[1] ?? "");
			let day = Number(match[2]);
			let year = match[4] === undefined ? null : Number(match[4]);
			let start = year === null ? upcoming(today, month, day) : exact(year, month, day);
			if (start === null) return null;
			if (match[3] === undefined) return { start };
			let last = Number(match[3]);
			let { year: startYear } = partsOf(start);
			if (last < day || !isRealDay(startYear, month, last)) return null;
			return { start, end: dayOf(startYear, month, last) };
		},
	},
	{
		source: `(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH})(?:,?\\s+(\\d{4}))?`,
		resolve(match, today) {
			let day = Number(match[1]);
			let month = monthIndex(match[2] ?? "");
			if (match[3] !== undefined) {
				let year = Number(match[3]);
				return isRealDay(year, month, day) ? { start: dayOf(year, month, day) } : null;
			}
			let start = upcoming(today, month, day);
			return start === null ? null : { start };
		},
	},
	{
		source: "(?:on\\s+)?(?:the\\s+)?day\\s+after\\s+tomorrow",
		resolve: (_match, today) => ({ start: addDays(today, 2) }),
	},
	{
		source: "(?:on\\s+)?(today|tonight|tomorrow|tmrw|yesterday)",
		resolve(match, today) {
			let word = (match[1] ?? "").toLowerCase();
			if (word === "tomorrow" || word === "tmrw") return { start: addDays(today, 1) };
			if (word === "yesterday") return { start: addDays(today, -1) };
			return { start: today };
		},
	},
	{
		source: `in\\s+(${NUMBER})\\s+(days?|weeks?|months?|years?)`,
		resolve(match, today) {
			let amount = count(match[1] ?? "1");
			let unit = (match[2] ?? "day").toLowerCase();
			if (unit.startsWith("day")) return { start: addDays(today, amount) };
			if (unit.startsWith("week")) return { start: addDays(today, amount * 7) };
			if (unit.startsWith("month")) return { start: addMonths(today, amount) };
			return { start: addMonths(today, amount * 12) };
		},
	},
	{
		source: "next\\s+(week|month|year)",
		resolve(match, today) {
			let unit = (match[1] ?? "week").toLowerCase();
			if (unit === "week") return { start: onOrAfter(addDays(today, 1), 1) };
			let { year, month } = partsOf(today);
			if (unit === "month") return { start: addMonths(dayOf(year, month, 1), 1) };
			return { start: dayOf(year + 1, 1, 1) };
		},
	},
	{
		source: `(?:on\\s+)?(?:(this|next|coming)\\s+)?(${WEEKDAY})`,
		resolve(match, today) {
			let weekday = weekdayIndex(match[2] ?? "");
			let next = (match[1] ?? "").toLowerCase() === "next";
			return { start: onOrAfter(next ? addDays(today, 1) : today, weekday) };
		},
	},
];

/** A month named alone, as "until March" ends a repeat with that month's last day. */
export const MONTH_ALONE = `(${MONTH})(?:\\s+(\\d{4}))?`;

/** The last day of the next month named on or after today, for "until March". */
export function endOfMonthNamed(today: string, name: string, year: string | undefined): string {
	let month = monthIndex(name);
	let { year: thisYear, month: thisMonth } = partsOf(today);
	let target = Number(year ?? (month >= thisMonth ? thisYear : thisYear + 1));
	return dayOf(target, month, daysIn(target, month));
}

/** The repeat a phrase's core names: its frequency, interval and weekdays. */
export function repeatOf(
	word: string,
	other: boolean,
	amount: string | undefined,
): RepeatRule | null {
	let interval = (other ? 2 : 1) * (amount === undefined ? 1 : count(amount));
	let lower = word.toLowerCase();
	let withInterval = (rule: RepeatRule): RepeatRule =>
		interval > 1 ? { ...rule, interval } : rule;
	if (lower === "daily" || lower.startsWith("day")) return withInterval({ frequency: "daily" });
	if (lower.startsWith("weekday"))
		return withInterval({
			frequency: "weekly",
			byDay: (["mo", "tu", "we", "th", "fr"] as const).map((day) => ({ day })),
		});
	if (lower.startsWith("weekend"))
		return withInterval({ frequency: "weekly", byDay: [{ day: "sa" }, { day: "su" }] });
	if (lower === "weekly" || lower.startsWith("week")) return withInterval({ frequency: "weekly" });
	if (lower === "biweekly" || lower === "fortnightly") return { frequency: "weekly", interval: 2 };
	if (lower === "monthly" || lower.startsWith("month"))
		return withInterval({ frequency: "monthly" });
	if (lower === "yearly" || lower === "annually" || lower.startsWith("year"))
		return withInterval({ frequency: "yearly" });
	let days = lower
		.split(/,|&|\band\b/)
		.map((part) => part.trim())
		.filter((part) => part !== "");
	if (days.length === 0 || days.some((day) => weekdayIndex(day) === -1)) return null;
	let codes = [...new Set(days.map(weekdayCode))];
	return withInterval({ frequency: "weekly", byDay: codes.map((day) => ({ day })) });
}

/** The first day on or after today that a repeat falls on, for "every Tuesday" with no date. */
export function firstOccurrence(today: string, rule: RepeatRule): string {
	if (!rule.byDay || rule.byDay.length === 0) return today;
	let wanted = new Set(rule.byDay.map((entry) => WEEKDAY_CODES.indexOf(entry.day)));
	for (let offset = 0; offset < 7; offset += 1) {
		let date = addDays(today, offset);
		if (wanted.has(weekdayOf(date))) return date;
	}
	return today;
}
