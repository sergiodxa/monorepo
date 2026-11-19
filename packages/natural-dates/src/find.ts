/**
 * Finds the date, time, duration and repeat phrases in a piece of English text and adds them up
 * to what an event would read from them. Longer phrases are matched first and no two matches
 * overlap, so "every other Tuesday until March" is one repeat, not a weekday and a month.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isValidTimeZone } from "@sdxc/dates";
import { failure, success } from "@sdxc/result";

import type { FindOptions, Found, Match, MatchValue } from "./types.js";

import { addDays, todayIn } from "./calendar.js";
import { NaturalDatesError } from "./natural-dates-error.js";
import {
	CLOCK,
	DATE_PATTERNS,
	MONTH_ALONE,
	NUMBER,
	WEEKDAY,
	clock,
	count,
	endOfMonthNamed,
	firstOccurrence,
	minutesOf,
	repeatOf,
	workingHour,
} from "./phrases.js";

/** What a phrase pattern found before it is placed: where, and what it means. */
interface Candidate {
	index: number;
	end: number;
	value: MatchValue;
}

/** The repeat phrase's core: "every other Tuesday and Thursday", "every 3 weeks", "daily". */
const REPEAT = new RegExp(
	`\\b(?:(?:every|each)\\s+(other\\s+)?(?:(${NUMBER})\\s+)?(days?|weekdays?|weekends?|weeks?|months?|years?|${WEEKDAY}s?(?:\\s*(?:,\\s*and|,|and|&)\\s*${WEEKDAY}s?)*)|(daily|weekly|biweekly|fortnightly|monthly|yearly|annually))\\b`,
	"gi",
);

/** What may follow a repeat: an end date, a month, or a number of times. */
const UNTIL = /\s+(?:until|till|through)\s+/iy;
const TIMES = new RegExp(`\\s+(?:for\\s+)?(${NUMBER})\\s+times\\b`, "iy");

/** "all day", "all-day". */
const ALL_DAY = /\ball[\s-]day\b/gi;

/** A time range: "9:30–11", "1pm to 3pm", "from 2 to 4pm", "between 1 and 2pm". */
const RANGE = new RegExp(
	`\\b(from\\s+|between\\s+)?${CLOCK}\\s*(?:-|–|—|to|until|till|and)\\s*${CLOCK}(?![\\w:])`,
	"gi",
);

/** A duration: "for 45 minutes", "for an hour", "for 1.5 hours", "for 1 hour 30 minutes". */
const DURATION = new RegExp(
	`\\bfor\\s+(half\\s+an\\s+hour|(${NUMBER}|\\d+\\.\\d+)\\s*(minutes?|mins?|m|hours?|hrs?|hr|h|days?|d)(?:\\s*(?:and\\s+)?(\\d+)\\s*(minutes?|mins?|m))?)\\b`,
	"gi",
);

/** A time with am or pm, or on a 24-hour clock with minutes: "1pm", "9:30 am", "13:00". */
const TIME =
	/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\W|$)|\b(?:at\s+)?(\d{1,2}):(\d{2})\b/gi;

/** A bare hour after "at": "at 3", read as a working-day hour. */
const AT_HOUR = /\bat\s+(\d{1,2})\b(?!\s*(?::|am|pm|a\.m|p\.m|%|days?|weeks?))/gi;

/** A named time of day. */
const PART_OF_DAY =
	/\b(?:at\s+|in\s+the\s+|this\s+)?(noon|midday|midnight|morning|afternoon|evening|eod|end\s+of\s+day)\b/gi;

/** The minute of the day each named time stands for. */
const PARTS_OF_DAY: Record<string, number> = {
	noon: 720,
	midday: 720,
	midnight: 0,
	morning: 540,
	afternoon: 840,
	evening: 1080,
	eod: 1020,
	"end of day": 1020,
};

/** What "tonight" starts at when no time is given. */
const TONIGHT = 1200;

