/**
 * The failure a conversion reports, kept in its own module so the schema machinery
 * and the public converter construct it without importing each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A schema, or a schema nested in it, that has no JSON Schema form. */
export class JSONSchemaConversionError extends Error {
	override name = "JSONSchemaConversionError";
	/** Where the failing schema sits in the emitted document, as JSON Pointer segments. */
	readonly path: readonly (string | number)[];

	/**
	 * @param message - Why the schema could not be described.
	 * @param path - The failing schema's location in the emitted document.
	 * @param options - Native error options, carrying a converter's own error as `cause`.
	 */
	constructor(message: string, path: readonly (string | number)[] = [], options?: ErrorOptions) {
		super(message, options);
		this.path = path;
	}
}

/**
 * Formats schema path segments as an RFC 6901 JSON Pointer, `""` for the root.
 *
 * @param path - The segments, outermost first.
 * @example toPointer(["properties", "a/b"]); // "/properties/a~1b"
 */
export function toPointer(path: readonly (string | number)[]): string {
	return path
		.map((segment) => `/${String(segment).replaceAll("~", "~0").replaceAll("/", "~1")}`)
		.join("");
}
