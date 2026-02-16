import type { Success } from "./types.js";

/**
 * Create a Success Result containing the given data.
 *
 * @param data - The value to wrap in a Success Result
 * @returns A Success Result containing the data
 *
 * @example
 * ```ts
 * let user = success({ id: 1, name: "Alice" });
 * // { status: "success", data: { id: 1, name: "Alice" } }
 * ```
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number, Error> {
 *   if (b === 0) return failure(new Error("Division by zero"));
 *   return success(a / b);
 * }
 * ```
 */
export function success<T>(data: T): Success<T> {
	return { status: "success", data };
}
