import type { Result, Success } from "./types.js";

import { isFailure } from "./is-failure.js";

export function succeeded<T, E extends Error>(
	result: Result<T, E>,
	message = "Result is a failure",
): asserts result is Success<T> {
	if (isFailure(result)) throw new Error(message, { cause: result.error });
}
