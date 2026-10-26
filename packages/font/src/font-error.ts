/**
 * The failure `parseFont` answers inside a `Result` when bytes are not a TrueType font it
 * can read. `code` separates a font this package declines (CFF, collections) from one that
 * lacks a table or is corrupt, so a caller can tell "ship a .ttf" from "this file is broken".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a font could not be read. `table` names the table at fault for `missing-table` and
 * for a `malformed` table, and is absent when the file header itself is the problem.
 */
export class FontError extends Error {
	override name = "FontError";
	/** Stable cause for a caller to branch on. */
	readonly code: FontError.Code;
	/** The four-character tag of the table at fault, when one is. */
	readonly table: string | undefined;

	/**
	 * @param code - Why the font was rejected.
	 * @param message - The explanation a log shows.
	 * @param table - The table at fault, when one is.
	 */
	constructor(code: FontError.Code, message: string, table?: string) {
		super(message);
		this.code = code;
		this.table = table;
	}
}

export namespace FontError {
	/**
	 * `unsupported` is a valid font of a kind this package does not read (CFF outlines, a
	 * collection, no Unicode `cmap` subtable); `missing-table` lacks a required table;
	 * `malformed` has a header or table whose sizes or values cannot be right;
	 * `not-permitted` is a font whose license (`OS/2.fsType`) forbids what was asked.
	 */
	export type Code = "unsupported" | "missing-table" | "malformed" | "not-permitted";
}
