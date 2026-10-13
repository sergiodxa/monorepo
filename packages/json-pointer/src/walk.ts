/**
 * One-token steps through a JSON value, shared by get and set so a missing
 * member, an out-of-range index, and a walk through a scalar fail the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Sentinel when a token has no child to select, so a present `undefined` member still resolves. */
export const MISSING = Symbol("json-pointer-missing");

/** An unsigned decimal integer with no leading zeros, the only array index RFC 6901 accepts. */
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/u;

/**
 * The child `token` selects in `value`, or {@link MISSING} when the token names
 * no member, no in-range index, or a child of a scalar.
 *
 * @param value - The value the token is evaluated against.
 * @param token - An unescaped reference token.
 */
export function child(value: unknown, token: string): unknown {
	if (Array.isArray(value)) {
		let index = arrayIndex(token);
		if (index === null || index >= value.length) return MISSING;
		return value[index];
	}
	if (typeof value === "object" && value !== null) {
		if (!Object.hasOwn(value, token)) return MISSING;
		return (value as Record<string, unknown>)[token];
	}
	return MISSING;
}

/**
 * `token` as an array index when it is an unsigned decimal integer with no
 * leading zeros, inside the safe-integer range a JSON array can actually use.
 *
 * @param token - An unescaped reference token.
 * @returns The index, or `null` when the token is not an array index.
 */
export function arrayIndex(token: string): number | null {
	if (!ARRAY_INDEX.test(token)) return null;
	let index = Number(token);
	if (!Number.isSafeInteger(index)) return null;
	return index;
}
