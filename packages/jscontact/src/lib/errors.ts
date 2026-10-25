/**
 * The failures this package reports through `Result`: JSON that is not a valid Card, a
 * PatchObject that cannot be applied, and vCard or jCard data that does not parse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One problem in a document, at the property path it was found. */
export interface Issue {
	/** Property names and array indexes from the root, e.g. `["emails", "e1", "address"]`. */
	path: (string | number)[];
	message: string;
}

/** Text that is not JSON, or JSON that is not a valid JSContact Card. */
export class JSContactParseError extends Error {
	override name = "JSContactParseError";

	/** Every problem found; empty when the text is not JSON at all. */
	issues: Issue[];

	/**
	 * @param message - A summary naming the first problem
	 * @param issues - Every problem found
	 */
	constructor(message: string, issues: Issue[] = []) {
		super(message);
		this.issues = issues;
	}
}

/** A PatchObject with an invalid pointer, overlapping pointers, or a missing parent. */
export class PatchError extends Error {
	override name = "PatchError";

	/** The patch key that failed. */
	pointer: string;

	/**
	 * @param message - What is wrong
	 * @param pointer - The patch key that failed
	 */
	constructor(message: string, pointer: string) {
		super(message);
		this.pointer = pointer;
	}
}

/** vCard text or jCard JSON that does not hold a well-formed card. */
export class VCardParseError extends Error {
	override name = "VCardParseError";

	/** The 1-based line of vCard text the problem is on; `null` for jCard input. */
	line: number | null;

	/**
	 * @param message - What is wrong
	 * @param line - The line of vCard text, when the input was text
	 */
	constructor(message: string, line: number | null = null) {
		super(message);
		this.line = line;
	}
}
