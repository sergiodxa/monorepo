/**
 * The failure value every step of a language reports: a stored expression that
 * does not validate or compile names the node at fault by its path, text that
 * does not parse names the line and column where it broke, and a strict
 * evaluation names the context path it found missing or the types it refused.
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
	/** The context path a strict evaluation found nothing at, like `actor.id`. */
	missing?: string;
	/** The types of the two operands a strict evaluation refused to compare, like `["string", "null"]`. */
	mismatch?: readonly [string, string];
	cause?: unknown;
}

/**
 * An expression a language refused, delivered inside a `Failure`. A compile
 * failure carries `path`; a parse failure carries `line` and `column` as well;
 * a strict evaluation failure carries `missing` or `mismatch`.
 */
export class ExpressionError extends Error {
	/** The dotted path of the failing node, empty when it is the root. */
	readonly path: string;
	/** Set on a parse failure: the 1-based line of the text it stopped at. */
	readonly line?: number;
	/** Set on a parse failure: the 1-based column of the text it stopped at. */
	readonly column?: number;
	/** Set on a strict evaluation failure: the context path that resolved to nothing. */
	readonly missing?: string;
	/**
	 * Set on a strict evaluation failure: the operand types the operator refused,
	 * `date`, `array`, `object` or `null` beside the JSON scalar types.
	 */
	readonly mismatch?: readonly [string, string];

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
		if (options.missing !== undefined) this.missing = options.missing;
		if (options.mismatch !== undefined) this.mismatch = options.mismatch;
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