/** Reads one date phrase starting exactly at `index`, for the date after "until". */
function dateAt(text: string, index: number, today: string): { date: string; end: number } | null {
	for (let pattern of DATE_PATTERNS) {
		let regex = new RegExp(pattern.source, "iy");
		regex.lastIndex = index;
		let match = regex.exec(text);
		if (!match || /\w/.test(text[regex.lastIndex] ?? "")) continue;
		let resolved = pattern.resolve(match, today);
		if (resolved) return { date: resolved.end ?? resolved.start, end: regex.lastIndex };
	}
	let month = new RegExp(MONTH_ALONE, "iy");
	month.lastIndex = index;
	let match = month.exec(text);
	if (match)
		return { date: endOfMonthNamed(today, match[1] ?? "", match[2]), end: month.lastIndex };
	return null;
}

/** Repeat phrases, with an "until …" or "N times" tail when one follows. */
function repeats(text: string, today: string): Candidate[] {
	let found: Candidate[] = [];
	for (let match of text.matchAll(REPEAT)) {
		let word = match[3] ?? match[4] ?? "";
		let rule = repeatOf(word, match[1] !== undefined, match[2]);
		if (!rule) continue;
		let index = match.index;
		let end = index + match[0].length;
		UNTIL.lastIndex = end;
		if (UNTIL.exec(text)) {
			let until = dateAt(text, UNTIL.lastIndex, today);
			if (until) {
				rule = { ...rule, until: `${until.date}T23:59:59` };
				end = until.end;
			}
		}
		TIMES.lastIndex = end;
		let times = TIMES.exec(text);
		if (times) {
			rule = { ...rule, count: count(times[1] ?? "1") };
			end = TIMES.lastIndex;
		}
		found.push({ index, end, value: { kind: "repeat", rule } });
	}
	return found;
}

/** Date phrases, and spans of two dates joined by "to" or a dash. */
function dates(text: string, today: string): Candidate[] {
	let found: Candidate[] = [];
	for (let pattern of DATE_PATTERNS) {
		for (let match of text.matchAll(new RegExp(`\\b${pattern.source}\\b`, "gi"))) {
			let resolved = pattern.resolve(match, today);
			if (!resolved) continue;
			let value: MatchValue = resolved.end
				? { kind: "dateRange", from: resolved.start, to: resolved.end }
				: { kind: "date", date: resolved.start };
			found.push({ index: match.index, end: match.index + match[0].length, value });
		}
	}
	return found;
}

/** Minutes of a range's two ends, sharing a meridiem written once ("9-10am", "11 to 1pm"). */
function rangeMinutes(match: RegExpExecArray): { start: number; end: number } | null {
	let [, prefix, h1, m1, mer1, h2, m2, mer2] = match;
	let hasColon = m1 !== undefined || m2 !== undefined;
	if (!mer1 && !mer2 && !hasColon && !prefix) return null;
	let start = Number(h1);
	let end = Number(h2);
	let startMinute = Number(m1 ?? 0);
	let endMinute = Number(m2 ?? 0);
	let endValue = minutesOf(end, endMinute, mer2);
	if (mer2 && !mer1) {
		let same = minutesOf(start, startMinute, mer2);
		let other = minutesOf(start, startMinute, mer2.toLowerCase().startsWith("p") ? "am" : "pm");
		let startValue = same !== null && endValue !== null && same < endValue ? same : other;
		return startValue === null || endValue === null ? null : { start: startValue, end: endValue };
	}
	if (mer1 && !mer2) {
		let startValue = minutesOf(start, startMinute, mer1);
		let same = minutesOf(end, endMinute, mer1);
		let other = minutesOf(end, endMinute, mer1.toLowerCase().startsWith("p") ? "am" : "pm");
		let endPicked = same !== null && startValue !== null && same > startValue ? same : other;
		return startValue === null || endPicked === null ? null : { start: startValue, end: endPicked };
	}
	if (mer1 && mer2) {
		let startValue = minutesOf(start, startMinute, mer1);
		return startValue === null || endValue === null ? null : { start: startValue, end: endValue };
	}
	let startHour = hasColon ? start : workingHour(start);
	let endHour = hasColon ? end : workingHour(end);
	let startValue = minutesOf(startHour, startMinute, undefined);
	let finish = minutesOf(endHour, endMinute, undefined);
	return startValue === null || finish === null ? null : { start: startValue, end: finish };
}

