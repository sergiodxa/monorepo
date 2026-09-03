/**
 * Tests for the field grammar: every accepted shape (value, list, range, step,
 * name) expands to the right numbers, and every rejected one reports a reason with
 * an index that points at the offending character rather than at the field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CronFieldSpec } from "./fields";

import { FIELD_SPECS, isRestrictedField, parseCronField } from "./fields";

/** The spec for one of the five fields, by name, for a readable test setup. */
function specFor(name: string): CronFieldSpec {
	let spec = FIELD_SPECS.find((candidate) => candidate.field === name);
	if (spec === undefined) throw new Error(`no spec for ${name}`);
	return spec;
}

const MINUTE = specFor("minute");
const HOUR = specFor("hour");
const DAY_OF_MONTH = specFor("dayOfMonth");
const MONTH = specFor("month");
const DAY_OF_WEEK = specFor("dayOfWeek");

/** Expand a field, failing the test if it was rejected. */
function values(spec: CronFieldSpec, text: string, offset = 0): readonly number[] {
	let result = parseCronField(spec, text, text, offset);
	if (isFailure(result)) throw new Error(`unexpected failure: ${result.error.message}`);
	return result.data;
}

/** Expand a field, failing the test if it was accepted. */
function rejection(spec: CronFieldSpec, text: string, offset = 0) {
	let result = parseCronField(spec, text, text, offset);
	if (isSuccess(result)) throw new Error(`unexpected success for ${text}`);
	return result.error;
}

