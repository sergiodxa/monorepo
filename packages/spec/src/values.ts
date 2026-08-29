/**
 * The runtime value model: what `.spec` expressions evaluate to and what
 * tools receive and return. Values are deliberately JSON-shaped so they
 * cross the plugin protocol boundary already serialized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** An object value: string keys to nested values, as literal syntax builds. */
export interface ValueObject {
	[key: string]: Value;
}

/**
 * Everything a `.spec` expression can evaluate to. Duration literals
 * evaluate to their number of milliseconds, represented by the plain
 * `number` case above.
 */
export type Value = string | number | boolean | null | Value[] | ValueObject;

/**
 * One argument to a tool call. A `word` is a bare identifier in argument
 * position (`exists`, `textbox`, `with`) — a symbol the tool's descriptor
 * interprets, carrying its own tag apart from a same-spelled string value.
 */
export type ToolArg = { kind: "value"; value: Value } | { kind: "word"; word: string };

/**
 * Deep structural equality over runtime values — the semantics of the
 * two-argument `expect A B` form. Arrays compare by index, objects by key
 * set, primitives by `===`.
 *
 * @param left - One value.
 * @param right - The other value.
 * @returns Whether the two values are structurally identical.
 */
export function valueEquals(left: Value, right: Value): boolean {
	if (left === right) return true;
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return false;
		return left.every((item, index) => valueEquals(item, right[index] ?? null));
	}
	if (
		typeof left === "object" &&
		left !== null &&
		!Array.isArray(left) &&
		typeof right === "object" &&
		right !== null &&
		!Array.isArray(right)
	) {
		let leftKeys = Object.keys(left);
		let rightKeys = Object.keys(right);
		if (leftKeys.length !== rightKeys.length) return false;
		return leftKeys.every(
			(key) => key in right && valueEquals(left[key] ?? null, right[key] ?? null),
		);
	}
	return false;
}

/**
 * Render a value for diagnostics: JSON with stable key order and indentation
 * only when the value spans structures, so simple failures stay on one line.
 *
 * @param value - The value to render.
 * @returns A human-readable, deterministic rendering.
 */
export function formatValue(value: Value): string {
	let flat = JSON.stringify(value);
	if (flat !== undefined && flat.length <= 60) return flat;
	return JSON.stringify(value, null, 2);
}
