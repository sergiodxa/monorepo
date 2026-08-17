import { describe, expect, test } from "vitest";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { succeeded } from "./succeeded.js";
import { success } from "./success.js";

describe(succeeded, () => {
	test("does not throw for success results", () => {
		let result = success(42);
		expect(() => succeeded(result)).not.toThrow();
	});

	test("throws for failure results with default message", () => {
		let result = failure(new Error("Original error"));

		expect(() => succeeded(result)).toThrow("Result is a failure");
	});

	test("throws for failure results with custom message", () => {
		let result = failure(new Error("Original error"));

		expect(() => succeeded(result, "Custom failure message")).toThrow("Custom failure message");
	});

	test("thrown error has original error as cause", () => {
		let originalError = new Error("Original error");
		let result = failure(originalError);

		try {
			succeeded(result);
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			if (error instanceof Error) {
				expect(error.cause).toBe(originalError);
			}
		}
	});

	test("narrows type after assertion", () => {
		let result: Result<number, Error> = success(42);

		succeeded(result);
		// After this point, TypeScript knows result is Success<number>
		let value: number = result.data;
		expect(value).toBe(42);
	});
});
