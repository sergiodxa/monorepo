/**
 * Duration budget parsing: numbers, duration strings and bare millisecond text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { budgetMs, parseBudgetFlag } from "./budget.js";

describe("budgetMs", () => {
	test("passes numbers through", () => {
		expect(unwrap(budgetMs(200))).toBe(200);
		expect(unwrap(budgetMs(0))).toBe(0);
	});

	test("parses duration strings", () => {
		expect(unwrap(budgetMs("200ms"))).toBe(200);
		expect(unwrap(budgetMs("5s"))).toBe(5_000);
	});
});

describe("parseBudgetFlag", () => {
	test("reads a bare millisecond number as text", () => {
		expect(unwrap(parseBudgetFlag("150"))).toBe(150);
	});

	test("reads a duration string", () => {
		expect(unwrap(parseBudgetFlag("150ms"))).toBe(150);
	});

	test("fails on invalid text", () => {
		expect(isFailure(parseBudgetFlag("fast"))).toBe(true);
	});
});
