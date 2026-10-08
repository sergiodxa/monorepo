/**
 * The one failure a conversion reports: TeX this package cannot read, located
 * in the source by offset, line and column so an author finds the character
 * that broke a formula inside a long document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * TeX the parser refused. The message ends with `line:column`, so it reads on
 * its own in a build log, and the fields carry the same place for a caller
 * that points an editor at it.
 */
export class MathError extends Error {
	override name = "MathError";

	/** What went wrong, without the position the message appends. */
	reason: string;

	/** 0-based offset into the TeX source. */
	index: number;

	/** 1-based line of {@link MathError.index}. */
	line: number;

	/** 1-based column of {@link MathError.index} within its line. */
	column: number;

	/**
	 * @param reason - What went wrong
	 * @param source - The TeX that was being read, which the line and column are counted in
	 * @param index - Where in it the problem starts
	 */
	constructor(reason: string, source: string, index: number) {
		let before = source.slice(0, index);
		let line = before.split("\n").length;
		let column = index - before.lastIndexOf("\n");
		super(`${reason} at ${line}:${column}`);
		this.reason = reason;
		this.index = index;
		this.line = line;
		this.column = column;
	}
}
