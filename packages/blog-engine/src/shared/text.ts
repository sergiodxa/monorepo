/**
 * Text coercion for the two places this engine handles dynamically typed values:
 * form entries (which may arrive as a `File`) and post metadata (whose native type
 * is decided at runtime by the field kind). Plain `String(value)` collapses both to
 * `"[object Object]"`, silently storing and rendering garbage; these helpers keep
 * the real value legible instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Narrows one form entry to its text value.
 * @param value - A `FormData.get()` result.
 * @param fallback - Returned when the field is absent or was submitted as a file.
 * @returns The submitted text, or the fallback.
 */
export function entryText(value: FormDataEntryValue | null, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

/**
 * Reads a text field out of a submitted form.
 * @param formData - The submitted form body.
 * @param name - The field name to read.
 * @param fallback - Returned when the field is absent or was submitted as a file.
 * @returns The submitted text, or the fallback.
 */
export function fieldText(formData: FormData, name: string, fallback = ""): string {
	return entryText(formData.get(name), fallback);
}

/**
 * Coerces a runtime-typed metadata value to text. Strings pass through untouched and
 * numbers/bigints/booleans stringify; everything else serializes as JSON so objects
 * and arrays survive instead of collapsing to `"[object Object]"`.
 * @param value - The value to render as text.
 * @param fallback - Returned for `null`/`undefined` and for values JSON cannot encode
 * (symbols, functions).
 * @returns The text form of the value.
 * @example asText({ a: 1 }) // '{"a":1}'
 */
export function asText(value: unknown, fallback = ""): string {
	if (value === undefined || value === null) return fallback;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
		return String(value);
	}
	return JSON.stringify(value) ?? fallback;
}
