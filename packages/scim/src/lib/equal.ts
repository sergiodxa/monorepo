/**
 * Structural equality over JSON values, used where SCIM compares whole attribute values: an
 * `add` that repeats an existing value changes nothing, and a read-only attribute may be
 * written back unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isWireObject } from "./attributes.js";

/**
 * Whether two JSON values are structurally equal; object key order is irrelevant.
 *
 * @param left - One value
 * @param right - The other
 * @returns Whether they are equal
 */
export function deepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length && left.every((item, index) => deepEqual(item, right[index]))
		);
	}
	if (isWireObject(left) && isWireObject(right)) {
		let keys = Object.keys(left);
		if (keys.length !== Object.keys(right).length) return false;
		return keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
	}
	return false;
}