describe("parseCronField", () => {
	test("expands a star to the whole range", () => {
		expect(values(MINUTE, "*").length).toBe(60);
		expect(values(HOUR, "*")).toEqual(Array.from({ length: 24 }, (_, index) => index));
		expect(values(DAY_OF_MONTH, "*")[0]).toBe(1);
		expect(values(MONTH, "*")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		expect(values(DAY_OF_WEEK, "*")).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	test("reads a single value", () => {
		expect(values(MINUTE, "0")).toEqual([0]);
		expect(values(MINUTE, "59")).toEqual([59]);
		expect(values(HOUR, "9")).toEqual([9]);
		expect(values(DAY_OF_MONTH, "31")).toEqual([31]);
	});

	test("reads a list, sorted and deduplicated", () => {
		expect(values(MINUTE, "0,30")).toEqual([0, 30]);
		expect(values(MINUTE, "30,15,0")).toEqual([0, 15, 30]);
		expect(values(DAY_OF_WEEK, "1,1,1")).toEqual([1]);
	});

	test("reads an inclusive range", () => {
		expect(values(HOUR, "9-12")).toEqual([9, 10, 11, 12]);
		expect(values(DAY_OF_WEEK, "1-5")).toEqual([1, 2, 3, 4, 5]);
		expect(values(MINUTE, "5-5")).toEqual([5]);
	});

	test("reads a star with a step", () => {
		expect(values(MINUTE, "*/15")).toEqual([0, 15, 30, 45]);
		expect(values(HOUR, "*/6")).toEqual([0, 6, 12, 18]);
		expect(values(DAY_OF_MONTH, "*/10")).toEqual([1, 11, 21, 31]);
	});

	test("reads a range with a step", () => {
		expect(values(HOUR, "9-17/4")).toEqual([9, 13, 17]);
		expect(values(DAY_OF_WEEK, "1-5/2")).toEqual([1, 3, 5]);
	});

	test("reads a value with a step as running to the field maximum", () => {
		expect(values(MINUTE, "5/10")).toEqual([5, 15, 25, 35, 45, 55]);
		expect(values(HOUR, "22/1")).toEqual([22, 23]);
	});

	test("keeps only the start when the step overshoots the range", () => {
		expect(values(MINUTE, "0-59/70")).toEqual([0]);
		expect(values(HOUR, "8-9/5")).toEqual([8]);
	});

	test("mixes shapes in one field", () => {
		expect(values(MINUTE, "1,2,3-5")).toEqual([1, 2, 3, 4, 5]);
		expect(values(MINUTE, "0,*/30")).toEqual([0, 30]);
	});

	test("reads month names, in any case", () => {
		expect(values(MONTH, "JAN")).toEqual([1]);
		expect(values(MONTH, "dec")).toEqual([12]);
		expect(values(MONTH, "jan-mar")).toEqual([1, 2, 3]);
		expect(values(MONTH, "JAN-DEC/3")).toEqual([1, 4, 7, 10]);
		expect(values(MONTH, "Jan,Jul")).toEqual([1, 7]);
	});

	test("reads weekday names, in any case", () => {
		expect(values(DAY_OF_WEEK, "SUN")).toEqual([0]);
		expect(values(DAY_OF_WEEK, "sat")).toEqual([6]);
		expect(values(DAY_OF_WEEK, "mon-fri")).toEqual([1, 2, 3, 4, 5]);
		expect(values(DAY_OF_WEEK, "MON,WED,FRI")).toEqual([1, 3, 5]);
		expect(values(DAY_OF_WEEK, "SUN-MON")).toEqual([0, 1]);
	});

	test("folds day-of-week seven onto Sunday", () => {
		expect(values(DAY_OF_WEEK, "7")).toEqual([0]);
		expect(values(DAY_OF_WEEK, "0-7")).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(values(DAY_OF_WEEK, "*/7")).toEqual([0]);
		expect(values(DAY_OF_WEEK, "6,7")).toEqual([0, 6]);
	});

	test("rejects a value outside the field bounds, pointing at it", () => {
		expect(rejection(MINUTE, "60").reason).toBe("out-of-range");
		expect(rejection(HOUR, "24").reason).toBe("out-of-range");
		expect(rejection(DAY_OF_MONTH, "0").reason).toBe("out-of-range");
		expect(rejection(DAY_OF_MONTH, "32").reason).toBe("out-of-range");
		expect(rejection(MONTH, "0").reason).toBe("out-of-range");
		expect(rejection(MONTH, "13").reason).toBe("out-of-range");
		expect(rejection(DAY_OF_WEEK, "8").reason).toBe("out-of-range");
	});

	test("rejects a range whose start is past its end", () => {
		let error = rejection(MINUTE, "32-6");
		expect(error.reason).toBe("reversed-range");
		expect(error.field).toBe("minute");
		expect(rejection(DAY_OF_WEEK, "6-0").reason).toBe("reversed-range");
	});

	test("rejects a step that is missing, zero, or not a number", () => {
		expect(rejection(MINUTE, "*/0").reason).toBe("invalid-step");
		expect(rejection(MINUTE, "*/").reason).toBe("invalid-step");
		expect(rejection(MINUTE, "*/x").reason).toBe("invalid-step");
		expect(rejection(MINUTE, "*/-2").reason).toBe("invalid-step");
	});

	test("rejects a second step or a second dash rather than reading part of it", () => {
		expect(rejection(MINUTE, "*/2/3").reason).toBe("invalid-step");
		expect(rejection(MINUTE, "1-2-3").reason).toBe("syntax");
	});

	test("rejects an unknown name, told apart from a syntax error", () => {
		expect(rejection(MONTH, "jaan").reason).toBe("unknown-name");
		expect(rejection(DAY_OF_WEEK, "sunday").reason).toBe("unknown-name");
		expect(rejection(MINUTE, "abc").reason).toBe("unknown-name");
		expect(rejection(MINUTE, "@").reason).toBe("syntax");
		expect(rejection(MINUTE, "").reason).toBe("syntax");
		expect(rejection(MINUTE, "1,,2").reason).toBe("syntax");
	});

	test("rejects the non-standard extensions other parsers accept", () => {
		expect(rejection(DAY_OF_MONTH, "L").reason).toBe("unknown-name");
		expect(rejection(DAY_OF_MONTH, "1W").reason).toBe("syntax");
		expect(rejection(DAY_OF_WEEK, "1#2").reason).toBe("syntax");
		expect(rejection(DAY_OF_MONTH, "?").reason).toBe("syntax");
	});

	test("rejects a value the type of a number would otherwise accept", () => {
		expect(rejection(MINUTE, "1.5").reason).toBe("syntax");
		expect(rejection(MINUTE, "+1").reason).toBe("syntax");
		expect(rejection(MINUTE, "0x1").reason).toBe("syntax");
		expect(rejection(MINUTE, "-1").reason).toBe("syntax");
	});

	test("reports a position relative to the whole expression", () => {
		let result = parseCronField(DAY_OF_WEEK, "0 0 * * 8", "8", 8);
		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.position).toBe(8);
		expect(result.error.field).toBe("dayOfWeek");
		expect(result.error.expression).toBe("0 0 * * 8");
	});

	test("points inside the field at the item that failed", () => {
		expect(rejection(MINUTE, "0,15,99", 0).position).toBe(5);
		expect(rejection(HOUR, "9-99", 0).position).toBe(2);
		expect(rejection(MINUTE, "*/x", 0).position).toBe(2);
		expect(rejection(MINUTE, "1-2-3", 0).position).toBe(3);
	});
});

describe("isRestrictedField", () => {
	test("treats only a bare star as leaving a field open", () => {
		expect(isRestrictedField("*")).toBe(false);
		expect(isRestrictedField("*/2")).toBe(true);
		expect(isRestrictedField("1-31")).toBe(true);
		expect(isRestrictedField("0")).toBe(true);
	});
});
