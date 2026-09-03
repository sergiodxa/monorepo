/**
 * Tests for normalization: names and macros resolve to numbers, an evenly spaced
 * list collapses to the step it equals, and a day field that names every day keeps
 * its range rather than becoming a star, because that star would silently change
 * the either-or rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { normalizeExpression } from "./normalize.js";
import { parseExpression } from "./parse-expression.js";

/** Normalize an expression, failing the test if it could not be parsed. */
function normalized(expression: string): string {
	let result = parseExpression(expression);
	if (isFailure(result)) throw new Error(`unexpected failure: ${result.error.message}`);
	return normalizeExpression(result.data);
}

describe("normalizeExpression", () => {
	test("expands every macro to its fields", () => {
		expect(normalized("@hourly")).toBe("0 * * * *");
		expect(normalized("@daily")).toBe("0 0 * * *");
		expect(normalized("@midnight")).toBe("0 0 * * *");
		expect(normalized("@weekly")).toBe("0 0 * * 0");
		expect(normalized("@monthly")).toBe("0 0 1 * *");
		expect(normalized("@yearly")).toBe("0 0 1 1 *");
		expect(normalized("@annually")).toBe("0 0 1 1 *");
	});

	test("resolves names to numbers", () => {
		expect(normalized("0 0 * * SUN")).toBe("0 0 * * 0");
		expect(normalized("0 0 1 JAN *")).toBe("0 0 1 1 *");
		expect(normalized("0 0 * * mon-fri")).toBe("0 0 * * 1-5");
		expect(normalized("0 0 * jan,mar *")).toBe("0 0 * 1,3 *");
	});

	test("folds day-of-week seven onto Sunday", () => {
		expect(normalized("0 0 * * 7")).toBe("0 0 * * 0");
		expect(normalized("0 0 * * 3,7")).toBe("0 0 * * 0,3");
	});

	test("writes an evenly spaced field as a step, however it was typed", () => {
		expect(normalized("0 0 * jan,jul *")).toBe("0 0 * */6 *");
		expect(normalized("0 0 * * 6,7")).toBe("0 0 * * */6");
	});

	test("keeps a step written on a star", () => {
		expect(normalized("*/15 * * * *")).toBe("*/15 * * * *");
		expect(normalized("0 */3 * * *")).toBe("0 */3 * * *");
		expect(normalized("0 0 */2 * *")).toBe("0 0 */2 * *");
	});

	test("spells out a step that does not start at the field minimum", () => {
		expect(normalized("5/10 * * * *")).toBe("5,15,25,35,45,55 * * * *");
		expect(normalized("0 9-17/4 * * *")).toBe("0 9,13,17 * * *");
	});

	test("writes a full field as a star, and sorts and dedupes a list", () => {
		expect(normalized("0-59 * * * *")).toBe("* * * * *");
		expect(normalized("30,15,0 * * * *")).toBe("0,15,30 * * * *");
		expect(normalized("0 12 * * 1,1,1")).toBe("0 12 * * 1");
	});

	test("collapses three or more consecutive values into a range", () => {
		expect(normalized("0 0 * * 1,2,3,4,5")).toBe("0 0 * * 1-5");
		expect(normalized("0 0 1,2,3,10 * *")).toBe("0 0 1-3,10 * *");
		expect(normalized("0 0,1 * * *")).toBe("0 0,1 * * *");
	});

	test("trims whatever whitespace the input was written with", () => {
		expect(normalized("  0   0 * * *  ")).toBe("0 0 * * *");
		expect(normalized("0\t0 * * *")).toBe("0 0 * * *");
	});

	test("keeps a full day field as a range, so the either-or rule survives", () => {
		expect(normalized("0 0 1-31 * 1")).toBe("0 0 1-31 * 1");
		expect(normalized("0 0 15 * 0-6")).toBe("0 0 15 * 0-6");
		expect(normalized("0 0 15 * */1")).toBe("0 0 15 * 0-6");
	});

	test("reads back as the same expression, so storage is stable", () => {
		let expressions = [
			"* * * * *",
			"*/15 * * * *",
			"0 9 * * 1-5",
			"5,15,25,35,45,55 * * * *",
			"0 0 1-31 * 1",
			"0 0 13 * 5",
			"0 0 29 2 *",
			"0 0 1 1 *",
			"0 0 */2 * 1",
			"30 2 * * *",
			"0 0 * */6 *",
			"0 0 * 1,3 *",
		];

		for (let expression of expressions) {
			expect(normalized(expression)).toBe(expression);
			expect(normalized(normalized(expression))).toBe(expression);
		}
	});
});
