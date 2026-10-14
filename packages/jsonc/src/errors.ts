/**
 * The error `parse` answers with, carrying a position computed by this package so the same
 * input reports the same offset, line and column on every JavaScript engine, including those
 * whose own `JSON.parse` messages name no position.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Signals JSONC text that cannot be read, pointing at the first character that breaks it.
 * `message` ends with the line and column, so it reads on its own in a terminal.
 */
export class JSONCParseError extends Error {
	override name = "JSONCParseError";

	/** What is wrong, without the position: `Expected ':' after a property name`. */
	reason: string;

	/** Index of the offending character in the original text; its length at end of input. */
	offset: number;

	/** Line of `offset`, counting from 1; `\n`, `\r\n` and a lone `\r` each end a line. */
	line: number;

	/** Column of `offset` in UTF-16 code units, counting from 1. */
	column: number;

	/**
	 * @param reason - What is wrong, without the position
	 * @param offset - Index of the offending character in the original text
	 * @param line - Line of `offset`, counting from 1
	 * @param column - Column of `offset`, counting from 1
	 */
	constructor(reason: string, offset: number, line: number, column: number) {
		super(`${reason} at line ${line}, column ${column}`);
		this.reason = reason;
		this.offset = offset;
		this.line = line;
		this.column = column;
	}
}
