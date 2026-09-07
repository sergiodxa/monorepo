/**
 * The JSON round-trip type: what a JSON-writable value's shape becomes once it
 * has been through `JSON.stringify` and `JSON.parse`. Names the far side of a
 * serialization boundary, where the value read back is not the one written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "./json-value.js";

/**
 * The `JSONValue` a `JSONSerializable` comes back as. A `toJSON` stands in for
 * its object, a property JSON cannot write is dropped, and an element it cannot
 * write becomes `null`, which is what makes the read side typed rather than cast.
 *
 * It models the shape, not the value: a cycle throws, `NaN` and `Infinity` read
 * back as `null`, and a property inherited rather than owned is kept here and
 * dropped by `JSON.stringify`.
 *
 * @example
 * type Stored = JSONSerialized<{ id: number; publishedAt: Date }>;
 * //   { id: number; publishedAt: string }
 */
export type JSONSerialized<T> = Serialize<T, typeof MAX_DEPTH>;

/**
 * How many levels of nesting are tracked before the result widens to `JSONValue`.
 *
 * The limit is what lets a generic constrained to `JSONSerializable` be passed
 * through this type at all: both are recursive, and without a bound the compiler
 * gives up on the pair with TS2589 rather than on a value anybody would cache.
 */
const MAX_DEPTH = 9;

/** Counts one level of nesting down, ending at `never` so the recursion stops. */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** {@link JSONSerialized}, carrying the nesting budget it has left. */
type Serialize<T, D extends number> = [D] extends [never]
	? JSONValue
	: T extends { toJSON(): infer R }
		? Serialize<R, Prev[D]>
		: T extends JSONValue
			? T
			: T extends readonly unknown[]
				? { [K in keyof T]: Written<T[K], Prev[D]> }
				: T extends (...args: never[]) => unknown
					? never
					: T extends object
						? {
								[K in keyof T as [Serialize<T[K], Prev[D]>] extends [never] ? never : K]: Serialize<
									T[K],
									Prev[D]
								>;
							}
						: never;

/**
 * An array element, which JSON writes as `null` where the same type in a
 * property position would be left out, since an array cannot drop a slot
 * without changing the length of what is read back.
 */
type Written<T, D extends number> = [Serialize<T, D>] extends [never] ? null : Serialize<T, D>;
