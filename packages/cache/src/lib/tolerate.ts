/**
 * Runs a store operation that is allowed to fail, so an unreachable store reads
 * as a miss instead of an error. A cache is an optimization, and the only
 * recovery from a failed read is to compute the value, which the caller does anyway.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";

/**
 * Answers with `fallback` when the store cannot, recording why on the invocation's
 * log so a store that is down is visible as something other than a cache that
 * never hits.
 *
 * @param event What was being attempted, dotted lowercase.
 * @param key The entry it was attempted on.
 * @param fallback What to answer with when it fails.
 * @param work The store operation.
 * @returns The operation's result, or `fallback`.
 */
export async function tolerate<T>(
	event: string,
	key: string,
	fallback: T,
	work: () => Promise<T>,
): Promise<T> {
	try {
		return await work();
	} catch (error) {
		currentLog()?.warn(event, {
			key,
			reason: error instanceof Error ? error.message : String(error),
		});
		return fallback;
	}
}
