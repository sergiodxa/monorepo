import type { Result } from "./types.js";

import { isSuccess } from "./is-success.js";

/**
 * Pattern match on a Result, calling the appropriate handler based on the status.
 *
 * Accepts both sync and async Results.
 */
export function match<T, E extends Error, R>(
	result: Result<T, E>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): R;
export function match<T, E extends Error, R>(
	result: Promise<Result<T, E>>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): Promise<R>;
export function match<T, E extends Error, R>(
	result: Result<T, E> | Promise<Result<T, E>>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): R | Promise<R> {
	if (result instanceof Promise) return result.then((res) => match(res, handlers));
	if (isSuccess(result)) return handlers.success(result.data);
	return handlers.failure(result.error);
}
