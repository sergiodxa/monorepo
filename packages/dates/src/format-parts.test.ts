/**
 * Tests for the composition escape hatch and the standalone weekday label: that parts
 * come back tagged and in the locale's order, and that the weekday index is the same
 * Sunday-based one `weekStartsOn` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Weekday } from "./types.js";

import { formatParts, formatWeekday } from "./format-parts.js";

/** The instant every case breaks down, mid-morning UTC on a Wednesday. */
const MORNING = new Date("2026-07-29T10:00:00Z");

describe("formatParts", () => {
	test("returns the requested fields tagged with what they are", () => {
		expect(
			formatParts(MORNING, { locale: "en-US", timeZone: "UTC", month: "long", day: "numeric" }),
		).toEqual([
			{ type: "month", value: "July" },
			{ type: "literal", value: " " },
			{ type: "day", value: "29" },
		]);
	});

	test("puts the fields in the locale's own order", () => {
		let types = formatParts(MORNING, {
			locale: "es-AR",
			timeZone: "UTC",
			month: "long",
			day: "numeric",
		}).map((part) => part.type);
		expect(types.at(0)).toBe("day");
		expect(types.at(-1)).toBe("month");
	});

	test("breaks the instant down in the zone asked for", () => {
		let lateUtc = new Date("2026-07-29T02:00:00Z");
		let day = (timeZone: string) =>
			formatParts(lateUtc, { locale: "en-US", timeZone, day: "numeric" }).at(0)?.value;
		expect(day("UTC")).toBe("29");
		expect(day("America/New_York")).toBe("28");
	});

	test("composes into a layout Intl would not produce on its own", () => {
		let parts = formatParts(MORNING, {
			locale: "en-US",
			timeZone: "UTC",
			weekday: "short",
			day: "2-digit",
		});
		let read = (type: string) => parts.find((part) => part.type === type)?.value;
		expect(`${read("day")}/${read("weekday")}`).toBe("29/Wed");
	});

	test("falls back to the platform's numeric date when no field is named", () => {
		expect(formatParts(MORNING, { locale: "en-US", timeZone: "UTC" })).toEqual(
			new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).formatToParts(MORNING),
		);
	});
});

describe("formatWeekday", () => {
	test("labels every weekday from a Sunday-based index", () => {
		let weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
		expect(weekdays.map((weekday) => formatWeekday(weekday, { locale: "en-US" }))).toEqual([
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat",
		]);
	});

	test("uses the requested length", () => {
		expect(formatWeekday(1, { locale: "en-US", style: "long" })).toBe("Monday");
		expect(formatWeekday(1, { locale: "en-US", style: "narrow" })).toBe("M");
	});

	test("takes the name from the locale", () => {
		expect(formatWeekday(0, { locale: "es-AR", style: "long" })).toBe("domingo");
	});

	test("needs no zone, because a weekday index has no instant", () => {
		expect(formatWeekday(3, { locale: "en-US" })).toBe("Wed");
	});
});
