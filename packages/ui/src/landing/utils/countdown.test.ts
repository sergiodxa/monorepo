/**
 * Tests the countdown arithmetic: whole units carried down from days to seconds, rounded down
 * so the page never runs ahead of the clock, and a passed or unreadable moment reading done.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { countdownParts } from "./countdown.js";

describe("countdownParts", () => {
	test("carries the time left into days, hours, minutes and seconds", () => {
		expect(countdownParts("2027-04-15T07:00:00Z", "2027-04-14T05:29:15Z")).toEqual({
			done: false,
			days: 1,
			hours: 1,
			minutes: 30,
			seconds: 45,
		});
	});

	test("rounds a part-second down", () => {
		expect(countdownParts(10_999, 0)).toMatchObject({ done: false, seconds: 10 });
	});

	test("reads days past a month without carrying them further", () => {
		expect(countdownParts("2027-04-15T07:00:00Z", "2026-11-13T07:00:00Z")).toMatchObject({
			days: 153,
			hours: 0,
		});
	});

	test("reads done at the moment and after it", () => {
		let zero = { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
		expect(countdownParts(1_000, 1_000)).toEqual(zero);
		expect(countdownParts(1_000, 5_000)).toEqual(zero);
	});

	test("reads done for a moment that does not parse", () => {
		expect(countdownParts("not a date", Date.now()).done).toBe(true);
	});

	test("takes Dates, ISO strings and epoch milliseconds alike", () => {
		let to = new Date("2027-01-01T00:00:00Z");
		expect(countdownParts(to, "2026-12-31T23:00:00Z")).toEqual(
			countdownParts(to.getTime(), Date.parse("2026-12-31T23:00:00Z")),
		);
	});
});
