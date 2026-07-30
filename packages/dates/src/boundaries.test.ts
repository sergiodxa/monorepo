/**
 * Tests for day and week boundaries: that they answer per zone, that a day always
 * ends one millisecond before the next one starts, and that the week start is the
 * caller's decision rather than the locale's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { endOfDay, startOfDay, startOfWeek } from "./boundaries";

/** An instant late enough in UTC that the previous day is still running west of it. */
const EVENING_UTC = new Date("2026-07-29T02:00:00Z");

describe("startOfDay", () => {
	test("opens the day the instant falls on in the zone asked for", () => {
		expect(startOfDay(EVENING_UTC, "UTC").toISOString()).toBe("2026-07-29T00:00:00.000Z");
		expect(startOfDay(EVENING_UTC, "America/New_York").toISOString()).toBe(
			"2026-07-28T04:00:00.000Z",
		);
		expect(startOfDay(EVENING_UTC, "Asia/Tokyo").toISOString()).toBe("2026-07-28T15:00:00.000Z");
	});

	test("handles zones whose offset is not a whole hour", () => {
		expect(startOfDay(new Date("2026-07-29T12:00:00Z"), "Asia/Kolkata").toISOString()).toBe(
			"2026-07-28T18:30:00.000Z",
		);
	});

	test("is idempotent", () => {
		let first = startOfDay(EVENING_UTC, "America/New_York");
		expect(startOfDay(first, "America/New_York").getTime()).toBe(first.getTime());
	});

	test("does not mutate its argument", () => {
		let date = new Date("2026-07-29T02:00:00Z");
		startOfDay(date, "America/New_York");
		expect(date.toISOString()).toBe("2026-07-29T02:00:00.000Z");
	});
});

describe("endOfDay", () => {
	test("closes the day at its last millisecond in the zone asked for", () => {
		expect(endOfDay(EVENING_UTC, "UTC").toISOString()).toBe("2026-07-29T23:59:59.999Z");
		expect(endOfDay(EVENING_UTC, "America/New_York").toISOString()).toBe(
			"2026-07-29T03:59:59.999Z",
		);
	});

	test("ends exactly one millisecond before the next day starts", () => {
		let end = endOfDay(EVENING_UTC, "Asia/Kolkata");
		let nextStart = startOfDay(new Date(end.getTime() + 1), "Asia/Kolkata");
		expect(nextStart.getTime()).toBe(end.getTime() + 1);
	});

	test("spans 24 hours on an ordinary day", () => {
		let start = startOfDay(EVENING_UTC, "America/New_York");
		let end = endOfDay(EVENING_UTC, "America/New_York");
		expect(end.getTime() - start.getTime() + 1).toBe(86_400_000);
	});
});

describe("startOfWeek", () => {
	test("opens the week on the weekday the caller asked for", () => {
		// 2026-07-29 is a Wednesday.
		let wednesday = new Date("2026-07-29T12:00:00Z");
		expect(startOfWeek(wednesday, "UTC", { weekStartsOn: 0 }).toISOString()).toBe(
			"2026-07-26T00:00:00.000Z",
		);
		expect(startOfWeek(wednesday, "UTC", { weekStartsOn: 1 }).toISOString()).toBe(
			"2026-07-27T00:00:00.000Z",
		);
		expect(startOfWeek(wednesday, "UTC", { weekStartsOn: 3 }).toISOString()).toBe(
			"2026-07-29T00:00:00.000Z",
		);
	});

	test("stays on the same day when the instant is already the week start", () => {
		let sunday = new Date("2026-07-26T12:00:00Z");
		expect(startOfWeek(sunday, "UTC", { weekStartsOn: 0 }).toISOString()).toBe(
			"2026-07-26T00:00:00.000Z",
		);
	});

	test("resolves the week in the zone asked for", () => {
		// Sunday 00:30 UTC is still Saturday in New York, so the week there began earlier.
		let sunday = new Date("2026-07-26T00:30:00Z");
		expect(startOfWeek(sunday, "UTC", { weekStartsOn: 0 }).toISOString()).toBe(
			"2026-07-26T00:00:00.000Z",
		);
		expect(startOfWeek(sunday, "America/New_York", { weekStartsOn: 0 }).toISOString()).toBe(
			"2026-07-19T04:00:00.000Z",
		);
	});

	test("opens every day of one week on the same instant", () => {
		let starts = new Set<number>();
		for (let day = 26; day <= 31; day++) {
			let date = new Date(`2026-07-${day}T12:00:00Z`);
			starts.add(startOfWeek(date, "UTC", { weekStartsOn: 0 }).getTime());
		}
		expect(starts.size).toBe(1);
	});
});
