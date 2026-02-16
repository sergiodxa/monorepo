import type { Result } from "./types.js";

import { isSuccess } from "./is-success.js";

/**
 * Pattern match on a Result, calling the appropriate handler based on its status.
 * Accepts both sync and async Results.
 *
 * @param result - The Result (or Promise of Result) to match on
 * @param handlers - Object with `success` and `failure` handler functions
 * @param handlers.success - Called with the data if Result is a Success
 * @param handlers.failure - Called with the error if Result is a Failure
 * @returns The return value of the matched handler
 *
 * @example
 * ```ts
 * let message = match(result, {
 *   success: (user) => `Hello, ${user.name}!`,
 *   failure: (error) => `Error: ${error.message}`,
 * });
 * ```
 *
 * @example
 * ```ts
 * // Transform Result to a different type
 * let status = match(result, {
 *   success: () => 200,
 *   failure: (e) => e instanceof NotFoundError ? 404 : 500,
 * });
 * ```
 *
 * @example
 * ```ts
 * // With async Results
 * let response = await match(fetchUser(id), {
 *   success: (user) => json(user),
 *   failure: (error) => json({ error: error.message }, { status: 404 }),
 * });
 * ```
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
