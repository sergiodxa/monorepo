/**
 * Shared types for the Result discriminated union: Success, Failure, and
 * the Result type itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Represents a successful operation containing the result data.
 *
 * @template T - The type of the success value
 *
 * @example
 * ```ts
 * let result: Success<number> = { status: "success", data: 42 };
 * ```
 */
export interface Success<T> {
	status: "success";
	data: T;
}

/**
 * Represents a failed operation containing an error.
 *
 * @template E - The error type (must extend Error)
 *
 * @example
 * ```ts
 * let result: Failure<NotFoundError> = { status: "failure", error: new NotFoundError() };
 * ```
 */
export interface Failure<E extends Error> {
	status: "failure";
	error: E;
}

/**
 * A discriminated union representing either a successful result or a failure.
 * Use `isSuccess`/`isFailure` to narrow the type before accessing data or error.
 *
 * @template T - The type of the success value
 * @template E - The error type (must extend Error)
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number, Error> {
 *   if (b === 0) return failure(new Error("Division by zero"));
 *   return success(a / b);
 * }
 *
 * let result = divide(10, 2);
 * if (isSuccess(result)) {
 *   console.log(result.data); // 5
 * }
 * ```
 */
export type Result<T, E extends Error> = Success<T> | Failure<E>;
