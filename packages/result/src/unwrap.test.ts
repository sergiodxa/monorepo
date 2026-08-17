import { describe, expect, test } from "bun:test";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { success } from "./success.js";
import { unwrap } from "./unwrap.js";

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
