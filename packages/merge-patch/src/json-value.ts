/**
 * The JSON value type every merge patch function reads and writes: exactly the shapes
 * `JSON.parse` hands back, so a patch received as text and a patch built in code are
 * the same kind of value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A value that survives a `JSON.stringify`/`JSON.parse` round trip unchanged. */
export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };

/** A JSON object, the one shape a merge patch merges into instead of replacing. */
export interface JSONObject {
	[key: string]: JSONValue;
}

/** Whether a value is a JSON object: arrays and `null` are replaced whole by a merge patch. */
export function isJSONObject(value: JSONValue | undefined): value is JSONObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Writes a member as an own, enumerable property, so a member named `__proto__` stays
 * data instead of replacing the object's prototype.
 */
export function setMember(object: JSONObject, key: string, value: JSONValue): void {
	Object.defineProperty(object, key, {
		value,
		enumerable: true,
		writable: true,
		configurable: true,
	});
}
