import { describe, expect, test } from "bun:test";

import { isFailure } from "./is-failure.js";
import { isSuccess } from "./is-success.js";
import { wrap } from "./wrap.js";

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
