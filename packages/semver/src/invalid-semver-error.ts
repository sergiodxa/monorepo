/**
 * The failure value `parse()` reports for text SemVer 2.0.0 rejects. It keeps the
 * offending text on the error so a version read from a registry, a tag or a user
 * agent can be named in a log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing text that fails the SemVer 2.0.0 grammar, delivered to
 * callers inside a `Failure` value.
 */
export class InvalidSemVerError extends Error {
	/** The rejected text, kept verbatim for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message quotes the rejected text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param text - Text that did not match the SemVer 2.0.0 grammar.
	 */
	constructor(text: string) {
		super(`Invalid version: ${JSON.stringify(text)}`);
		this.name = "InvalidSemVerError";
		this.text = text;
	}
}
