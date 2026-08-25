/**
 * Tests for whole-expression parsing: the five-field shape, every macro, the
 * restriction flags the day fields carry, the rejection of seconds and of
 * non-standard extensions, and that each failure names a field and an index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { CronFieldSet } from "./fields";
import type { InvalidCronExpression } from "./invalid-cron-expression";

import { parseExpression } from "./parse-expression";

/** Parse an expression, failing the test if it was rejected. */
function fields(expression: string): CronFieldSet {
	let result = parseExpression(expression);
	if (isFailure(result)) throw new Error(`unexpected failure: ${result.error.message}`);
	return result.data;
}

/** Parse an expression, failing the test if it was accepted. */
function rejection(expression: string): InvalidCronExpression {
	let result = parseExpression(expression);
	if (isSuccess(result)) throw new Error(`unexpected success for ${expression}`);
	return result.error;
}

describe("parseExpression", () => {
	test("reads the five standard fields", () => {
		let parsed = fields("30 9 15 6 1");
		expect(parsed.minutes).toEqual([30]);
		expect(parsed.hours).toEqual([9]);
		expect(parsed.daysOfMonth).toEqual([15]);
		expect(parsed.months).toEqual([6]);
		expect(parsed.daysOfWeek).toEqual([1]);
	});

	test("accepts any whitespace between fields", () => {
		expect(fields("  0   0 * * *  ").hours).toEqual([0]);
		expect(fields("0\t0 * * *").hours).toEqual([0]);
		expect(fields("0\n0 * * *").hours).toEqual([0]);
	});

	test("expands every supported macro", () => {
		expect(fields("@hourly")).toMatchObject({
			minutes: [0],
			hours: Array.from({ length: 24 }, (_, index) => index),
		});
		expect(fields("@daily")).toMatchObject({ minutes: [0], hours: [0] });
		expect(fields("@weekly")).toMatchObject({ minutes: [0], hours: [0], daysOfWeek: [0] });
		expect(fields("@monthly")).toMatchObject({ minutes: [0], hours: [0], daysOfMonth: [1] });
		expect(fields("@yearly")).toMatchObject({
			minutes: [0],
			hours: [0],
			daysOfMonth: [1],
			months: [1],
		});
	});

	test("reads @annually as the long spelling of @yearly", () => {
		expect(fields("@annually")).toEqual(fields("@yearly"));
	});

	test("reads @midnight as the other spelling of @daily", () => {
		expect(fields("@midnight")).toEqual(fields("@daily"));
	});

	test("reads a macro whatever its case", () => {
		expect(fields("@DAILY")).toEqual(fields("@daily"));
		expect(fields("@Weekly")).toEqual(fields("@weekly"));
	});

	test("marks the day fields restricted unless written as a bare star", () => {
		expect(fields("0 0 * * *")).toMatchObject({
			dayOfMonthRestricted: false,
			dayOfWeekRestricted: false,
		});
		expect(fields("0 0 15 * *")).toMatchObject({
			dayOfMonthRestricted: true,
			dayOfWeekRestricted: false,
		});
		expect(fields("0 0 * * 1")).toMatchObject({
			dayOfMonthRestricted: false,
			dayOfWeekRestricted: true,
		});
		expect(fields("0 0 */2 * 1")).toMatchObject({
			dayOfMonthRestricted: true,
			dayOfWeekRestricted: true,
		});
		expect(fields("0 0 1-31 * 0-6")).toMatchObject({
			dayOfMonthRestricted: true,
			dayOfWeekRestricted: true,
		});
	});

	test("rejects empty text", () => {
		let error = rejection("");
		expect(error.reason).toBe("empty");
		expect(error.field).toBe(null);
		expect(error.position).toBe(0);
		expect(rejection("   ").reason).toBe("empty");
	});

	test("rejects a six-field expression as a seconds schedule", () => {
		let error = rejection("* * * * * *");
		expect(error.reason).toBe("seconds-not-supported");
		expect(error.field).toBe(null);
		expect(error.position).toBe(0);
		expect(rejection("0 0 9 * * 1").reason).toBe("seconds-not-supported");
	});

	test("rejects too few fields, pointing past the last one", () => {
		let error = rejection("* * *");
		expect(error.reason).toBe("field-count");
		expect(error.position).toBe(5);
		expect(rejection("0").reason).toBe("field-count");
		expect(rejection("0 0 * *").reason).toBe("field-count");
	});

	test("rejects more fields than a seconds schedule could explain", () => {
		let error = rejection("* * * * * * *");
		expect(error.reason).toBe("field-count");
		expect(error.position).toBe(10);
	});

	test("rejects a macro it does not implement", () => {
		expect(rejection("@reboot").reason).toBe("unknown-macro");
		expect(rejection("@every_minute").reason).toBe("unknown-macro");
		expect(rejection("@daily extra").reason).toBe("unknown-macro");
		expect(rejection("@reboot").field).toBe(null);
	});

	test("rejects a day of month no month is long enough for", () => {
		let error = rejection("0 0 30 2 *");
		expect(error.reason).toBe("impossible-date");
		expect(error.field).toBe("dayOfMonth");
		expect(error.position).toBe(4);
		expect(rejection("0 0 31 4 *").reason).toBe("impossible-date");
		expect(rejection("0 0 31 2,4,6 *").reason).toBe("impossible-date");
	});

	test("accepts a rare date a calendar does reach", () => {
		expect(fields("0 0 29 2 *").daysOfMonth).toEqual([29]);
		expect(fields("0 0 31 2,3 *").months).toEqual([2, 3]);
		expect(fields("0 0 31 * *").daysOfMonth).toEqual([31]);
	});

	test("accepts an impossible day of month when a weekday can still match", () => {
		expect(fields("0 0 30 2 1")).toMatchObject({ daysOfMonth: [30], daysOfWeek: [1] });
	});

	test("reports the field a value failed in, with its index", () => {
		let minute = rejection("60 * * * *");
		expect(minute.field).toBe("minute");
		expect(minute.reason).toBe("out-of-range");
		expect(minute.position).toBe(0);

		let hour = rejection("0 25 * * *");
		expect(hour.field).toBe("hour");
		expect(hour.position).toBe(2);

		let dayOfMonth = rejection("0 0 32 * *");
		expect(dayOfMonth.field).toBe("dayOfMonth");
		expect(dayOfMonth.position).toBe(4);

		let month = rejection("0 0 * 13 *");
		expect(month.field).toBe("month");
		expect(month.position).toBe(6);

		let dayOfWeek = rejection("0 0 * * 8");
		expect(dayOfWeek.field).toBe("dayOfWeek");
		expect(dayOfWeek.position).toBe(8);
	});

	test("keeps the position aligned with leading whitespace", () => {
		let error = rejection("   0 0 * * 8");
		expect(error.position).toBe(11);
		expect(error.expression).toBe("   0 0 * * 8");
	});

	test("rejects the non-standard extensions other parsers accept", () => {
		expect(rejection("0 0 L * *").field).toBe("dayOfMonth");
		expect(rejection("0 0 1W * *").field).toBe("dayOfMonth");
		expect(rejection("0 0 * * 1#2").field).toBe("dayOfWeek");
		expect(rejection("? ? * * *").field).toBe("minute");
		expect(rejection("0 0 ? * ?").field).toBe("dayOfMonth");
	});

	test("returns a failure instead of throwing, whatever the input", () => {
		expect(() => parseExpression("nonsense")).not.toThrow();
		expect(() => parseExpression("")).not.toThrow();
		expect(() => parseExpression("@@@")).not.toThrow();
		expect(() => parseExpression("*".repeat(500))).not.toThrow();
	});
});