/** Time ranges. */
function ranges(text: string): Candidate[] {
	let found: Candidate[] = [];
	for (let match of text.matchAll(RANGE)) {
		let minutes = rangeMinutes(match);
		if (!minutes) continue;
		found.push({
			index: match.index,
			end: match.index + match[0].length,
			value: { kind: "timeRange", from: clock(minutes.start), to: clock(minutes.end) },
		});
	}
	return found;
}

/** Minutes in one of a duration's units: a day, an hour or a minute. */
function unitMinutes(unit: string): number {
	if (unit.startsWith("d")) return 1440;
	if (unit.startsWith("h")) return 60;
	return 1;
}

/** Durations, in minutes. */
function durations(text: string): Candidate[] {
	let found: Candidate[] = [];
	for (let match of text.matchAll(DURATION)) {
		let minutes: number;
		if ((match[1] ?? "").toLowerCase().startsWith("half")) {
			minutes = 30;
		} else {
			let amount = /\./.test(match[2] ?? "") ? Number(match[2]) : count(match[2] ?? "1");
			let unit = (match[3] ?? "m").toLowerCase();
			minutes = Math.round(amount * unitMinutes(unit)) + Number(match[4] ?? 0);
		}
		if (minutes <= 0) continue;
		found.push({
			index: match.index,
			end: match.index + match[0].length,
			value: { kind: "duration", minutes },
		});
	}
	return found;
}

/**
 * Single times: clock times, bare hours after "at", and named times of day. A bare hour in a text
 * about the evening ("tonight at 9") reads as the evening's.
 */
function times(text: string): Candidate[] {
	let evening = /\b(?:tonight|evening)\b/i.test(text);
	let found: Candidate[] = [];
	for (let match of text.matchAll(TIME)) {
		let minutes =
			match[3] === undefined
				? minutesOf(Number(match[4]), Number(match[5]), undefined)
				: minutesOf(Number(match[1]), Number(match[2] ?? 0), match[3]);
		if (minutes === null) continue;
		found.push({
			index: match.index,
			end: match.index + match[0].length,
			value: { kind: "time", time: clock(minutes) },
		});
	}
	for (let match of text.matchAll(AT_HOUR)) {
		let hour = Number(match[1]);
		let minutes = minutesOf(evening && hour < 12 ? hour + 12 : workingHour(hour), 0, undefined);
		if (minutes === null) continue;
		found.push({
			index: match.index,
			end: match.index + match[0].length,
			value: { kind: "time", time: clock(minutes) },
		});
	}
	for (let match of text.matchAll(PART_OF_DAY)) {
		let minutes = PARTS_OF_DAY[(match[1] ?? "").toLowerCase().replace(/\s+/g, " ")];
		if (minutes === undefined) continue;
		found.push({
			index: match.index,
			end: match.index + match[0].length,
			value: { kind: "time", time: clock(minutes) },
		});
	}
	return found;
}

/** Keeps the candidates that overlap nothing already kept, in the order given. */
function place(candidates: Candidate[], taken: Candidate[]): Candidate[] {
	for (let candidate of candidates) {
		if (taken.some((kept) => candidate.index < kept.end && kept.index < candidate.end)) continue;
		taken.push(candidate);
	}
	return taken;
}

/** Joins two date matches separated only by "to", "through" or a dash into one span. */
function joinDates(text: string, matches: Match[]): Match[] {
	let joined: Match[] = [];
	for (let match of matches) {
		let last = joined.at(-1);
		let between = last ? text.slice(last.end, match.index) : "";
		if (
			last?.kind === "date" &&
			match.kind === "date" &&
			/^\s*(?:-|–|—|to|through|thru|until)\s*$/i.test(between) &&
			match.date >= last.date
		) {
			joined[joined.length - 1] = {
				kind: "dateRange",
				from: last.date,
				to: match.date,
				index: last.index,
				end: match.end,
				text: text.slice(last.index, match.end),
			};
			continue;
		}
		joined.push(match);
	}
	return joined;
}

