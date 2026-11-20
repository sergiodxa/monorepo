/**
 * Holds `find` to the phrases it promises to read, against Wednesday, November 18, 2026 at noon
 * in New York: dates, times and ranges, durations, all-day spans and repeats, each with the text
 * range it came from, and the summary they add up to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Found } from "./types.js";

import { find } from "./find.js";
import { NaturalDatesError } from "./natural-dates-error.js";

/** Noon on Wednesday, November 18, 2026, in New York. */
const NOW = new Date("2026-11-18T17:00:00Z");

/** Reads a text against the test's clock in New York. */
function read(text: string, timeZone = "America/New_York"): Found {
	return unwrap(find(text, { now: NOW, timeZone }));
}

describe("dates", () => {
	test.each([
		["today", "2026-11-18"],
		["tomorrow", "2026-11-19"],
		["the day after tomorrow", "2026-11-20"],
		["yesterday", "2026-11-17"],
		["Friday", "2026-11-20"],
		["on Wednesday", "2026-11-18"],
		["this Wednesday", "2026-11-18"],
		["next Wednesday", "2026-11-25"],
		["next Friday", "2026-11-20"],
		["Dec 3", "2026-12-03"],
		["December 3rd", "2026-12-03"],
		["the 5th of January", "2027-01-05"],
		["Nov 2", "2027-11-02"],
		["March 3, 2028", "2028-03-03"],
		["2027-02-14", "2027-02-14"],
		["in 2 weeks", "2026-12-02"],
		["in three days", "2026-11-21"],
		["in a month", "2026-12-18"],
		["next week", "2026-11-23"],
		["next month", "2026-12-01"],
	])("reads %s as %s", (text, date) => {
		expect(read(text).date).toBe(date);
	});

	test("refuses a day no calendar has, and a month name used as a word", () => {
		expect(read("Feb 30").date).toBeUndefined();
		expect(read("We may meet").matches).toEqual([]);
	});

	test("reads two dates joined by a dash or 'to' as one span", () => {
		let found = read("Offsite Dec 3-5");
		expect([found.date, found.endDate]).toEqual(["2026-12-03", "2026-12-05"]);
		let joined = read("Trip Dec 3 to Dec 7");
		expect([joined.date, joined.endDate]).toEqual(["2026-12-03", "2026-12-07"]);
		expect(joined.matches).toHaveLength(1);
	});

	test("counts today in the given zone", () => {
		let late = new Date("2026-11-19T03:00:00Z");
		expect(unwrap(find("tomorrow", { now: late, timeZone: "America/Los_Angeles" })).date).toBe(
			"2026-11-19",
		);
		expect(unwrap(find("tomorrow", { now: late, timeZone: "Asia/Tokyo" })).date).toBe("2026-11-20");
	});
});

describe("times", () => {
	test.each([
		["1pm", "13:00"],
		["at 9:30 am", "09:30"],
		["12am", "00:00"],
		["13:45", "13:45"],
		["at 3", "15:00"],
		["at 9", "09:00"],
		["noon", "12:00"],
		["in the morning", "09:00"],
	])("reads %s as %s", (text, start) => {
		expect(read(text).start).toBe(start);
	});

	test.each([
		["9:30–11", "09:30", "11:00", 90],
		["9-10am", "09:00", "10:00", 60],
		["11 to 1pm", "11:00", "13:00", 120],
		["1pm to 3:30pm", "13:00", "15:30", 150],
		["from 2 to 4", "14:00", "16:00", 120],
		["between 1 and 2pm", "13:00", "14:00", 60],
		["10pm-1am", "22:00", "01:00", 180],
	])("reads the range %s", (text, start, end, duration) => {
		let found = read(text);
		expect([found.start, found.end, found.duration]).toEqual([start, end, duration]);
	});

	test("leaves a bare number range alone, since it may not be a time", () => {
		expect(read("2-3 people").matches).toEqual([]);
	});

	test("starts tonight in the evening when no time is given", () => {
		expect([read("Dinner tonight").date, read("Dinner tonight").start]).toEqual([
			"2026-11-18",
			"20:00",
		]);
		expect(read("tonight at 9").start).toBe("21:00");
	});
});

