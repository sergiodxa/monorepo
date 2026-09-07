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
export type JSONSerialized<T> = T extends { toJSON(): infer R }
	? JSONSerialized<R>
	: T extends JSONValue
		? T
		: T extends readonly unknown[]
			? { [K in keyof T]: Written<T[K]> }
			: T extends (...args: never[]) => unknown
				? never
				: T extends object
					? {
							[K in keyof T as [JSONSerialized<T[K]>] extends [never] ? never : K]: JSONSerialized<
								T[K]
							>;
						}
					: never;

/**
 * An array element, which JSON writes as `null` where the same type in a
 * property position would be left out, since an array cannot drop a slot
 * without changing the length of what is read back.
 */
type Written<T> = [JSONSerialized<T>] extends [never] ? null : JSONSerialized<T>;
