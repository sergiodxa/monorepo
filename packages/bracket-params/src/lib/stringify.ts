/**
 * Writes nested values with bracket keys, as a query string or as `FormData`, so whatever
 * `parse` reads can be written back and read again unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A value written as text; `null` and `undefined` write nothing. */
export type TextValue = string | number | boolean | bigint | Date | null | undefined;

/** A value `toFormData` writes: text, or a file or blob appended as-is. */
export type FormValue = TextValue | Blob;

/**
 * The shape a writer accepts, checked against the value's own type so interface-typed values
 * qualify: leaves, arrays and objects of them, nested to any depth. A `Blob` is accepted only
 * where `Leaf` includes it.
 *
 * @template Value - The value being written
 * @template Leaf - The leaves the writer has a form for
 */
export type BracketInput<Value, Leaf = TextValue> = Value extends Leaf
	? Value
	: Value extends Blob
		? never
		: Value extends readonly (infer Item)[]
			? readonly BracketInput<Item, Leaf>[]
			: Value extends object
				? { [Key in keyof Value]: BracketInput<Value[Key], Leaf> }
				: never;

/**
 * Writes an object as a query string without a leading `?`. Arrays write `key[index]`, which
 * keeps an array of objects grouped; empty arrays and objects write nothing.
 *
 * @param value - The object whose keys become the query's names
 * @returns The encoded query, ready for `new URLSearchParams(...)` or a URL's `search`
 * @example stringify({ filter: { status: "open" }, page: 2 }) // "filter%5Bstatus%5D=open&page=2"
 */
export function stringify<Value extends object>(value: Value & BracketInput<Value>): string {
	let params = new URLSearchParams();
	for (let [key, entry] of entries(value)) if (typeof entry === "string") params.append(key, entry);
	return params.toString();
}

/**
 * Writes an object as `FormData` with the same keys `stringify` writes, appending each `Blob`
 * (a `File` included) as its own field so an upload keeps its name and type.
 *
 * @param value - The object whose keys become the form's field names
 * @returns A form ready for a `fetch` body or a `Request`
 * @example toFormData({ post: { title: "Hi" }, photos: [file] }) // post[title], photos[0]
 */
export function toFormData<Value extends object>(
	value: Value & BracketInput<Value, FormValue>,
): FormData {
	let form = new FormData();
	for (let [key, entry] of entries(value)) form.append(key, entry);
	return form;
}

/**
 * Walks a value depth-first in insertion order, descending into arrays and objects so every leaf
 * gets its full bracket key.
 *
 * @yields Each leaf's bracket key and its text, or the `Blob` itself
 */
function* entries(value: object, prefix?: string): Generator<[string, string | Blob]> {
	let children = Array.isArray(value) ? value.entries() : Object.entries(value);
	for (let [child, item] of children) {
		let key = prefix === undefined ? String(child) : `${prefix}[${child}]`;
		if (item === null || item === undefined) continue;
		if (item instanceof Date) yield [key, item.toISOString()];
		else if (item instanceof Blob) yield [key, item];
		else if (typeof item === "object") yield* entries(item, key);
		else if (typeof item === "string") yield [key, item];
		else if (typeof item === "number" || typeof item === "boolean" || typeof item === "bigint") {
			yield [key, String(item)];
		}
	}
}
