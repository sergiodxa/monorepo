/**
 * The errors both halves of the package report, kept apart from the entry point so
 * the parser and the serializer can construct them without importing each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Signals that YAML source falls outside the subset this package reads.
 */
export class YAMLParseError extends Error {
	override name = "YAMLParseError";

	/**
	 * Line the parser stopped on, counting from 1.
	 */
	line: number;

	/**
	 * Creates a parse error pointing at the line that could not be read.
	 *
	 * @param message - Human readable description of the failure
	 * @param line - Line the parser stopped on, counting from 1
	 * @param options - Native error options for chained causes
	 */
	constructor(message: string, line: number, options?: ErrorOptions) {
		super(`${message} at line ${line}`, options);
		this.line = line;
	}
}

/**
 * Signals that a value has no representation in the subset this package writes.
 */
export class YAMLStringifyError extends Error {
	override name = "YAMLStringifyError";

	/**
	 * Path to the value that could not be written, as `data.items.0.name`.
	 */
	path: string;

	/**
	 * Creates a serialization error naming the value that could not be written.
	 *
	 * @param message - Human readable description of the failure
	 * @param path - Path to the offending value, empty at the document root
	 * @param options - Native error options for chained causes
	 */
	constructor(message: string, path: string, options?: ErrorOptions) {
		super(path === "" ? message : `${message} at ${path}`, options);
		this.path = path;
	}
}
