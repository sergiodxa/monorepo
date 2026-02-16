import type { Result } from "./types.js";

import { isSuccess } from "./is-success.js";

/**
 * Extract the success value from a Result.
 * - If the Result is a success, returns the data.
 * - If the Result is a failure and no fallback is provided, throws the error.
 * - If the Result is a failure and a fallback is provided, calls the fallback with the error.
 *
 * Accepts both sync and async Results.
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
