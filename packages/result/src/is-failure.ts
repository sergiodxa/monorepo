import type { Result, Failure } from "./types.js";

export function isFailure<T, E extends Error>(result: Result<T, E>): result is Failure<E> {
	return result.status === "failure";
}
