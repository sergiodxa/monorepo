/**
 * Tests for the descriptors: every `kind` the package can report, the fallback to
 * the raw expression when nothing concise fits, and that the numbers use the same
 * numbering as the cron fields so an app can interpolate them without a table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ScheduleDescriptor } from "./describe.js";

import { describeFields, stepFromStart } from "./describe.js";
import { parseExpression } from "./parse-expression.js";

/** Describe an expression, failing the test if it could not be parsed. */
function descriptorOf(expression: string): ScheduleDescriptor {
	let result = parseExpression(expression);
	if (isFailure(result)) throw new Error(`unexpected failure: ${result.error.message}`);
	return describeFields(result.data);
}

describe("describeFields", () => {
	test("describes a minute interval", () => {
		expect(descriptorOf("*/15 * * * *")).toEqual({ kind: "interval", unit: "minute", every: 15 });
		expect(descriptorOf("*/5 * * * *")).toEqual({ kind: "interval", unit: "minute", every: 5 });
		expect(descriptorOf("*/30 * * * *")).toEqual({ kind: "interval", unit: "minute", every: 30 });
	});

	test("describes every minute as an interval of one", () => {
		expect(descriptorOf("* * * * *")).toEqual({ kind: "interval", unit: "minute", every: 1 });
		expect(descriptorOf("0-59 * * * *")).toEqual({ kind: "interval", unit: "minute", every: 1 });
	});

	test("describes an hour interval that fires on the hour", () => {
		expect(descriptorOf("0 */3 * * *")).toEqual({ kind: "interval", unit: "hour", every: 3 });
		expect(descriptorOf("0 */6 * * *")).toEqual({ kind: "interval", unit: "hour", every: 6 });
	});

	test("describes minutes past every hour", () => {
		expect(descriptorOf("@hourly")).toEqual({ kind: "hourly", minutes: [0] });
		expect(descriptorOf("30 * * * *")).toEqual({ kind: "hourly", minutes: [30] });
		expect(descriptorOf("0,15,45 * * * *")).toEqual({ kind: "hourly", minutes: [0, 15, 45] });
		expect(descriptorOf("5/10 * * * *")).toEqual({
			kind: "hourly",
			minutes: [5, 15, 25, 35, 45, 55],
		});
	});

	test("prefers the interval shape when the minutes happen to be evenly spaced", () => {
		expect(descriptorOf("0,30 * * * *")).toEqual({ kind: "interval", unit: "minute", every: 30 });
		expect(descriptorOf("0 0,12 * * *")).toEqual({ kind: "interval", unit: "hour", every: 12 });
	});

	test("describes a daily time of day", () => {
		expect(descriptorOf("0 9 * * *")).toEqual({ kind: "daily", at: [{ hour: 9, minute: 0 }] });
		expect(descriptorOf("@daily")).toEqual({ kind: "daily", at: [{ hour: 0, minute: 0 }] });
		expect(descriptorOf("30 17 * * *")).toEqual({ kind: "daily", at: [{ hour: 17, minute: 30 }] });
	});

	test("describes several daily times, in clock order", () => {
		expect(descriptorOf("0 9,17 * * *")).toEqual({
			kind: "daily",
			at: [
				{ hour: 9, minute: 0 },
				{ hour: 17, minute: 0 },
			],
		});
		expect(descriptorOf("0,30 9 * * *")).toEqual({
			kind: "daily",
			at: [
				{ hour: 9, minute: 0 },
				{ hour: 9, minute: 30 },
			],
		});
	});

	test("describes weekdays with Sunday at zero", () => {
		expect(descriptorOf("0 9 * * 1,3,5")).toEqual({
			kind: "weekly",
			weekdays: [1, 3, 5],
			at: [{ hour: 9, minute: 0 }],
		});
		expect(descriptorOf("@weekly")).toEqual({
			kind: "weekly",
			weekdays: [0],
			at: [{ hour: 0, minute: 0 }],
		});
		expect(descriptorOf("0 9 * * mon-fri")).toEqual({
			kind: "weekly",
			weekdays: [1, 2, 3, 4, 5],
			at: [{ hour: 9, minute: 0 }],
		});
	});

	test("describes days of the month", () => {
		expect(descriptorOf("@monthly")).toEqual({
			kind: "monthly",
			days: [1],
			at: [{ hour: 0, minute: 0 }],
		});
		expect(descriptorOf("0 6 1,15 * *")).toEqual({
			kind: "monthly",
			days: [1, 15],
			at: [{ hour: 6, minute: 0 }],
		});
	});

	test("describes days of named months with January at one", () => {
		expect(descriptorOf("@yearly")).toEqual({
			kind: "yearly",
			months: [1],
			days: [1],
			at: [{ hour: 0, minute: 0 }],
		});
		expect(descriptorOf("0 0 1 jul *")).toEqual({
			kind: "yearly",
			months: [7],
			days: [1],
			at: [{ hour: 0, minute: 0 }],
		});
		expect(descriptorOf("0 0 1 */3 *")).toEqual({
			kind: "yearly",
			months: [1, 4, 7, 10],
			days: [1],
			at: [{ hour: 0, minute: 0 }],
		});
	});

	/** The either-or rule cannot be phrased as one shape, so the app shows the text. */
	test("falls back to the expression when both day fields are restricted", () => {
		expect(descriptorOf("0 0 13 * 5")).toEqual({ kind: "expression" });
		expect(descriptorOf("0 0 1 * 0")).toEqual({ kind: "expression" });
	});

	test("falls back to the expression when there are too many times to list", () => {
		expect(descriptorOf("*/15 9-17 * * 1-5")).toEqual({ kind: "expression" });
		expect(descriptorOf("*/2 * * * 1")).toEqual({ kind: "expression" });
	});

	test("falls back to the expression when only the month is restricted", () => {
		expect(descriptorOf("0 9 * 6 *")).toEqual({ kind: "expression" });
	});

	test("freezes what it returns, so a consumer cannot rewrite it", () => {
		let descriptor = descriptorOf("0 9 * * *");
		expect(Object.isFrozen(descriptor)).toBe(true);
	});
});

