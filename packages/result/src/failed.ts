import type { Result, Failure } from "./types.js";

import { isSuccess } from "./is-success.js";

export function failed<T, E extends Error>(
	result: Result<T, E>,
	message = "Result is a success",
): asserts result is Failure<E> {
	if (isSuccess(result)) throw new Error(message, { cause: result.data });
}
