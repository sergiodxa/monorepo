import { describe, expect, test } from "bun:test";

import type { Result } from "./types.js";

import { failed } from "./failed.js";
import { failure } from "./failure.js";
import { success } from "./success.js";

describe(failed, () => {
	test("does not throw for failure results", () => {
		let result = failure(new Error("Failed"));
		expect(() => failed(result)).not.toThrow();
	});

	test("throws for success results with default message", () => {
		let result = success(42);

		expect(() => failed(result)).toThrow("Result is a success");
	});

	test("throws for success results with custom message", () => {
		let result = success(42);

		expect(() => failed(result, "Expected failure")).toThrow("Expected failure");
	});

	test("thrown error has original data as cause", () => {
		let result = success({ id: 1 });

		try {
			failed(result);
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			if (error instanceof Error) {
				expect(error.cause).toEqual({ id: 1 });
			}
		}
	});

	test("narrows type after assertion", () => {
		let result: Result<number, Error> = failure(new Error("Failed"));

		failed(result);
		// After this point, TypeScript knows result is Failure<Error>
		let error: Error = result.error;
		expect(error.message).toBe("Failed");
	});
});
