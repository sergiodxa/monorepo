/**
 * Resolved values and formatted parts, shaped like the TC39 `Intl.MessageFormat` proposal's
 * `MessageValue` and `MessagePart`, plus the fallback and unknown values the formatter
 * produces itself. Custom functions return a `MessageValue`; `formatToParts` returns parts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Text direction of a message or a value; `auto` means it follows the first strong character. */
export type Direction = "ltr" | "rtl" | "auto";

/**
 * What a function returns and what selectors and placeholders resolve to. A value is
 * formattable when it has `toParts` and `toString`, selectable when it has `selectKeys`,
 * and usable as another function's operand or option through `valueOf` and `options`.
 */
export interface MessageValue {
	type: string;
	locale: string;
	dir: Direction;
	/** Fallback representation of the expression, such as `$count` or `|text|`. */
	source: string;
	options?: Record<string, unknown>;
	/** Returns the subset of `keys` that match, best match first. */
	selectKeys?: (keys: string[]) => string[];
	toParts?: () => MessagePart[];
	toString?: () => string;
	valueOf?: () => unknown;
}

/** Context passed to every {@link MessageFunction} call. */
export interface MessageFunctionContext {
	/** The message's locale chain. */
	locales: string[];
	/** The message's base direction. */
	dir: Direction;
	/** Fallback representation of the expression being resolved. */
	source: string;
}

/**
 * A custom function. Literals arrive as strings, local variables as the `MessageValue` their
 * declaration resolved to, and external variables as given. Throwing reports the error and
 * formats the placeholder as its fallback.
 */
export type MessageFunction = (
	context: MessageFunctionContext,
	options: Record<string, unknown>,
	input?: unknown,
) => MessageValue;

/** Literal text from the pattern. */
export interface MessageTextPart {
	type: "text";
	value: string;
}

/** An isolate control wrapped around a placeholder: LRI, RLI or FSI before, PDI after. */
export interface MessageBidiIsolationPart {
	type: "bidiIsolation";
	value: "\u2066" | "\u2067" | "\u2068" | "\u2069";
}

/** Markup, which `format` drops and `formatToParts` keeps for the caller to render. */
export interface MessageMarkupPart {
	type: "markup";
	kind: "open" | "standalone" | "close";
	/** The markup with its sigils: `#b`, `#img/` or `/b`. */
	source: string;
	name: string;
	/** From the `u:id` option. */
	id?: string;
	/** Literal options as strings, variable options as their resolved values. */
	options?: Record<string, unknown>;
}

/** A placeholder that failed to resolve or format; `format` writes it as `{source}`. */
export interface MessageFallbackPart {
	type: "fallback";
	source: string;
}

/** A `:string` value. */
export interface MessageStringPart {
	type: "string";
	source: string;
	locale: string;
	dir?: Direction;
	id?: string;
	value: string;
}

/** A `:number` or `:integer` value, split into `Intl.NumberFormat` parts. */
export interface MessageNumberPart {
	type: "number";
	source: string;
	locale: string;
	dir?: Direction;
	id?: string;
	parts: Intl.NumberFormatPart[];
}

/** An unannotated variable whose value is neither a string nor a number. */
export interface MessageUnknownPart {
	type: "unknown";
	source: string;
	id?: string;
	value: unknown;
}

/** A part produced by a custom function. */
export interface MessageExpressionPart {
	type: string;
	source: string;
	locale?: string;
	dir?: Direction;
	id?: string;
	value?: unknown;
	parts?: Array<{ type: string; value: unknown; source?: string }>;
}

/** One element of `formatToParts` output. */
export type MessagePart =
	| MessageTextPart
	| MessageBidiIsolationPart
	| MessageMarkupPart
	| MessageFallbackPart
	| MessageStringPart
	| MessageNumberPart
	| MessageUnknownPart
	| MessageExpressionPart;

/** The value of a placeholder that failed; selection on it matches only `*`. */
export function fallbackValue(source: string): MessageValue {
	return {
		type: "fallback",
		locale: "und",
		dir: "auto",
		source,
		toParts: () => [{ type: "fallback", source }],
		toString: () => `{${source}}`,
	};
}

/** True for a value produced by {@link fallbackValue}. */
export function isFallback(value: unknown): value is MessageValue {
	return isMessageValue(value) && value.type === "fallback";
}

/** True for an object shaped like a {@link MessageValue}. */
export function isMessageValue(value: unknown): value is MessageValue {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as MessageValue).type === "string" &&
		typeof (value as MessageValue).source === "string"
	);
}

/** Wraps an external value that is neither a string nor a number, formatting it with `String`. */
export function unknownValue(source: string, locale: string, value: unknown): MessageValue {
	return {
		type: "unknown",
		locale,
		dir: "auto",
		source,
		toParts: () => [{ type: "unknown", source, value }],
		toString: () => String(value),
		valueOf: () => value,
	};
}
