import ms from "ms";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { isSuccess } from "./is-success.js";

export class RetryError extends Error {
	override name = "RetryError";
	constructor(attempts: number) {
		super(`Failed after ${attempts} attempts`);
	}
}

export namespace retry {
	export interface Options<E extends Error> {
		/** Maximum number of retry attempts */
		times: number;
		/** Delay between retries. Can be a number (ms) or a string parsed by ms (e.g. "100ms", "1s") */
		delay: number | ms.StringValue;
		/** Backoff strategy. Default: "exponential" */
		backoff?: "constant" | "linear" | "exponential";
		/** Optional predicate to determine if a retry should be attempted. Receives the error and attempt number. */
		when?: (error: E, attempts: number) => boolean;
	}
}

/**
 * Retry a Result-returning async function with configurable backoff.
 *
 * - Retries until success, `times` is exceeded, or `when` returns false.
 * - Delay calculation:
 *   - constant: delay
 *   - linear: delay * attempt
 *   - exponential: delay * 2^(attempt-1)
 */
export async function retry<T, E extends Error>(
	fn: () => Promise<Result<T, E>>,
	options: retry.Options<E>,
): Promise<Result<T, E | RetryError>> {
	if (options.times <= 0) throw new RangeError("Retry times must be greater than 0");
	if (typeof options.delay !== "number" && typeof options.delay !== "string") {
		throw new TypeError("Delay must be a number or a string");
	}

	let attempts = 0;

	while (attempts < options.times) {
		let result = await fn();
		if (isSuccess(result)) return result;
		attempts++;
		if (options.when && !options.when(result.error, attempts)) break;

		let delay: number;
		if (options.backoff === "constant") {
			if (typeof options.delay === "number") delay = options.delay;
			else if (typeof options.delay === "string") delay = ms(options.delay);
			else throw new TypeError("Delay must be a number or a string");
		}

		if (options.backoff === "linear") {
			if (typeof options.delay === "number") delay = options.delay * attempts;
			else if (typeof options.delay === "string") delay = ms(options.delay) * attempts;
			else throw new TypeError("Delay must be a number or a string");
		}

		if (options.backoff === "exponential" || !options.backoff) {
			if (typeof options.delay === "number") delay = options.delay * 2 ** (attempts - 1);
			else if (typeof options.delay === "string") delay = ms(options.delay) * 2 ** (attempts - 1);
			else throw new TypeError("Delay must be a number or a string");
		}

		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	return failure(new RetryError(attempts));
}
