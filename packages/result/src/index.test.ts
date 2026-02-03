import { describe, expect, test } from "bun:test";

import { success, failure, isSuccess, isFailure, succeeded, failed, type Result } from "./index";

describe("Result", () => {
	describe("success", () => {
		test("creates a success result with data", () => {
			let result = success({ id: 1, name: "Test" });

			expect(result.status).toBe("success");
			expect(result.data).toEqual({ id: 1, name: "Test" });
		});

		test("works with primitives", () => {
			let numberResult = success(42);
			let stringResult = success("hello");
			let booleanResult = success(true);

			expect(numberResult.data).toBe(42);
			expect(stringResult.data).toBe("hello");
			expect(booleanResult.data).toBe(true);
		});

		test("works with null and undefined", () => {
			let nullResult = success(null);
			let undefinedResult = success(undefined);

			expect(nullResult.data).toBeNull();
			expect(undefinedResult.data).toBeUndefined();
		});
	});

	describe("failure", () => {
		test("creates a failure result with error", () => {
			let error = new Error("Something went wrong");
			let result = failure(error);

			expect(result.status).toBe("failure");
			expect(result.error).toBe(error);
			expect(result.error.message).toBe("Something went wrong");
		});

		test("works with custom error classes", () => {
			class CustomError extends Error {
				code: string;
				constructor(message: string, code: string) {
					super(message);
					this.code = code;
				}
			}

			let error = new CustomError("Custom error", "E001");
			let result = failure(error);

			expect(result.error).toBe(error);
			expect(result.error.code).toBe("E001");
		});
	});

	describe("isSuccess", () => {
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

	describe("isFailure", () => {
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

	describe("succeeded", () => {
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

	describe("failed", () => {
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

	describe("Result type patterns", () => {
		test("discriminated union with if/else", () => {
			function processResult(result: Result<number, Error>): string {
				if (isSuccess(result)) {
					return `Success: ${result.data}`;
				}
				return `Error: ${result.error.message}`;
			}

			expect(processResult(success(42))).toBe("Success: 42");
			expect(processResult(failure(new Error("Oops")))).toBe("Error: Oops");
		});

		test("early return pattern", () => {
			function divide(a: number, b: number): Result<number, Error> {
				if (b === 0) {
					return failure(new Error("Division by zero"));
				}
				return success(a / b);
			}

			let successResult = divide(10, 2);
			expect(isSuccess(successResult)).toBe(true);
			if (isSuccess(successResult)) {
				expect(successResult.data).toBe(5);
			}

			let failureResult = divide(10, 0);
			expect(isFailure(failureResult)).toBe(true);
			if (isFailure(failureResult)) {
				expect(failureResult.error.message).toBe("Division by zero");
			}
		});

		test("chaining results with early returns", () => {
			function step1(): Result<number, Error> {
				return success(10);
			}

			function step2(value: number): Result<number, Error> {
				if (value < 5) return failure(new Error("Too small"));
				return success(value * 2);
			}

			function step3(value: number): Result<string, Error> {
				return success(`Final: ${value}`);
			}

			function pipeline(): Result<string, Error> {
				let result1 = step1();
				if (isFailure(result1)) return result1;

				let result2 = step2(result1.data);
				if (isFailure(result2)) return result2;

				return step3(result2.data);
			}

			let result = pipeline();
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toBe("Final: 20");
			}
		});
	});
});
