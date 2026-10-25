/**
 * The JSON values a patch reads and writes, and the structural equality the `test`
 * operation compares with, so a patch built in code and one parsed from text behave alike.
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

/** A JSON object, the container whose members a pointer names by key. */
export interface JSONObject {
	[key: string]: JSONValue;
}

/** Whether a value is a JSON object: arrays and `null` are not. */
export function isJSONObject(value: unknown): value is JSONObject {
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

/**
 * RFC 6902 section 4.6 equality: same type, numbers equal by value, arrays equal element
 * by element in order, and objects holding the same members regardless of their order.
 */
export function isEqual(left: JSONValue, right: JSONValue): boolean {
	if (left === right) return true;

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		return left.every((item, index) => isEqual(item, right[index] as JSONValue));
	}

	if (!isJSONObject(left) || !isJSONObject(right)) return false;
	let keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every(
		(key) => Object.hasOwn(right, key) && isEqual(left[key] as JSONValue, right[key] as JSONValue),
	);
}
