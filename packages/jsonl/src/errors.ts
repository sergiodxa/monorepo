/**
 * The one error every reader and writer in the package reports, carrying the line it concerns
 * so a caller can point a user at the same row their editor shows, whichever step failed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * What went wrong: a line longer than `maxLineBytes`, a line that is not JSON, a value its
 * schema rejected, or a value `JSON.stringify` cannot write (a function, a bare `undefined`).
 */
export type JSONLErrorCode = "line-too-long" | "invalid-json" | "invalid-value" | "unserializable";

/** A JSON Lines failure at one line; `message` ends with that line number. */
export class JSONLError extends Error {
	override name = "JSONLError";

	/** Which step failed, so a caller can branch without reading `message`. */
	code: JSONLErrorCode;

	/** 1-based line number, counting blank lines, as an editor numbers them. */
	line: number;

	/** The schema's issues for an `invalid-value` failure; empty for every other code. */
	issues: readonly StandardSchemaV1.Issue[];

	/**
	 * @param code - What went wrong
	 * @param reason - The failure in words, without the line number
	 * @param line - 1-based line number the failure concerns
	 * @param options - The schema's issues, and the native cause when there is one
	 */
	constructor(
		code: JSONLErrorCode,
		reason: string,
		line: number,
		options: { issues?: readonly StandardSchemaV1.Issue[]; cause?: unknown } = {},
	) {
		super(`${reason} at line ${line}`, { cause: options.cause });
		this.code = code;
		this.line = line;
		this.issues = options.issues ?? [];
	}
}
