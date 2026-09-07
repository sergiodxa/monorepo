/**
 * The cache contract every adapter implements: read, write, fetch and delete
 * over string keys. The value's type is taken per call rather than per instance,
 * so one instance serves a whole store whatever mix of types goes into it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { JSONSerializable, JSONSerialized, JSONValue } from "@sdxc/types";

/** Expiration a write carries. */
export interface CacheWriteOptions {
	/**
	 * A bare number is whole seconds — the unit a store counts — while a duration
	 * string states its own unit. Omitted means the entry never expires.
	 */
	ttl?: DurationInput;
}

/**
 * A key/value store holding values a caller would rather not compute twice.
 *
 * Every method degrades rather than throws: a store that cannot answer reads as a
 * miss, so a caller never handles cache failure separately from a cache miss. What
 * a loader throws is the caller's own error and propagates.
 */
export interface Cache {
	/**
	 * Reads an entry, or `null` when it is missing or expired.
	 *
	 * `T` is an assertion: what a store holds under a key is a fact about the past,
	 * and no signature can check it. A stored `null` reads as `null` too, so reach
	 * for {@link Cache.fetch} where a cached `null` has to count as a hit.
	 */
	read<T extends JSONSerializable = JSONValue>(key: string): Promise<JSONSerialized<T> | null>;

	/** Writes an entry, replacing any current value for the key. */
	write<T extends JSONSerializable>(
		key: string,
		value: T,
		options?: CacheWriteOptions,
	): Promise<void>;

	/**
	 * Returns the stored entry, computing and storing it on a miss.
	 *
	 * The value is returned as it reads back, so a hit and a miss answer with the
	 * same type. A stored `null` is a hit, unlike in {@link Cache.read}.
	 */
	fetch<T extends JSONSerializable>(
		key: string,
		load: () => Promise<T>,
		options?: CacheWriteOptions,
	): Promise<JSONSerialized<T>>;

	/** Removes an entry, whether or not it exists. */
	delete(key: string): Promise<void>;
}
