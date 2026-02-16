import type { Result } from "./types.js";

import { isSuccess } from "./is-success.js";

/**
 * Extract the success value from a Result, or throw/compute a fallback on failure.
 * Accepts both sync and async Results.
 *
 * @param result - The Result (or Promise of Result) to unwrap
 * @param fallback - Optional function to compute a fallback value from the error
 * @returns The success data, or the fallback value if provided and Result is a Failure
 * @throws The error from the Failure if no fallback is provided
 *
 * @example
 * ```ts
 * let data = unwrap(success(42)); // 42
 * let data = unwrap(failure(new Error("oops"))); // throws Error("oops")
 * ```
 *
 * @example
 * ```ts
 * // With fallback
 * let count = unwrap(failure(new Error("not found")), () => 0); // 0
 * let message = unwrap(failure(error), (e) => e.message); // error.message
 * ```
 *
 * @example
 * ```ts
 * // With async Results
 * let user = await unwrap(fetchUser(id));
 * let user = await unwrap(fetchUser(id), () => defaultUser);
 * ```
 */
export function unwrap<T, E extends Error>(result: Result<T, E>, fallback?: (error: E) => T): T;
export function unwrap<T, E extends Error>(
	result: Promise<Result<T, E>>,
	fallback?: (error: E) => T,
): Promise<T>;
export function unwrap<T, E extends Error>(
	result: Result<T, E> | Promise<Result<T, E>>,
	fallback?: (error: E) => T,
): T | Promise<T> {
	if (result instanceof Promise) return result.then((res) => unwrap(res, fallback));
	if (isSuccess(result)) return result.data;
	if (fallback) return fallback(result.error);
	throw result.error;
}
