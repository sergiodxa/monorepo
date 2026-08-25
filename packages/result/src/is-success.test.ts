/**
 * Unit tests for the isSuccess type guard, covering the truthiness check
 * and the compile-time narrowing it gives callers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { isSuccess } from "./is-success.js";
import { success } from "./success.js";

describe(isSuccess, () => {
	test("returns true for success results", () => {
		let result = success(42);
		expect(isSuccess(result)).toBe(true);
	});

	test("returns false for failure results", () => {
		let result = failure(new Error("Failed"));
		expect(isSuccess(result)).toBe(false);
	});

	test("narrows type correctly", () => {
		let result: Result<number, Error> = success(42);

		if (isSuccess(result)) {
			let value: number = result.data;
			expect(value).toBe(42);
		}
	});
});
