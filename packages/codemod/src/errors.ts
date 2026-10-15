/**
 * The one error every scan and edit in the package reports. It names the file and, for input
 * that could not be scanned, the line and column, so a CLI can print where to make the change
 * by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * What went wrong: a file extension the scanner does not read, input that ends inside a
 * string, template, comment, regular expression or JSX element, brackets that do not pair, a
 * character no token starts with, an import or export declaration outside the grammar, an
 * anchor the edit could not find, a key that already exists, or an edit whose output does
 * not scan.
 */
export type CodemodErrorCode =
	| "unsupported-file"
	| "unterminated"
	| "unbalanced"
	| "unexpected-character"
	| "invalid-declaration"
	| "not-found"
	| "duplicate-key"
	| "invalid-output";

/** A scan or edit failure; no edit is ever computed from input that failed to scan. */
export class CodemodError extends Error {
	override name = "CodemodError";

	/** Which step failed, so a caller can branch without reading `message`. */
	code: CodemodErrorCode;

	/** The file name the caller passed. */
	filename: string;

	/** The UTF-16 offset the failure concerns, or `null` when it concerns the whole file. */
	offset: number | null;

	/**
	 * @param code - What went wrong
	 * @param filename - The file name the caller passed
	 * @param reason - The failure in words; a position is prefixed when `offset` is given
	 * @param source - The scanned text, used to turn `offset` into a line and column
	 * @param offset - The UTF-16 offset the failure concerns
	 */
	constructor(
		code: CodemodErrorCode,
		filename: string,
		reason: string,
		source: string | null = null,
		offset: number | null = null,
	) {
		super(`${filename}${position(source, offset)}: ${reason}`);
		this.code = code;
		this.filename = filename;
		this.offset = offset;
	}
}

/** `:line:column`, both 1-based, or nothing without a position. */
function position(source: string | null, offset: number | null): string {
	if (source === null || offset === null) return "";
	let before = source.slice(0, offset);
	let line = before.split("\n").length;
	let column = offset - before.lastIndexOf("\n");
	return `:${line}:${column}`;
}
