import ms from "ms";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { isSuccess } from "./is-success.js";

/**
 * Error thrown when all retry attempts have been exhausted.
 * Contains information about how many attempts were made before giving up.
 *
 * @example
 * ```ts
 * let result = await retry(() => fetchData(), { times: 3, delay: "100ms" });
 * if (isFailure(result) && result.error instanceof RetryError) {
 *   console.log(result.error.message); // "Failed after 3 attempts"
 * }
 * ```
 */
export class RetryError extends Error {
	override name = "RetryError";

	/**
	 * Create a new RetryError.
	 * @param attempts - The number of attempts made before failing
	 */
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
 * Retries until success, max attempts exceeded, or `when` predicate returns false.
 *
 * @param fn - Async function that returns a Result
 * @param options - Retry configuration
 * @param options.times - Maximum number of retry attempts
 * @param options.delay - Base delay between retries (number in ms or string like "100ms", "1s")
 * @param options.backoff - Backoff strategy: "constant", "linear", or "exponential" (default)
 * @param options.when - Optional predicate to decide if error should be retried
 * @returns The successful Result, or a Failure with RetryError after all attempts exhausted
 *
 * @example
 * ```ts
 * let result = await retry(
 *   () => fetchData(url),
 *   { times: 3, delay: "100ms" }
 * );
 * ```
 *
 * @example
 * ```ts
 * // Only retry on network errors
 * let result = await retry(
 *   () => fetchData(url),
 *   {
 *     times: 5,
 *     delay: "1s",
 *     backoff: "exponential",
 *     when: (error) => error instanceof NetworkError,
 *   }
 * );
 * ```
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
