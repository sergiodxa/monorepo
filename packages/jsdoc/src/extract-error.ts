/**
 * The failure value `extract` reports for source text the parser could not read.
 * It carries every syntax error with its position, so a caller can name the file
 * and the line instead of reporting that documentation generation failed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One syntax error, with 1-based line and column into the source text. */
export interface DocDiagnostic {
	message: string;
	line: number;
	column: number;
}

/** Error describing source text that failed to parse, delivered inside a `Failure`. */
export class ExtractError extends Error {
	/** Path the caller passed for the source text, quoted in the message. */
	readonly path: string;

	/** Every syntax error the parser found, in source order. */
	readonly diagnostics: DocDiagnostic[];

	/**
	 * Builds an error whose message leads with the first syntax error, since a
	 * later one is usually a consequence of it.
	 *
	 * @param path - Path the caller gave the source text.
	 * @param diagnostics - Syntax errors found while parsing.
	 */
	constructor(path: string, diagnostics: DocDiagnostic[]) {
		let [first] = diagnostics;
		let where = first ? `${path}:${first.line}:${first.column}` : path;
		super(`Could not parse ${where}${first ? `: ${first.message}` : ""}`);
		this.name = "ExtractError";
		this.path = path;
		this.diagnostics = diagnostics;
	}
}
