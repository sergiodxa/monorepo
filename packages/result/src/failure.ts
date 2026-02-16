import type { Failure } from "./types.js";

/**
 * Create a Failure Result containing the given error.
 *
 * @param error - The error to wrap in a Failure Result
 * @returns A Failure Result containing the error
 *
 * @example
 * ```ts
 * let error = failure(new Error("Not found"));
 * // { status: "failure", error: Error("Not found") }
 * ```
 *
 * @example
 * ```ts
 * function fetchUser(id: string): Result<User, NotFoundError> {
 *   let user = db.find(id);
 *   if (!user) return failure(new NotFoundError(`User ${id} not found`));
 *   return success(user);
 * }
 * ```
 */
export function failure<E extends Error>(error: E): Failure<E> {
	return { status: "failure", error };
}
