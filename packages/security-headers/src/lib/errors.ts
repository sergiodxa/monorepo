/**
 * The failures the package reports, kept apart from the entry points so the parsers construct
 * them without importing each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A Content-Security-Policy value breaks the CSP Level 3 grammar: a character outside
 * printable ASCII, or a directive name outside letters, digits and `-`.
 */
export class CSPParseError extends Error {
	override name = "CSPParseError" as const;

	/** Offset into the header value where parsing stopped, counting from 0. */
	readonly position: number;

	/**
	 * @param message - Human readable description of the failure
	 * @param position - Offset into the header value where parsing stopped
	 */
	constructor(message: string, position: number) {
		super(`${message} at position ${position}`);
		this.position = position;
	}
}

/**
 * A request did not carry CSP violation reports: an unsupported media type, a body that is not
 * JSON, or JSON in neither report format.
 */
export class CSPReportParseError extends Error {
	override name = "CSPReportParseError" as const;
}
