import { describe, expect, test } from "vitest";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { isFailure } from "./is-failure.js";
import { success } from "./success.js";

describe(isFailure, () => {
	test("returns true for failure results", () => {
		let result = failure(new Error("Failed"));
		expect(isFailure(result)).toBe(true);
	});

	test("returns false for success results", () => {
		let result = success(42);
		expect(isFailure(result)).toBe(false);
	});

	test("narrows type correctly", () => {
		let result: Result<number, Error> = failure(new Error("Failed"));

		if (isFailure(result)) {
			// TypeScript should know result.error is Error
			let error: Error = result.error;
			expect(error.message).toBe("Failed");
		}
	});
});
