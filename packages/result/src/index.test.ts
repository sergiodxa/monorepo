import { describe, expect, test } from "bun:test";

import {
	success,
	failure,
	isSuccess,
	isFailure,
	succeeded,
	failed,
	unwrap,
	match,
	retry,
	wrap,
	partition,
	type Result,
} from "./index";

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

	describe(unwrap, () => {
		test("returns data from success result", () => {
			let result = success(42);
			expect(unwrap(result)).toBe(42);
		});

		test("returns data from success result with complex type", () => {
			let result = success({ id: 1, name: "Test" });
			expect(unwrap(result)).toEqual({ id: 1, name: "Test" });
		});

		test("throws error from failure result when no fallback provided", () => {
			let error = new Error("Something went wrong");
			let result = failure(error);
			expect(() => unwrap(result)).toThrow(error);
		});

		test("calls fallback with error from failure result", () => {
			let error = new Error("Something went wrong");
			let result: Result<number, Error> = failure(error);
			let value = unwrap(result, (e) => e.message.length);
			expect(value).toBe(20); // "Something went wrong".length
		});

		test("fallback receives the error for computation", () => {
			class CustomError extends Error {
				code: number;
				constructor(message: string, code: number) {
					super(message);
					this.code = code;
				}
			}

			let error = new CustomError("Not found", 404);
			let result: Result<number, CustomError> = failure(error);
			let value = unwrap(result, (e) => e.code);
			expect(value).toBe(404);
		});

		test("does not call fallback when result is success", () => {
			let result = success(42);
			let fallbackCalled = false;
			let value = unwrap(result, () => {
				fallbackCalled = true;
				return 0;
			});
			expect(value).toBe(42);
			expect(fallbackCalled).toBe(false);
		});

		test("returns data from async success result", async () => {
			let result = Promise.resolve(success(42));
			let value = await unwrap(result);
			expect(value).toBe(42);
		});

		test("throws error from async failure result when no fallback provided", async () => {
			let error = new Error("Async error");
			let result = Promise.resolve(failure(error));
			await expect(unwrap(result)).rejects.toThrow(error);
		});

		test("calls fallback with error from async failure result", async () => {
			let error = new Error("Async error");
			let result: Promise<Result<string, Error>> = Promise.resolve(failure(error));
			let value = await unwrap(result, (e) => `Fallback: ${e.message}`);
			expect(value).toBe("Fallback: Async error");
		});
	});

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
				success: (data) => `Got: ${data}`,
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
				success: (data) => `Got: ${data}`,
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

	describe(retry, () => {
		test("returns success immediately if first attempt succeeds", async () => {
			let attempts = 0;
			let result = await retry(
				async () => {
					attempts++;
					return success(42);
				},
				{ times: 3, delay: 10 },
			);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toBe(42);
			}
			expect(attempts).toBe(1);
		});

		test("retries until success", async () => {
			let attempts = 0;
			let result = await retry(
				async () => {
					attempts++;
					if (attempts < 3) {
						return failure(new Error(`Attempt ${attempts} failed`));
					}
					return success(42);
				},
				{ times: 5, delay: 10 },
			);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toBe(42);
			}
			expect(attempts).toBe(3);
		});

		test("returns failure after max retries exceeded", async () => {
			let attempts = 0;
			let result = await retry(
				async () => {
					attempts++;
					return failure(new Error(`Attempt ${attempts} failed`));
				},
				{ times: 3, delay: 10 },
			);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.message).toBe("Failed after 3 attempts");
			}
			expect(attempts).toBe(3);
		});

		test("stops retrying when `when` predicate returns false", async () => {
			class RetryableError extends Error {
				retryable = true;
			}
			class FatalError extends Error {
				retryable = false;
			}

			let attempts = 0;
			let result = await retry(
				async () => {
					attempts++;
					if (attempts === 2) {
						return failure(new FatalError("Fatal error"));
					}
					return failure(new RetryableError("Retryable error"));
				},
				{
					times: 5,
					delay: 10,
					when: (error) => error instanceof RetryableError,
				},
			);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.message).toBe("Failed after 2 attempts");
			}
			expect(attempts).toBe(2);
		});

		test("`when` predicate receives error and attempt number", async () => {
			let receivedAttempts: number[] = [];
			let result = await retry(
				async () => {
					return failure(new Error("Always fails"));
				},
				{
					times: 3,
					delay: 10,
					when: (_, attempts) => {
						receivedAttempts.push(attempts);
						return attempts < 2;
					},
				},
			);

			expect(isFailure(result)).toBe(true);
			expect(receivedAttempts).toEqual([1, 2]);
		});

		test("uses constant backoff strategy", async () => {
			let timestamps: number[] = [];
			await retry(
				async () => {
					timestamps.push(Date.now());
					if (timestamps.length < 4) {
						return failure(new Error("Fail"));
					}
					return success("done");
				},
				{ times: 5, delay: 50, backoff: "constant" },
			);

			// Check delays are roughly constant (50ms each)
			for (let i = 1; i < timestamps.length; i++) {
				let diff = timestamps[i] - timestamps[i - 1];
				expect(diff).toBeGreaterThanOrEqual(40);
				expect(diff).toBeLessThan(100);
			}
		});

		test("uses linear backoff strategy", async () => {
			let timestamps: number[] = [];
			await retry(
				async () => {
					timestamps.push(Date.now());
					if (timestamps.length < 4) {
						return failure(new Error("Fail"));
					}
					return success("done");
				},
				{ times: 5, delay: 20, backoff: "linear" },
			);

			// Delays should be: 20, 40, 60 (delay * attempt)
			let delays: number[] = [];
			for (let i = 1; i < timestamps.length; i++) {
				delays.push(timestamps[i] - timestamps[i - 1]);
			}
			// First delay ~20ms, second ~40ms, third ~60ms
			expect(delays[0]).toBeLessThan(delays[1]);
			expect(delays[1]).toBeLessThan(delays[2]);
		});

		test("uses exponential backoff strategy (default)", async () => {
			let timestamps: number[] = [];
			await retry(
				async () => {
					timestamps.push(Date.now());
					if (timestamps.length < 4) {
						return failure(new Error("Fail"));
					}
					return success("done");
				},
				{ times: 5, delay: 20 },
			);

			// Delays should be: 20, 40, 80 (delay * 2^(attempt-1))
			let delays: number[] = [];
			for (let i = 1; i < timestamps.length; i++) {
				delays.push(timestamps[i] - timestamps[i - 1]);
			}
			expect(delays[0]).toBeLessThan(delays[1]);
			expect(delays[1]).toBeLessThan(delays[2]);
		});

		test("accepts string delay parsed by ms", async () => {
			let timestamps: number[] = [];
			await retry(
				async () => {
					timestamps.push(Date.now());
					if (timestamps.length < 2) {
						return failure(new Error("Fail"));
					}
					return success("done");
				},
				{ times: 3, delay: "50ms", backoff: "constant" },
			);

			let diff = timestamps[1] - timestamps[0];
			expect(diff).toBeGreaterThanOrEqual(40);
			expect(diff).toBeLessThan(100);
		});

		test("accepts string delay with seconds", async () => {
			let start = Date.now();
			await retry(
				async () => {
					if (Date.now() - start < 50) {
						return failure(new Error("Fail"));
					}
					return success("done");
				},
				{ times: 3, delay: "0.1s", backoff: "constant" },
			);

			let elapsed = Date.now() - start;
			expect(elapsed).toBeGreaterThanOrEqual(90);
		});
	});

	describe(wrap, () => {
		test("returns success for sync function that succeeds", () => {
			let result = wrap(() => 42);
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toBe(42);
			}
		});

		test("returns success with complex type", () => {
			let result = wrap(() => ({ id: 1, name: "Test" }));
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toEqual({ id: 1, name: "Test" });
			}
		});

		test("returns failure for sync function that throws", () => {
			let result = wrap(() => {
				throw new Error("Sync error");
			});
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.message).toBe("Sync error");
			}
		});

		test("returns failure with the thrown error instance", () => {
			class CustomError extends Error {
				code: string;
				constructor(message: string, code: string) {
					super(message);
					this.code = code;
				}
			}

			let result = wrap(() => {
				throw new CustomError("Custom error", "E001");
			});
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(CustomError);
				expect((result.error as CustomError).code).toBe("E001");
			}
		});

		test("wraps non-Error throws into Error", () => {
			let result = wrap(() => {
				throw "string error";
			});
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(Error);
			}
		});

		test("returns success for async function that succeeds", async () => {
			let result = await wrap(async () => 42);
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toBe(42);
			}
		});

		test("returns success for async function with delay", async () => {
			let result = await wrap(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return "delayed";
			});
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data).toBe("delayed");
			}
		});

		test("returns failure for async function that throws", async () => {
			let result = await wrap(async () => {
				throw new Error("Async error");
			});
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.message).toBe("Async error");
			}
		});

		test("returns failure for async function that rejects", async () => {
			let result = await wrap(async () => {
				return Promise.reject(new Error("Rejected"));
			});
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.message).toBe("Rejected");
			}
		});

		test("can wrap JSON.parse", () => {
			let validResult = wrap(() => JSON.parse('{"a": 1}'));
			expect(isSuccess(validResult)).toBe(true);
			if (isSuccess(validResult)) {
				expect(validResult.data).toEqual({ a: 1 });
			}

			let invalidResult = wrap(() => JSON.parse("invalid json"));
			expect(isFailure(invalidResult)).toBe(true);
		});

		test("can wrap fetch", async () => {
			// This test assumes fetch might fail with invalid URL
			let result = await wrap(async () => {
				throw new Error("Network error");
			});
			expect(isFailure(result)).toBe(true);
		});
	});

	describe(partition, () => {
		test("separates successes and failures", () => {
			let results: Result<number, Error>[] = [
				success(1),
				failure(new Error("Error 1")),
				success(2),
				failure(new Error("Error 2")),
				success(3),
			];

			let [successes, failures] = partition(results);

			expect(successes).toEqual([1, 2, 3]);
			expect(failures.map((e) => e.message)).toEqual(["Error 1", "Error 2"]);
		});

		test("returns empty arrays for empty input", () => {
			let [successes, failures] = partition([]);
			expect(successes).toEqual([]);
			expect(failures).toEqual([]);
		});

		test("handles all successes", () => {
			let results: Result<number, Error>[] = [success(1), success(2), success(3)];

			let [successes, failures] = partition(results);

			expect(successes).toEqual([1, 2, 3]);
			expect(failures).toEqual([]);
		});

		test("handles all failures", () => {
			let results: Result<number, Error>[] = [
				failure(new Error("Error 1")),
				failure(new Error("Error 2")),
			];

			let [successes, failures] = partition(results);

			expect(successes).toEqual([]);
			expect(failures.map((e) => e.message)).toEqual(["Error 1", "Error 2"]);
		});

		test("preserves order within each group", () => {
			let results: Result<string, Error>[] = [
				success("a"),
				success("b"),
				failure(new Error("x")),
				success("c"),
				failure(new Error("y")),
			];

			let [successes, failures] = partition(results);

			expect(successes).toEqual(["a", "b", "c"]);
			expect(failures.map((e) => e.message)).toEqual(["x", "y"]);
		});

		test("works with complex types", () => {
			interface User {
				id: number;
				name: string;
			}

			let results: Result<User, Error>[] = [
				success({ id: 1, name: "Alice" }),
				failure(new Error("User not found")),
				success({ id: 2, name: "Bob" }),
			];

			let [users, errors] = partition(results);

			expect(users).toEqual([
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			]);
			expect(errors).toHaveLength(1);
		});

		test("can be used after Promise.all", async () => {
			async function fetchUser(id: number): Promise<Result<{ id: number }, Error>> {
				if (id === 2) {
					return failure(new Error(`User ${id} not found`));
				}
				return success({ id });
			}

			let results = await Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
			let [users, errors] = partition(results);

			expect(users).toEqual([{ id: 1 }, { id: 3 }]);
			expect(errors).toHaveLength(1);
		});
	});
});
