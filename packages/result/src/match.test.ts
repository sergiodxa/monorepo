import { describe, expect, test } from "bun:test";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { match } from "./match.js";
import { success } from "./success.js";

describe(match, () => {
	test("calls success handler for success result", () => {
		let result = success(42);
		let value = match(result, {
			success: (data) => `Got: ${data}`,
			failure: (error) => `Error: ${error.message}`,
		});
		expect(value).toBe("Got: 42");
	});

	test("calls failure handler for failure result", () => {
		let result = failure(new Error("Oops"));
		let value = match(result, {
			// The literal narrows to a failure, so the success branch is only
			// reachable through the annotation that pins the success type.
			success: (data: number) => `Got: ${data}`,
			failure: (error) => `Error: ${error.message}`,
		});
		expect(value).toBe("Error: Oops");
	});

	test("handlers can return different types than input", () => {
		let successResult: Result<string, Error> = success("hello");
		let failureResult: Result<string, Error> = failure(new Error("Oops"));

		let successLength = match(successResult, {
			success: (data: string) => data.length,
			failure: () => -1,
		});
		expect(successLength).toBe(5);

		let failureLength = match(failureResult, {
			success: (data: string) => data.length,
			failure: () => -1,
		});
		expect(failureLength).toBe(-1);
	});

	test("works with async success result", async () => {
		let result = Promise.resolve(success(42));
		let value = await match(result, {
			success: (data) => `Got: ${data}`,
			failure: (error) => `Error: ${error.message}`,
		});
		expect(value).toBe("Got: 42");
	});

	test("works with async failure result", async () => {
		let result = Promise.resolve(failure(new Error("Async error")));
		let value = await match(result, {
			success: (data: number) => `Got: ${data}`,
			failure: (error) => `Error: ${error.message}`,
		});
		expect(value).toBe("Error: Async error");
	});

	test("can be used for side effects", () => {
		let sideEffect = "";
		let result = success("test");

		match(result, {
			success: (data) => {
				sideEffect = data;
			},
			failure: () => {},
		});

		expect(sideEffect).toBe("test");
	});

	test("passes correct error type to failure handler", () => {
		class CustomError extends Error {
			code: string;
			constructor(message: string, code: string) {
				super(message);
				this.code = code;
			}
		}

		let result: Result<number, CustomError> = failure(new CustomError("Not found", "E404"));
		let value = match(result, {
			success: () => "success",
			failure: (error) => error.code,
		});
		expect(value).toBe("E404");
	});
});
