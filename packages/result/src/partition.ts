import type { Result, Success, Failure } from "./types.js";

import { isFailure } from "./is-failure.js";
import { isSuccess } from "./is-success.js";

/**
 * Split an array of Results into a tuple of [successValues, failureErrors].
 * Single pass through the array.
 */
export function partition<T, E extends Error>(results: Result<T, E>[]): [T[], E[]] {
	let { successes, failures } = results.reduce(
		(sets, result) => {
			if (isSuccess(result)) sets.successes.add(result);
			if (isFailure(result)) sets.failures.add(result);
			return sets;
		},
		{ successes: new Set<Success<T>>(), failures: new Set<Failure<E>>() },
	);

	return [
		Array.from(successes, (result) => result.data),
		Array.from(failures, (result) => result.error),
	];
}
