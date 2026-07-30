/**
 * Retry helper for `Result`-returning async functions. It re-runs an operation
 * until it succeeds, its attempt budget is spent, or a predicate declines the
 * error, waiting a constant, linear, or exponential delay between attempts.
 * Delays are plain milliseconds so this module stays dependency-free.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { isSuccess } from "./is-success.js";

/**
 * Backoff strategy applied when a caller does not choose one.
 */
const DEFAULT_BACKOFF = "exponential";

/**
 * Factor the exponential strategy raises to the attempt number, so the delay
 * doubles on every retry.
 */
const EXPONENTIAL_BACKOFF_FACTOR = 2;

/**
 * Error thrown when all retry attempts have been exhausted.
 * Contains information about how many attempts were made before giving up.
 *
 * @example
 * ```ts
 * let result = await retry(() => fetchData(), { times: 3, delay: 100 });
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
		/**
		 * Base delay between retries, in milliseconds. Milliseconds keep this
		 * module free of a duration parser; name the unit at the call site with a
		 * module-level constant (e.g. `5 * SECOND_MS`) when the number is large.
		 */
		delay: number;
		/**
		 * Backoff strategy.
		 * @default "exponential"
		 */
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
 * @param options.delay - Base delay between retries, in milliseconds
 * @param options.backoff - Backoff strategy: "constant", "linear", or "exponential" (default: "exponential")
 * @param options.when - Optional predicate to decide if error should be retried
 * @returns The successful Result, or a Failure with RetryError after all attempts exhausted
 *
 * @example
 * ```ts
 * let result = await retry(
 *   () => fetchData(url),
 *   { times: 3, delay: 100 }
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
 *     delay: 1000,
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
	if (typeof options.delay !== "number") {
		throw new TypeError("Delay must be a number of milliseconds");
	}

	let attempts = 0;

	while (attempts < options.times) {
		let result = await fn();
		if (isSuccess(result)) return result;
		attempts++;
		if (options.when && !options.when(result.error, attempts)) break;

		let backoff = options.backoff ?? DEFAULT_BACKOFF;

		// "constant" repeats the base delay, so it needs no adjustment.
		let delay = options.delay;
		if (backoff === "linear") delay = options.delay * attempts;
		if (backoff === "exponential") {
			delay = options.delay * EXPONENTIAL_BACKOFF_FACTOR ** (attempts - 1);
		}

		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	return failure(new RetryError(attempts));
}
