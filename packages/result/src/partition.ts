import type { Result, Success, Failure } from "./types.js";

import { isFailure } from "./is-failure.js";
import { isSuccess } from "./is-success.js";

/**
 * Split an array of Results into separate success values and failure errors.
 * Processes the array in a single pass for efficiency.
 *
 * @param results - Array of Result objects to partition
 * @returns Tuple of [successValues, failureErrors] where successValues contains
 *          all data from Success results and failureErrors contains all errors from Failure results
 *
 * @example
 * ```ts
 * let results = [success(1), failure(new Error("a")), success(2)];
 * let [values, errors] = partition(results);
 * // values = [1, 2]
 * // errors = [Error("a")]
 * ```
 *
 * @example
 * ```ts
 * // Process multiple async operations and separate successes from failures
 * let results = await Promise.all(urls.map((url) => wrap(() => fetch(url))));
 * let [responses, errors] = partition(results);
 * console.log(`${responses.length} succeeded, ${errors.length} failed`);
 * ```
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
