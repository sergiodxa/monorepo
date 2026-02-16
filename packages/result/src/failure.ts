import type { Failure } from "./types.js";

export function failure<E extends Error>(error: E): Failure<E> {
	return { status: "failure", error };
}
