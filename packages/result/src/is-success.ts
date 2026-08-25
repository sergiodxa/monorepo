/**
 * Type guard for narrowing a `Result` to its `Success` case.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result, Success } from "./types.js";

/**
 * Check if a Result is a Success and narrow its type.
 *
 * @param result - The Result to check
 * @returns `true` if the Result is a Success, `false` otherwise
 *
 * @example
 * ```ts
 * let result = success(42);
 * if (isSuccess(result)) {
 *   console.log(result.data); // TypeScript knows `data` exists
 * }
 * ```
 *
 * @example
 * ```ts
 * let result = await fetchUser(id);
 * if (isSuccess(result)) return json(result.data);
 * return json({ error: result.error.message }, { status: 404 });
 * ```
 */
export function isSuccess<T, E extends Error>(result: Result<T, E>): result is Success<T> {
	return result.status === "success";
}
