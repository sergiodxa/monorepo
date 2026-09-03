/**
 * A cache interface that records instead of calling a platform, so purge
 * behavior can be asserted on outcomes — which selectors were sent, in which
 * order — and a failure path can be exercised without a network or a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheInterface, PurgeSelector } from "./types.js";

/** Configuration for a recording cache. */
export interface RecordingCacheOptions {
	/** When set, every purge rejects with this error until `reset()` clears it. */
	failWith?: Error;
}

/** A cache interface that records the purges it received. */
export interface RecordingCache extends CacheInterface {
	/** Every selector passed to `purge()`, in call order. */
	readonly purges: readonly PurgeSelector[];
	/** Tags from every tag purge, flattened, in call order. */
	readonly purgedTags: readonly string[];
	/** Makes every later purge reject with this error, to exercise failure paths. */
	failWith(error: Error): void;
	/** Drops the recorded purges and any configured failure. */
	reset(): void;
}

/**
 * Builds a recording cache for tests.
 *
 * The package's contract is the purge calls it sends, so recording those calls
 * is enough to assert on selectors, order, and failure handling.
 *
 * @param options - Optional initial failure; see {@link RecordingCacheOptions}.
 * @returns A cache interface with the calls it received exposed.
 * @example
 * let cache = createRecordingCache();
 * await purge(cache, { tags: [TAGS.postList()] });
 * cache.purgedTags; // ["posts"]
 * @example
 * let cache = createRecordingCache({ failWith: new Error("edge unavailable") });
 */
export function createRecordingCache(options: RecordingCacheOptions = {}): RecordingCache {
	let purges: PurgeSelector[] = [];
	let rejection = options.failWith;

	return {
		purges,

		get purgedTags(): readonly string[] {
			return purges.flatMap((selector) => selector.tags ?? []);
		},

		/**
		 * Records the selector, then rejects when a failure is configured, so the
		 * call is observable whether or not it succeeded.
		 */
		async purge(selector: PurgeSelector): Promise<void> {
			purges.push(selector);
			if (rejection) throw rejection;
		},

		failWith(error: Error): void {
			rejection = error;
		},

		reset(): void {
			purges.length = 0;
			rejection = undefined;
		},
	};
}
