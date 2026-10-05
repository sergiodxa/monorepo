/**
 * The failure value every step of a language reports: a stored expression that
 * does not validate or compile names the node at fault by its path, and text
 * that does not parse names the line and column where it broke.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Where an expression went wrong, for an editor to point at. */
export interface ExpressionErrorOptions {
	/** The dotted path of the failing node in the JSON form, like `of.1.pattern`. */
	path?: string;
	/** The 1-based line of the text form the parse stopped at. */
	line?: number;
	/** The 1-based column of the text form the parse stopped at. */
	column?: number;
	cause?: unknown;
}

/**
 * An expression a language refused, delivered inside a `Failure`. A compile
 * failure carries `path`; a parse failure carries `line` and `column` as well.
 */
export class ExpressionError extends Error {
	/** The dotted path of the failing node, empty when it is the root. */
	readonly path: string;
	/** Set on a parse failure: the 1-based line of the text it stopped at. */
	readonly line?: number;
	/** Set on a parse failure: the 1-based column of the text it stopped at. */
	readonly column?: number;

	/**
	 * @param message What is wrong, phrased for the person who wrote the expression.
	 * @param options Where it is wrong, and the error that caused it.
	 */
	constructor(message: string, options: ExpressionErrorOptions = {}) {
		super(message, { cause: options.cause });
		this.name = "ExpressionError";
		this.path = options.path ?? "";
		if (options.line !== undefined) this.line = options.line;
		if (options.column !== undefined) this.column = options.column;
	}
}

/**
 * Prefixes a path with the path of the node it was found under, so a failure
 * raised deep in a tree names its position from the root.
 */
export function joinPath(parent: string, child: string | number): string {
	let key = String(child);
	if (parent === "") return key;
	if (key === "") return parent;
	return `${parent}.${key}`;
}
