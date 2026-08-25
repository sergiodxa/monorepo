/**
 * Assertion helper that narrows a Result to Success or throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result, Success } from "./types.js";

import { isFailure } from "./is-failure.js";

/**
 * Assert that a Result is a Success, throwing an error if it's a Failure.
 * After calling this function, TypeScript narrows the type to Success.
 *
 * @param result - The Result to assert
 * @param message - Custom error message if the assertion fails (default: "Result is a failure")
 * @throws Error with the original error as `cause` if the Result is a Failure
 *
 * @example
 * ```ts
 * let result: Result<User, Error> = await fetchUser(id);
 * succeeded(result); // Throws if failure
 * console.log(result.data.name); // TypeScript knows result is Success<User>
 * ```
 *
 * @example
 * ```ts
 * succeeded(result, "Failed to load user data");
 * ```
 */
export function succeeded<T, E extends Error>(
	result: Result<T, E>,
	message = "Result is a failure",
): asserts result is Success<T> {
	if (isFailure(result)) throw new Error(message, { cause: result.error });
}
