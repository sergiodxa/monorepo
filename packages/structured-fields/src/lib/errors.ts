/**
 * The two failures the package reports, kept apart from the entry point so the parser
 * and the serializer construct them without importing each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The text is not a valid Structured Field of the requested type. RFC 9651 has the
 * recipient ignore such a field as a whole, so a failure never carries a partial value.
 */
export class StructuredFieldParseError extends Error {
	override name = "StructuredFieldParseError" as const;

	/** Offset into the field value where parsing stopped, counting from 0. */
	readonly position: number;

	/**
	 * @param message - Human readable description of the failure
	 * @param position - Offset into the field value where parsing stopped
	 */
	constructor(message: string, position: number) {
		super(`${message} at position ${position}`);
		this.position = position;
	}
}

/**
 * A value has no RFC 9651 representation: a number out of range, a character outside a
 * type's set, a key that breaks the key grammar, or a Date carrying milliseconds.
 */
export class StructuredFieldStringifyError extends Error {
	override name = "StructuredFieldStringifyError" as const;

	/** Where in the input the offending value sits, empty for the value itself. */
	readonly path: Array<string | number>;

	/**
	 * @param message - Human readable description of the failure
	 * @param path - Keys and indices leading to the offending value
	 */
	constructor(message: string, path: Array<string | number>) {
		super(path.length === 0 ? message : `${message} at ${path.join(".")}`);
		this.path = path;
	}
}