/** Minutes of the day from an `HH:MM` time. */
function minutesFrom(time: string): number {
	return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** Adds the matches up to an event's date, times, length and repeat. */
function summarize(text: string, matches: Match[], today: string): Found {
	let found: Found = { matches, allDay: false };
	for (let match of matches) {
		if (match.kind === "date" && found.date === undefined) found.date = match.date;
		if (match.kind === "dateRange" && found.date === undefined) {
			found.date = match.from;
			found.endDate = match.to;
		}
		if (match.kind === "time" && found.start === undefined) found.start = match.time;
		if (match.kind === "timeRange" && found.start === undefined) {
			found.start = match.from;
			found.end = match.to;
		}
		if (match.kind === "duration" && found.duration === undefined) found.duration = match.minutes;
		if (match.kind === "allDay") found.allDay = true;
		if (match.kind === "repeat" && found.repeat === undefined) found.repeat = match.rule;
	}
	if (found.start === undefined && /\btonight\b/i.test(text)) found.start = clock(TONIGHT);
	if (found.start !== undefined && found.end !== undefined && found.duration === undefined) {
		let length = minutesFrom(found.end) - minutesFrom(found.start);
		found.duration = length > 0 ? length : length + 1440;
	}
	if (
		found.start !== undefined &&
		found.end === undefined &&
		found.duration !== undefined &&
		found.duration < 1440
	) {
		found.end = clock(minutesFrom(found.start) + found.duration);
	}
	if (found.start === undefined && found.duration !== undefined && found.duration >= 1440) {
		found.allDay = true;
		found.date ??= today;
		found.endDate ??= addDays(found.date, Math.ceil(found.duration / 1440) - 1);
	}
	if (found.allDay) {
		delete found.start;
		delete found.end;
	}
	if (found.repeat && found.date === undefined) found.date = firstOccurrence(today, found.repeat);
	return found;
}

/**
 * Finds every date, time, duration and repeat phrase in `text`, resolved against `now` on the
 * calendar of `timeZone`, and what they add up to. Text without any such phrase succeeds with
 * no matches; only an unknown zone or an invalid `now` fails.
 *
 * @param text English text, such as a quick-add line.
 * @param options The present and the zone the dates are on.
 * @returns The matches and their summary, or why the options could not be read.
 * @example find("Lunch with Ana tomorrow 1pm", { now: new Date(), timeZone: "Europe/Lisbon" })
 */
export function find(text: string, options: FindOptions): Result<Found, NaturalDatesError> {
	if (Number.isNaN(options.now.getTime()))
		return failure(new NaturalDatesError("now", "`now` is not a valid date."));
	if (!isValidTimeZone(options.timeZone))
		return failure(
			new NaturalDatesError(
				"timeZone",
				`${options.timeZone} is not a time zone this runtime knows.`,
			),
		);
	let today = todayIn(options.now, options.timeZone);
	let allDay = [...text.matchAll(ALL_DAY)].map((match) => ({
		index: match.index,
		end: match.index + match[0].length,
		value: { kind: "allDay" } as MatchValue,
	}));
	let taken: Candidate[] = [];
	place(repeats(text, today), taken);
	place(allDay, taken);
	place(ranges(text), taken);
	place(durations(text), taken);
	place(dates(text, today), taken);
	place(times(text), taken);
	let matches = taken
		.sort((a, b) => a.index - b.index)
		.map((candidate) => ({
			...candidate.value,
			index: candidate.index,
			end: candidate.end,
			text: text.slice(candidate.index, candidate.end),
		})) as Match[];
	return success(summarize(text, joinDates(text, matches), today));
}
