/**
 * The one error class every stage of MessageFormat 2 processing reports, tagged with the
 * error name the Unicode specification defines, so a caller branches on `type` whether the
 * error came from parsing, data model validation, resolution or a function handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error names from the MessageFormat 2 specification, spelled as its conformance suite
 * spells them. `function-error` is the umbrella for a custom function that failed with an
 * error of its own, which is kept as `cause`.
 */
export type MessageErrorType =
	| "syntax-error"
	| "variant-key-mismatch"
	| "missing-fallback-variant"
	| "missing-selector-annotation"
	| "duplicate-declaration"
	| "duplicate-option-name"
	| "duplicate-variant"
	| "unresolved-variable"
	| "unknown-function"
	| "bad-selector"
	| "bad-operand"
	| "bad-option"
	| "bad-variant-key"
	| "not-formattable"
	| "function-error";

/** Options for {@link MessageError}. */
export interface MessageErrorOptions {
	/** Fallback representation of the expression the error belongs to, such as `$count`. */
	source?: string;
	/** UTF-16 offset in the message source where a syntax error starts. */
	start?: number;
	/** The underlying error a function handler threw. */
	cause?: unknown;
}

/**
 * An error found while parsing, validating or formatting a message. Syntax and data model
 * errors carry the source offset in `start`; resolution and function errors carry the
 * placeholder's fallback representation in `source`.
 *
 * @example throw new MessageError("bad-operand", "Expected a number", { source: "$count" });
 */
export class MessageError extends Error {
	/** The specification's name for the error. */
	readonly type: MessageErrorType;
	readonly source: string | undefined;
	readonly start: number | undefined;

	/**
	 * @param type The specification's name for the error.
	 * @param message A human-readable explanation.
	 * @param options Where the error happened and what caused it.
	 */
	constructor(type: MessageErrorType, message: string, options: MessageErrorOptions = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = "MessageError";
		this.type = type;
		this.source = options.source;
		this.start = options.start;
	}
}
