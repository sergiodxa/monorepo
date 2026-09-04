/**
 * The JSON value type: every shape `JSON.parse` can hand back, and nothing
 * else. Names the read side of a serialization boundary, where a value has
 * already made the round trip through text and kept its meaning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A value that survives `JSON.stringify` and comes back from `JSON.parse`
 * identical. The round trip is the contract: a `Date` is excluded because it
 * returns as a string, so a consumer reading this type gets what was written.
 *
 * @example
 * let value: JSONValue = { name: "John", age: 30 };
 * @example
 * let array: JSONValue = [1, 2, 3];
 */
export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };
