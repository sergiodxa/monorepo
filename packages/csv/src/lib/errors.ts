/**
 * The errors both halves of the package report, kept apart from the entry point so the
 * reader and the writers can construct them without importing each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Signals text the reader cannot turn into records: an unterminated quoted field, text
 * after a closing quote, a record with the wrong field count, or a duplicate header.
 */
export class CSVParseError extends Error {
	override name = "CSVParseError";

	/**
	 * Line the problem was found on, counting from 1 and counting the line breaks inside
	 * quoted fields, so it matches what a text editor shows.
	 */
	line: number;

	/**
	 * @param message - Human readable description of the failure
	 * @param line - Line the problem was found on, counting from 1
	 * @param options - Native error options for chained causes
	 */
	constructor(message: string, line: number, options?: ErrorOptions) {
		super(`${message} at line ${line}`, options);
		this.line = line;
	}
}

/**
 * Signals input the writer cannot represent: a value outside the cell types, an invalid
 * `Date`, a number without a finite value, or an unknown delimiter.
 */
export class CSVStringifyError extends Error {
	override name = "CSVStringifyError";

	/** Index of the offending row in the input, from 0; absent when the options are at fault. */
	row?: number;

	/** Key or index of the offending field, when a cell is at fault. */
	column?: string;

	/**
	 * @param message - Human readable description of the failure
	 * @param location - Where in the input the failure is
	 * @param options - Native error options for chained causes
	 */
	constructor(
		message: string,
		location: { row?: number; column?: string } = {},
		options?: ErrorOptions,
	) {
		let where = location.row === undefined ? "" : ` at row ${location.row}`;
		if (location.column !== undefined) where += `, column ${location.column}`;
		super(`${message}${where}`, options);
		this.row = location.row;
		this.column = location.column;
	}
}
