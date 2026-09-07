/**
 * Runs the two kinds of work a cache does that can fail: a store operation, and
 * the loader a `fetch` was given. A store failure is recorded on the invocation's
 * log, because store health is the package's own to report; a loader's is not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, success } from "@sdxc/result";

import { CacheError } from "../errors.js";

/** The operations a store performs, which name the log entry a failure writes. */
export type StoreOperation = "read" | "write" | "delete";

/**
 * @param operation What was being attempted.
 * @param key The entry it was attempted on.
 * @param work The store operation.
 * @returns What the store answered, or `unavailable` when it could not.
 */
export async function attempt<T>(
	operation: StoreOperation,
	key: string,
	work: () => Promise<T>,
): Promise<Result<T, CacheError>> {
	try {
		return success(await work());
	} catch (cause) {
		let reason = cause instanceof Error ? cause.message : String(cause);
		currentLog()?.warn(`cache.${operation}.failed`, { key, reason });

		return failure(
			new CacheError(`The store could not ${operation} ${key}: ${reason}`, {
				code: "unavailable",
				key,
				cause,
			}),
		);
	}
}

/**
 * Runs the loader a `fetch` was given.
 *
 * Nothing is logged: the failure is the caller's own and travels in the `Result`,
 * where the original error is reachable as `cause`.
 *
 * @param key The entry the value was being computed for.
 * @param produce Computes the value.
 * @returns The value, or `load_failed` when the loader threw.
 */
export async function attemptLoad<T>(
	key: string,
	produce: () => Promise<T>,
): Promise<Result<T, CacheError>> {
	try {
		return success(await produce());
	} catch (cause) {
		let reason = cause instanceof Error ? cause.message : String(cause);

		return failure(
			new CacheError(`The value for ${key} could not be computed: ${reason}`, {
				code: "load_failed",
				key,
				cause,
			}),
		);
	}
}
