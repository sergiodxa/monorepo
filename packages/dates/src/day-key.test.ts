/**
 * Tests for day keys: that the key names a day in a zone rather than an instant,
 * that a day the calendar does not have is a failure instead of a silent rollover,
 * and that the key round-trips back to the day's start.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { fromDayKey, parseDayKey, toDayKey } from "./day-key";
import { InvalidDayKeyError } from "./invalid-day-key-error";

/** Zone whose offset puts late-UTC instants on the previous calendar day. */
const NEW_YORK = "America/New_York";

describe("toDayKey", () => {
	test("zero-pads month and day", () => {
		expect(toDayKey(new Date("2026-01-05T12:00:00Z"), "UTC")).toBe("2026-01-05");
	});

	test("names the day in the zone asked for", () => {
		let instant = new Date("2026-07-29T02:00:00Z");
		expect(toDayKey(instant, "UTC")).toBe("2026-07-29");
		expect(toDayKey(instant, NEW_YORK)).toBe("2026-07-28");
		expect(toDayKey(instant, "Asia/Tokyo")).toBe("2026-07-29");
	});

	test("is stable across every instant of the same day", () => {
		expect(toDayKey(new Date("2026-07-29T04:00:00Z"), NEW_YORK)).toBe(
			toDayKey(new Date("2026-07-30T03:59:59.999Z"), NEW_YORK),
		);
	});
});

describe("parseDayKey", () => {
	test("reads the calendar fields with no zone involved", () => {
		expect(unwrap(parseDayKey("2026-07-29"))).toEqual({ year: 2026, month: 7, day: 29 });
	});

	test("accepts leap day in a leap year", () => {
		expect(unwrap(parseDayKey("2024-02-29"))).toEqual({ year: 2024, month: 2, day: 29 });
	});

	test("rejects a day the month does not have", () => {
		expect(isFailure(parseDayKey("2026-02-30"))).toBe(true);
		expect(isFailure(parseDayKey("2026-04-31"))).toBe(true);
		expect(isFailure(parseDayKey("2025-02-29"))).toBe(true);
	});

	test("rejects a month outside the calendar", () => {
		expect(isFailure(parseDayKey("2026-13-01"))).toBe(true);
		expect(isFailure(parseDayKey("2026-00-10"))).toBe(true);
	});

	test("rejects text that is not the key shape", () => {
		for (let input of ["", "2026-7-29", "26-07-29", "2026/07/29", "2026-07-29T00:00:00Z"]) {
			expect(isFailure(parseDayKey(input))).toBe(true);
		}
	});

	test("names the rejected text on the error", () => {
		let result = parseDayKey(" nope ");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(InvalidDayKeyError);
		expect(result.error.text).toBe(" nope ");
		expect(result.error.message).toBe('Invalid day key: " nope "');
	});

	test("tolerates surrounding whitespace on an otherwise valid key", () => {
		expect(unwrap(parseDayKey(" 2026-07-29 "))).toEqual({ year: 2026, month: 7, day: 29 });
	});
});

describe("fromDayKey", () => {
	test("returns the day's first instant in the zone asked for", () => {
		expect(unwrap(fromDayKey("2026-07-29", "UTC")).toISOString()).toBe("2026-07-29T00:00:00.000Z");
		expect(unwrap(fromDayKey("2026-07-29", NEW_YORK)).toISOString()).toBe(
			"2026-07-29T04:00:00.000Z",
		);
	});

	test("round-trips through toDayKey in the same zone", () => {
		let key = "2026-03-08";
		expect(toDayKey(unwrap(fromDayKey(key, NEW_YORK)), NEW_YORK)).toBe(key);
	});

	test("fails instead of returning an invalid date", () => {
		let result = fromDayKey("2026-02-30", "UTC");
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(InvalidDayKeyError);
	});
});
