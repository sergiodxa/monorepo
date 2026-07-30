/**
 * Unit tests for the retry helper. They cover the attempt budget, the `when`
 * predicate, and the timing produced by each backoff strategy, so the delay
 * math and the loop's exit conditions cannot regress.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { failure } from "./failure.js";
import { isFailure } from "./is-failure.js";
import { isSuccess } from "./is-success.js";
import { retry } from "./retry.js";
import { success } from "./success.js";

/**
 * One second in milliseconds, the unit `retry`'s `delay` counts in, so delays
 * written here keep their unit visible.
 */
const SECOND_MS = 1_000;

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
			{ times: 5, delay: 50, backoff: "linear" },
		);

		// Delays should be: 50, 100, 150 (delay * attempt)
		let delays: number[] = [];
		for (let i = 1; i < timestamps.length; i++) {
			delays.push(timestamps[i] - timestamps[i - 1]);
		}
		// Check delays are in expected ranges with tolerance for timing jitter
		expect(delays[0]).toBeGreaterThanOrEqual(40);
		expect(delays[0]).toBeLessThan(80);
		expect(delays[1]).toBeGreaterThanOrEqual(90);
		expect(delays[1]).toBeLessThan(130);
		expect(delays[2]).toBeGreaterThanOrEqual(140);
		expect(delays[2]).toBeLessThan(180);
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
			{ times: 5, delay: 50 },
		);

		// Delays should be: 50, 100, 200 (delay * 2^(attempt-1))
		let delays: number[] = [];
		for (let i = 1; i < timestamps.length; i++) {
			delays.push(timestamps[i] - timestamps[i - 1]);
		}
		// Check delays are in expected ranges with tolerance for timing jitter
		expect(delays[0]).toBeGreaterThanOrEqual(40);
		expect(delays[0]).toBeLessThan(80);
		expect(delays[1]).toBeGreaterThanOrEqual(90);
		expect(delays[1]).toBeLessThan(130);
		expect(delays[2]).toBeGreaterThanOrEqual(190);
		expect(delays[2]).toBeLessThan(230);
	});

	test("waits the delay expressed in milliseconds", async () => {
		let timestamps: number[] = [];
		await retry(
			async () => {
				timestamps.push(Date.now());
				if (timestamps.length < 2) {
					return failure(new Error("Fail"));
				}
				return success("done");
			},
			{ times: 3, delay: 50, backoff: "constant" },
		);

		let diff = timestamps[1] - timestamps[0];
		expect(diff).toBeGreaterThanOrEqual(40);
		expect(diff).toBeLessThan(100);
	});

	test("waits a delay composed from a named unit constant", async () => {
		let start = Date.now();
		await retry(
			async () => {
				if (Date.now() - start < 50) {
					return failure(new Error("Fail"));
				}
				return success("done");
			},
			{ times: 3, delay: 0.1 * SECOND_MS, backoff: "constant" },
		);

		let elapsed = Date.now() - start;
		expect(elapsed).toBeGreaterThanOrEqual(90);
	});

	test("rejects a delay that is not a number", async () => {
		// The cast bypasses the compile-time type on purpose: the guard exists for
		// untyped callers, and a duration string is no longer accepted.
		let delay = "100ms" as unknown as number;

		await expect(retry(async () => success("done"), { times: 3, delay })).rejects.toThrow(
			TypeError,
		);
	});
});
