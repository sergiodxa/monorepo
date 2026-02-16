import type { Success } from "./types.js";

export function success<T>(data: T): Success<T> {
	return { status: "success", data };
}
