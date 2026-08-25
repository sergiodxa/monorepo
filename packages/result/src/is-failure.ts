/**
 * Type guard for narrowing a `Result` to its Failure branch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result, Failure } from "./types.js";

/**
 * Check if a Result is a Failure and narrow its type.
 *
 * @param result - The Result to check
 * @returns `true` if the Result is a Failure, `false` otherwise
 *
 * @example
 * ```ts
 * let result = failure(new Error("Not found"));
 * if (isFailure(result)) {
 *   console.log(result.error.message); // TypeScript knows `error` exists
 * }
 * ```
 *
 * @example
 * ```ts
 * let result = await fetchUser(id);
 * if (isFailure(result)) return redirect("/login");
 * return json(result.data);
 * ```
 */
export function isFailure<T, E extends Error>(result: Result<T, E>): result is Failure<E> {
	return result.status === "failure";
}
