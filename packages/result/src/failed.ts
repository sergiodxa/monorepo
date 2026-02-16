import type { Result, Failure } from "./types.js";

import { isSuccess } from "./is-success.js";

/**
 * Assert that a Result is a Failure, throwing an error if it's a Success.
 * After calling this function, TypeScript narrows the type to Failure.
 *
 * @param result - The Result to assert
 * @param message - Custom error message if the assertion fails (default: "Result is a success")
 * @throws Error with the original data as `cause` if the Result is a Success
 *
 * @example
 * ```ts
 * let result: Result<User, NotFoundError> = await fetchUser(id);
 * failed(result); // Throws if success
 * console.log(result.error.message); // TypeScript knows result is Failure<NotFoundError>
 * ```
 *
 * @example
 * ```ts
 * // Useful in tests to assert expected failures
 * let result = validate({ email: "invalid" });
 * failed(result, "Expected validation to fail");
 * expect(result.error).toBeInstanceOf(ValidationError);
 * ```
 */
export function failed<T, E extends Error>(
	result: Result<T, E>,
	message = "Result is a success",
): asserts result is Failure<E> {
	if (isSuccess(result)) throw new Error(message, { cause: result.data });
}
