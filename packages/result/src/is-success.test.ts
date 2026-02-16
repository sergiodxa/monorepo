import { describe, expect, test } from "bun:test";

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
			// TypeScript should know result.data is number
			let value: number = result.data;
			expect(value).toBe(42);
		}
	});
});
