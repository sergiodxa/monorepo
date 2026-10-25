/**
 * The JavaScript values CBOR data items decode to and encode from, including the two classes
 * for items JavaScript has no native form for: a tagged item and an unassigned simple value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A CBOR data item as JavaScript holds it. Integers beyond `Number.MAX_SAFE_INTEGER`, and the
 * bignums of tags 2 and 3, are `bigint`; byte strings are `Uint8Array`; maps are `Map`, so keys
 * keep their CBOR type; every other tag is a `Tagged`.
 */
export type CBORValue =
	| number
	| bigint
	| string
	| Uint8Array<ArrayBuffer>
	| boolean
	| null
	| undefined
	| CBORValue[]
	| Map<CBORValue, CBORValue>
	| Tagged
	| Simple;

/**
 * A tagged data item (major type 6): the tag number and the item it qualifies. The tag's
 * meaning is the caller's to apply; `value` holds the enclosed item exactly as decoded.
 *
 * @example
 * let date = new Tagged(0, "2013-03-21T20:04:00Z");
 */
export class Tagged {
	/**
	 * @param tag Tag number, up to 2^64 - 1; a `bigint` beyond the safe integer range.
	 * @param value The enclosed data item.
	 */
	constructor(
		readonly tag: number | bigint,
		readonly value: CBORValue,
	) {}
}

/**
 * A simple value (major type 7) with no JavaScript equivalent: 0 to 19 or 32 to 255. The
 * assigned ones — `false`, `true`, `null`, `undefined` — decode to those JavaScript values.
 *
 * @example
 * let sixteen = new Simple(16);
 */
export class Simple {
	/** @param value The simple value's number. */
	constructor(readonly value: number) {}
}
