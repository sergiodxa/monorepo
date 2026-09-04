/**
 * The JSON-writable type: every shape `JSON.stringify` accepts, including
 * objects that stand in for themselves through `toJSON`. Names the write side
 * of a serialization boundary, where a value may change type on the way out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A value `JSON.stringify` can write. Wider than `JSONValue` by the `toJSON`
 * branch, which admits a `Date` and every class that serializes itself, so
 * what comes back from `JSON.parse` is the substitute rather than the original.
 *
 * @example
 * let payload: JSONSerializable = { id: 1, publishedAt: new Date() };
 * @example
 * let stored: JSONSerializable = new URL("https://example.com");
 */
export type JSONSerializable =
	| string
	| number
	| boolean
	| null
	| JSONSerializable[]
	| { [key: string]: JSONSerializable }
	| { toJSON(): JSONSerializable };
