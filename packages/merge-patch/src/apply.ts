/**
 * Applies a merge patch per RFC 7396 section 2: objects merge member by member, `null`
 * removes a member, and every other value replaces what it lands on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSONObject, JSONValue } from "./json-value.js";

import { isJSONObject, setMember } from "./json-value.js";

/**
 * Applies `patch` to `target` and returns a new value; neither input is mutated, and the
 * result shares no object or array with them. A non-object patch replaces the target,
 * and an object patch applied to a non-object merges into `{}`.
 *
 * @param target - The resource as it is now.
 * @param patch - The merge patch document.
 * @returns The patched resource.
 * @example apply({ a: "b", c: 1 }, { a: null, d: 2 }) // { c: 1, d: 2 }
 */
export function apply(target: JSONValue, patch: JSONValue): JSONValue {
	if (!isJSONObject(patch)) return structuredClone(patch);

	let result: JSONObject = {};
	if (isJSONObject(target)) {
		for (let [key, value] of Object.entries(target)) setMember(result, key, structuredClone(value));
	}

	for (let [key, value] of Object.entries(patch)) {
		if (value === null) {
			delete result[key];
			continue;
		}
		let current = Object.hasOwn(result, key) ? result[key] : undefined;
		setMember(result, key, apply(current ?? {}, value));
	}

	return result;
}
