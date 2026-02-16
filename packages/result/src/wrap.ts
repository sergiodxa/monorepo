import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { success } from "./success.js";

export namespace wrap {
	export type IsAny<T> = 0 extends 1 & T ? true : false;

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
 * Wrap a throwing function into a Result-returning function.
 * - If the function succeeds, returns success(value).
 * - If the function throws, returns failure(error).
 *
 * Handles both sync and async functions.
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