describe("durations and all-day events", () => {
	test.each([
		["for 45 minutes", 45],
		["for an hour", 60],
		["for 1.5 hours", 90],
		["for 1 hour 30 minutes", 90],
		["for half an hour", 30],
		["for 2h", 120],
	])("reads %s as %i minutes", (text, minutes) => {
		expect(read(text).duration).toBe(minutes);
	});

	test("ends a timed event its duration after it starts", () => {
		let found = read("Standup at 9:30 for 15 minutes");
		expect([found.start, found.end, found.duration]).toEqual(["09:30", "09:45", 15]);
	});

	test("reads 'all day' and a length in days as all-day spans", () => {
		let found = read("Planning all day Friday");
		expect([found.allDay, found.date, found.start]).toEqual([true, "2026-11-20", undefined]);
		let trip = read("Conference Dec 3 for 3 days");
		expect([trip.allDay, trip.date, trip.endDate]).toEqual([true, "2026-12-03", "2026-12-05"]);
	});
});

describe("repeats", () => {
	test.each([
		["every day", { frequency: "daily" }],
		["daily", { frequency: "daily" }],
		["every 3 days", { frequency: "daily", interval: 3 }],
		["every week", { frequency: "weekly" }],
		["biweekly", { frequency: "weekly", interval: 2 }],
		["every month", { frequency: "monthly" }],
		["annually", { frequency: "yearly" }],
		[
			"every weekday",
			{ frequency: "weekly", byDay: ["mo", "tu", "we", "th", "fr"].map((day) => ({ day })) },
		],
		["every weekend", { frequency: "weekly", byDay: [{ day: "sa" }, { day: "su" }] }],
		["every Tuesday and Thursday", { frequency: "weekly", byDay: [{ day: "tu" }, { day: "th" }] }],
		["every other Tuesday", { frequency: "weekly", interval: 2, byDay: [{ day: "tu" }] }],
	])("reads %s", (text, rule) => {
		expect(read(text).repeat).toEqual(rule);
	});

	test("ends a repeat at a date, at the end of a named month, or after a number of times", () => {
		expect(read("every other Tuesday until March").repeat).toEqual({
			frequency: "weekly",
			interval: 2,
			byDay: [{ day: "tu" }],
			until: "2027-03-31T23:59:59",
		});
		expect(read("daily until Dec 4").repeat?.until).toBe("2026-12-04T23:59:59");
		expect(read("every week 6 times").repeat?.count).toBe(6);
	});

	test("reads a repeat followed by a long run of blanks in linear time", () => {
		let started = performance.now();
		expect(read(`every Tuesday${"\t".repeat(50_000)}x`).repeat?.byDay).toEqual([{ day: "tu" }]);
		expect(read(`every Tuesday,${"\t,".repeat(50_000)}`).repeat?.byDay).toEqual([{ day: "tu" }]);
		expect(performance.now() - started).toBeLessThan(1000);
	});

	test("starts a weekday repeat on its first day, and keeps a stated date", () => {
		expect(read("every Friday at 4pm").date).toBe("2026-11-20");
		expect(read("every weekday at 9:30").date).toBe("2026-11-18");
		expect(read("every week starting Dec 7").date).toBe("2026-12-07");
	});
});

describe("matches", () => {
	test("returns each phrase with the range it covers, in text order", () => {
		let text = "Lunch with Ana tomorrow 1pm for 45 minutes";
		let found = read(text);
		expect(found.matches.map((match) => [match.kind, match.text])).toEqual([
			["date", "tomorrow"],
			["time", "1pm"],
			["duration", "for 45 minutes"],
		]);
		for (let match of found.matches) expect(text.slice(match.index, match.end)).toBe(match.text);
		expect([found.date, found.start, found.end]).toEqual(["2026-11-19", "13:00", "13:45"]);
	});

	test("reads a repeat with its tail as one match, not a weekday and a month", () => {
		let found = read("Design sync every other Tuesday until March at 3pm");
		expect(found.matches.map((match) => match.kind)).toEqual(["repeat", "time"]);
	});

	test("reads a repeat on two weekdays with a time and a length", () => {
		let found = read("Yoga every Monday and Wednesday at 7am for an hour");
		expect(found.repeat).toEqual({ frequency: "weekly", byDay: [{ day: "mo" }, { day: "we" }] });
		expect([found.date, found.start, found.end, found.duration]).toEqual([
			"2026-11-18",
			"07:00",
			"08:00",
			60,
		]);
	});

	test("finds nothing in text without a date phrase", () => {
		expect(read("Buy milk")).toEqual({ matches: [], allDay: false });
	});
});

describe("options", () => {
	test("fails on a zone the runtime does not know, and on an invalid clock", () => {
		let zone = find("tomorrow", { now: NOW, timeZone: "Mars/Olympus" });
		expect(isFailure(zone) && zone.error).toBeInstanceOf(NaturalDatesError);
		expect(isFailure(zone) && zone.error.problem).toBe("timeZone");
		let clock = find("tomorrow", { now: new Date(Number.NaN), timeZone: "UTC" });
		expect(isFailure(clock) && clock.error.problem).toBe("now");
	});
});
