/**
 * The one failure every well-known reader returns, naming the format and each place
 * the text broke its specification, so a caller can report all of them at once
 * instead of fixing a document one error per fetch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a well-known document could not be read (or, for a JWKS, written). Every issue
 * found is listed, and `message` summarizes the first.
 */
export class WellKnownParseError extends Error {
	override name = "WellKnownParseError";
	/** The registered name of the document that failed, such as `security.txt`. */
	readonly format: string;
	readonly issues: WellKnownParseError.Issue[];

	/**
	 * @param format - The registered name of the document.
	 * @param issues - Every problem found, at least one.
	 */
	constructor(format: string, issues: WellKnownParseError.Issue[]) {
		let first = issues[0]?.message ?? "The document is invalid.";
		let more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
		super(`${format}: ${first}${more}`);
		this.format = format;
		this.issues = issues;
	}
}

export namespace WellKnownParseError {
	/** One place a document breaks its specification. */
	export interface Issue {
		/**
		 * A JSON Pointer for a JSON document (`""` for the whole document), a 1-based line
		 * number for a text one (`0` for the file as a whole).
		 */
		at: string | number;
		message: string;
	}
}
