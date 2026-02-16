import type { Result, Success } from "./types.js";

export function isSuccess<T, E extends Error>(result: Result<T, E>): result is Success<T> {
	return result.status === "success";
}
