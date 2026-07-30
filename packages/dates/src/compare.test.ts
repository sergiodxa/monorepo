/**
 * Tests for the calendar comparisons: that day counting follows midnights rather
 * than 24-hour spans, that the same pair of instants can be one day in one zone and
 * two in another, and that enumeration covers both ends of an interval.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { diffInDays, eachDayOfInterval, isSameDay } from "./compare";

/** Zone whose offset puts late-UTC instants on the previous calendar day. */
const NEW_YORK = "America/New_York";

describe("diffInDays", () => {
	test("counts midnights, not elapsed 24-hour spans", () => {
		let late = new Date("2026-07-29T23:00:00Z");
		let early = new Date("2026-07-30T01:00:00Z");
		expect(diffInDays(early, late, "UTC")).toBe(1);
		expect(diffInDays(late, early, "UTC")).toBe(-1);
	});

	test("is zero for two instants on the same day", () => {
		expect(
			diffInDays(new Date("2026-07-29T23:00:00Z"), new Date("2026-07-29T00:00:00Z"), "UTC"),
		).toBe(0);
	});

	test("answers per zone", () => {
		let a = new Date("2026-07-29T02:00:00Z");
		let b = new Date("2026-07-29T20:00:00Z");
		expect(diffInDays(b, a, "UTC")).toBe(0);
		expect(diffInDays(b, a, NEW_YORK)).toBe(1);
	});

	test("counts a whole year of days", () => {
		expect(
			diffInDays(new Date("2027-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"), "UTC"),
		).toBe(365);
	});
});

describe("isSameDay", () => {
	test("compares the calendar day rather than the instant", () => {
		expect(
			isSameDay(new Date("2026-07-29T00:00:00Z"), new Date("2026-07-29T23:59:59Z"), "UTC"),
		).toBe(true);
		expect(
			isSameDay(new Date("2026-07-29T23:59:59Z"), new Date("2026-07-30T00:00:00Z"), "UTC"),
		).toBe(false);
	});

	test("gives opposite answers in two zones for the same pair", () => {
		let a = new Date("2026-07-29T02:00:00Z");
		let b = new Date("2026-07-29T20:00:00Z");
		expect(isSameDay(a, b, "UTC")).toBe(true);
		expect(isSameDay(a, b, NEW_YORK)).toBe(false);
	});

	test("is reflexive and symmetric", () => {
		let a = new Date("2026-07-29T02:00:00Z");
		let b = new Date("2026-07-29T04:00:00Z");
		expect(isSameDay(a, a, NEW_YORK)).toBe(true);
		expect(isSameDay(a, b, "UTC")).toBe(isSameDay(b, a, "UTC"));
	});
});

describe("eachDayOfInterval", () => {
	test("includes the days both ends fall on", () => {
		let days = eachDayOfInterval(
			{ start: new Date("2026-07-27T23:00:00Z"), end: new Date("2026-07-29T01:00:00Z") },
			"UTC",
		);
		expect(days.map((day) => day.toISOString())).toEqual([
			"2026-07-27T00:00:00.000Z",
			"2026-07-28T00:00:00.000Z",
			"2026-07-29T00:00:00.000Z",
		]);
	});

	test("returns a single day when both ends fall on it", () => {
		let days = eachDayOfInterval(
			{ start: new Date("2026-07-29T01:00:00Z"), end: new Date("2026-07-29T23:00:00Z") },
			"UTC",
		);
		expect(days).toHaveLength(1);
	});

	test("returns each day at its start in the zone asked for", () => {
		let days = eachDayOfInterval(
			{ start: new Date("2026-07-28T12:00:00Z"), end: new Date("2026-07-29T12:00:00Z") },
			NEW_YORK,
		);
		expect(days.map((day) => day.toISOString())).toEqual([
			"2026-07-28T04:00:00.000Z",
			"2026-07-29T04:00:00.000Z",
		]);
	});

	test("returns nothing when the range ends before it starts", () => {
		expect(
			eachDayOfInterval(
				{ start: new Date("2026-07-29T00:00:00Z"), end: new Date("2026-07-28T00:00:00Z") },
				"UTC",
			),
		).toEqual([]);
	});

	test("covers a full year without gaps or repeats", () => {
		let days = eachDayOfInterval(
			{ start: new Date("2026-01-01T12:00:00Z"), end: new Date("2026-12-31T12:00:00Z") },
			NEW_YORK,
		);
		expect(days).toHaveLength(365);
		expect(new Set(days.map((day) => day.getTime())).size).toBe(365);
	});
});
