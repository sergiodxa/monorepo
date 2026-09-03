/**
 * Converts throwing functions into Result-returning functions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IsAny } from "@sdxc/types";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { success } from "./success.js";

export namespace wrap {
	/**
	 * Computes `Result<any, Error>` for `any`, `Result<never, Error>` for
	 * `never`, `Promise<Result<T, Error>>` for promises, and
	 * `Result<T, Error>` for other sync return types.
	 */
	export type ReturnType<T> =
		IsAny<T> extends true
			? Result<any, Error>
			: [T] extends [never]
				? Result<never, Error>
				: T extends PromiseLike<infer U>
					? Promise<Result<U, Error>>
					: Result<T, Error>;
}

/**
 * Convert a throwing function into a Result-returning function.
 * Catches exceptions and returns them as Failure values.
 *
 * @param fn - Function to wrap (can be sync or async)
 * @returns Success with the value if fn succeeds, Failure with Error if fn throws
 *
 * @example
 * ```ts
 * // Sync function
 * let result = wrap(() => JSON.parse('{"valid": true}'));
 * if (isSuccess(result)) console.log(result.data); // { valid: true }
 * ```
 *
 * @example
 * ```ts
 * // Async function
 * let result = await wrap(() => fetch("/api/data").then((r) => r.json()));
 * if (isFailure(result)) console.error(result.error.message);
 * ```
 */
export function wrap<T>(fn: () => T): wrap.ReturnType<T>;
export function wrap(fn: () => unknown): Result<unknown, Error> | Promise<Result<unknown, Error>> {
	try {
		let result = fn();
		if (result instanceof Promise) return result.then(success).catch(failure);
		return success(result);
	} catch (error) {
		if (error instanceof Error) return failure(error);
		return failure(new Error(String(error)));
	}
}
