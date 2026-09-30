/**
 * Tests for `datetime-local` values: that the value reads the zone's wall clock,
 * that a submitted value round-trips to the same instant, and that a day or time
 * the calendar lacks is a failure instead of a silent rollover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseDateTimeLocal, toDateTimeLocal } from "./date-time-local.js";
import { InvalidDateTimeLocalError } from "./invalid-date-time-local-error.js";

/** Zone whose transitions happen at 02:00 local, on the standard US dates. */
const NEW_YORK = "America/New_York";

describe("toDateTimeLocal", () => {
	test("reads the wall clock in the zone asked for", () => {
		let instant = new Date("2026-07-29T02:05:00Z");
		expect(toDateTimeLocal(instant, "UTC")).toBe("2026-07-29T02:05");
		expect(toDateTimeLocal(instant, NEW_YORK)).toBe("2026-07-28T22:05");
		expect(toDateTimeLocal(instant, "Asia/Kolkata")).toBe("2026-07-29T07:35");
	});

	test("zero-pads every field and uses 00 for midnight", () => {
		expect(toDateTimeLocal(new Date("2026-01-05T00:07:00Z"), "UTC")).toBe("2026-01-05T00:07");
	});

	test("drops seconds and milliseconds", () => {
		expect(toDateTimeLocal(new Date("2026-07-29T10:30:59.999Z"), "UTC")).toBe("2026-07-29T10:30");
	});
});

describe("parseDateTimeLocal", () => {
	test("reads the value as a wall clock in the zone asked for", () => {
		expect(unwrap(parseDateTimeLocal("2026-07-29T10:30", "UTC")).toISOString()).toBe(
			"2026-07-29T10:30:00.000Z",
		);
		expect(unwrap(parseDateTimeLocal("2026-07-29T10:30", NEW_YORK)).toISOString()).toBe(
			"2026-07-29T14:30:00.000Z",
		);
		expect(unwrap(parseDateTimeLocal("2026-12-29T10:30", NEW_YORK)).toISOString()).toBe(
			"2026-12-29T15:30:00.000Z",
		);
	});

	test("accepts seconds and a fraction of a second", () => {
		expect(unwrap(parseDateTimeLocal("2026-07-29T10:30:15", "UTC")).toISOString()).toBe(
			"2026-07-29T10:30:15.000Z",
		);
		expect(unwrap(parseDateTimeLocal("2026-07-29T10:30:15.250", "UTC")).toISOString()).toBe(
			"2026-07-29T10:30:15.250Z",
		);
		expect(unwrap(parseDateTimeLocal("2026-07-29T10:30:15.5", "UTC")).toISOString()).toBe(
			"2026-07-29T10:30:15.500Z",
		);
	});

	test("round-trips through toDateTimeLocal in the same zone", () => {
		for (let value of ["2026-07-29T22:05", "2026-01-01T00:00", "2026-03-08T12:00"]) {
			let instant = unwrap(parseDateTimeLocal(value, NEW_YORK));
			expect(toDateTimeLocal(instant, NEW_YORK)).toBe(value);
		}
	});

	test("round-trips an instant through the value in a non-UTC zone", () => {
		let instant = new Date("2026-07-29T02:05:00Z");
		let value = toDateTimeLocal(instant, "Asia/Kolkata");
		expect(unwrap(parseDateTimeLocal(value, "Asia/Kolkata")).getTime()).toBe(instant.getTime());
	});

	test("moves a time DST skips past the gap", () => {
		expect(unwrap(parseDateTimeLocal("2026-03-08T02:30", NEW_YORK)).toISOString()).toBe(
			"2026-03-08T07:30:00.000Z",
		);
	});

	test("resolves a time DST repeats to its earlier instant", () => {
		expect(unwrap(parseDateTimeLocal("2026-11-01T01:30", NEW_YORK)).toISOString()).toBe(
			"2026-11-01T05:30:00.000Z",
		);
	});

	test("accepts leap day in a leap year", () => {
		expect(unwrap(parseDateTimeLocal("2024-02-29T09:00", "UTC")).toISOString()).toBe(
			"2024-02-29T09:00:00.000Z",
		);
	});

	test("rejects a day the month does not have", () => {
		for (let value of ["2026-02-30T10:00", "2026-04-31T10:00", "2025-02-29T10:00"]) {
			expect(isFailure(parseDateTimeLocal(value, "UTC"))).toBe(true);
		}
	});

	test("rejects a month or day outside the calendar", () => {
		for (let value of ["2026-13-01T10:00", "2026-00-10T10:00", "2026-07-00T10:00"]) {
			expect(isFailure(parseDateTimeLocal(value, "UTC"))).toBe(true);
		}
	});

	test("rejects a time of day outside the clock", () => {
		for (let value of [
			"2026-07-29T25:00",
			"2026-07-29T24:00",
			"2026-07-29T10:60",
			"2026-07-29T10:30:60",
		]) {
			expect(isFailure(parseDateTimeLocal(value, "UTC"))).toBe(true);
		}
	});

	test("rejects text that is not the value shape", () => {
		for (let value of [
			"",
			"garbage",
			"2026-07-29",
			"2026-07-29 10:30",
			"2026-07-29T10",
			"2026-07-29T10:30Z",
			"2026-07-29T10:30+02:00",
			"2026-07-29T10:30:15.1234",
			"26-07-29T10:30",
		]) {
			expect(isFailure(parseDateTimeLocal(value, "UTC"))).toBe(true);
		}
	});

	test("tolerates surrounding whitespace on an otherwise valid value", () => {
		expect(unwrap(parseDateTimeLocal(" 2026-07-29T10:30 ", "UTC")).toISOString()).toBe(
			"2026-07-29T10:30:00.000Z",
		);
	});

	test("names the rejected text on the error", () => {
		let result = parseDateTimeLocal("2026-02-30T10:00", "UTC");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(InvalidDateTimeLocalError);
		expect(result.error.text).toBe("2026-02-30T10:00");
		expect(result.error.message).toBe('Invalid datetime-local value: "2026-02-30T10:00"');
	});
});
