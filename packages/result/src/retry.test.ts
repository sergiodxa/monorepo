import { describe, expect, test } from "bun:test";

import { failure } from "./failure.js";
import { isFailure } from "./is-failure.js";
import { isSuccess } from "./is-success.js";
import { retry } from "./retry.js";
import { success } from "./success.js";

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