describe("descriptor coverage", () => {
	/**
	 * Every distinction a hand-written schedule description draws, paired with the
	 * descriptor that carries it. A row falling to `kind: "expression"` here costs
	 * the user the sentence they would otherwise see.
	 */
	const CASES = [
		{ sentence: "every year on January 1st at midnight", expression: "@yearly" },
		{ sentence: "every year on January 1st at midnight", expression: "@annually" },
		{ sentence: "every month on the 1st at midnight", expression: "@monthly" },
		{ sentence: "every Sunday at midnight", expression: "@weekly" },
		{ sentence: "every day at midnight", expression: "@daily" },
		{ sentence: "every day at midnight", expression: "@midnight" },
		{ sentence: "every hour", expression: "@hourly" },
		{ sentence: "every minute", expression: "* * * * *" },
		{ sentence: "every hour", expression: "0 * * * *" },
		{ sentence: "every 15 minutes", expression: "*/15 * * * *" },
		{ sentence: "every 5 minutes", expression: "*/5 * * * *" },
		{ sentence: "every hour at minute 5", expression: "5 * * * *" },
		{ sentence: "every day at midnight", expression: "0 0 * * *" },
		{ sentence: "every day at 09:00", expression: "0 9 * * *" },
		{ sentence: "every day at 09:30", expression: "30 9 * * *" },
		{ sentence: "every Monday at midnight", expression: "0 0 * * 1" },
		{ sentence: "every Monday at 09:00", expression: "0 9 * * 1" },
		{ sentence: "monthly on day 15 at midnight", expression: "0 0 15 * *" },
	] as const;

	test("has a structured shape for every sentence such a function produces", () => {
		for (let { expression, sentence } of CASES) {
			expect({ expression, sentence, kind: descriptorOf(expression).kind }).not.toEqual({
				expression,
				sentence,
				kind: "expression",
			});
		}
	});

	test("carries the numbers each sentence interpolates", () => {
		expect(descriptorOf("*/15 * * * *")).toEqual({ kind: "interval", unit: "minute", every: 15 });
		expect(descriptorOf("5 * * * *")).toEqual({ kind: "hourly", minutes: [5] });
		expect(descriptorOf("30 9 * * *")).toEqual({ kind: "daily", at: [{ hour: 9, minute: 30 }] });
		expect(descriptorOf("0 9 * * 1")).toEqual({
			kind: "weekly",
			weekdays: [1],
			at: [{ hour: 9, minute: 0 }],
		});
		expect(descriptorOf("0 0 15 * *")).toEqual({
			kind: "monthly",
			days: [15],
			at: [{ hour: 0, minute: 0 }],
		});
	});

	/** Both are `hourly`, and the minutes are what a translation keys the wording on. */
	test("tells an on-the-hour schedule apart from one at a minute past it", () => {
		expect(descriptorOf("0 * * * *")).toEqual({ kind: "hourly", minutes: [0] });
		expect(descriptorOf("5 * * * *")).toEqual({ kind: "hourly", minutes: [5] });
	});

	/** A description that says "at midnight" reads it off `at`. */
	test("tells midnight apart from another time of day without wording it", () => {
		expect(descriptorOf("0 0 * * *")).toEqual({ kind: "daily", at: [{ hour: 0, minute: 0 }] });
		expect(descriptorOf("0 9 * * *")).toEqual({ kind: "daily", at: [{ hour: 9, minute: 0 }] });
	});

	test("falls back to the expression exactly where such a function gives up too", () => {
		expect(descriptorOf("0 0 1 1 1")).toEqual({ kind: "expression" });
		expect(descriptorOf("0 0 13 * 5")).toEqual({ kind: "expression" });
	});

	/**
	 * The rule that keeps user-facing copy out of this package: every other field
	 * is a number, so there is nothing here to translate.
	 */
	test("never returns a string anywhere inside a descriptor except the kind", () => {
		for (let { expression } of CASES) {
			let descriptor = descriptorOf(expression);
			for (let [key, value] of Object.entries(descriptor)) {
				if (key === "kind" || key === "unit") continue;
				let values = Array.isArray(value) ? value : [value];
				for (let entry of values) {
					let numbers =
						typeof entry === "object" && entry !== null ? Object.values(entry) : [entry];
					for (let number of numbers) expect(typeof number).toBe("number");
				}
			}
		}
	});
});

describe("stepFromStart", () => {
	test("finds the spacing of a series that starts at the field minimum", () => {
		expect(stepFromStart([0, 15, 30, 45], 0, 59)).toBe(15);
		expect(stepFromStart([0, 30], 0, 59)).toBe(30);
		expect(stepFromStart([1, 3, 5, 7, 9, 11], 1, 12)).toBe(2);
	});

	test("refuses a series that does not start at the minimum or is not even", () => {
		expect(stepFromStart([5, 15, 25, 35, 45, 55], 0, 59)).toBe(null);
		expect(stepFromStart([0, 15, 31, 45], 0, 59)).toBe(null);
		expect(stepFromStart([0], 0, 59)).toBe(null);
		expect(stepFromStart([], 0, 59)).toBe(null);
	});

	test("refuses a series that stops short of the range, which a step never does", () => {
		expect(stepFromStart([0, 2, 4], 0, 59)).toBe(null);
		expect(stepFromStart([0, 1, 2], 0, 59)).toBe(null);
	});
});
