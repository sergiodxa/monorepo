/**
 * The cache contract every adapter implements: read, write, fetch and delete
 * over string keys. The value's type is taken per call rather than per instance,
 * so one instance serves a whole store whatever mix of types goes into it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { JSONSerialized, JSONValue } from "@sdxc/types";

import type { CacheError } from "./errors.js";

export type { CacheErrorCode, CacheErrorOptions } from "./errors.js";

export { CacheError } from "./errors.js";

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
 * Nothing here throws: every method answers with a `Result`, and a store that
 * cannot be reached is an `unavailable` failure a caller is free to treat as a
 * miss. A store failure is also recorded on the invocation's log, so discarding
 * one still leaves a trace of it.
 *
 * A value is held as JSON, and the caller is trusted to hand over one JSON can
 * write. The type is not constrained to `JSONSerializable`, because as a constraint
 * it rejects an ordinary interface and any field typed `unknown` — both of which
 * cache perfectly well. A value JSON genuinely cannot write is `invalid_value`.
 */
export interface Cache {
	/**
	 * Reads an entry, succeeding with `null` when it is missing or expired.
	 *
	 * `T` is an assertion: what a store holds under a key is a fact about the past,
	 * and no signature can check it. A stored `null` succeeds with `null` too, so
	 * reach for {@link Cache.fetch} where a cached `null` has to count as a hit.
	 */
	read<T = JSONValue>(key: string): Promise<Result<JSONSerialized<T> | null, CacheError>>;

	/** Writes an entry, replacing any current value for the key. */
	write<T>(key: string, value: T, options?: CacheWriteOptions): Promise<Result<void, CacheError>>;

	/**
	 * Returns the stored entry, computing and storing it on a miss.
	 *
	 * The value is returned as it reads back, so a hit and a miss answer with the
	 * same type. A stored `null` is a hit, unlike in {@link Cache.read}.
	 *
	 * Everything the store does wrong is absorbed here, because a value can be
	 * computed instead: an unreachable store, an entry that is not JSON, and a
	 * refused write all still answer with the value. So a failure means the value
	 * could not be produced — `load_failed` when the loader failed, `invalid_value`
	 * when what it produced cannot be written.
	 */
	fetch<T>(
		key: string,
		load: () => Promise<T>,
		options?: CacheWriteOptions,
	): Promise<Result<JSONSerialized<T>, CacheError>>;

	/** Removes an entry, succeeding whether or not it exists. */
	delete(key: string): Promise<Result<void, CacheError>>;
}
