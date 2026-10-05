/**
 * Splits the text form into tokens, each carrying the offset it starts at, so
 * every parse failure can name the line and column where the text broke.
 * Literals are JSON literals, so a value reads exactly as it is stored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { ExpressionError } from "./expression-error.js";

/** One token of the text form. */
export interface Token {
	/**
	 * `word` is a bare path or keyword, `path` a backtick-quoted path, `literal`
	 * a JSON string or number, `symbol` punctuation or a comparison, `end` the
	 * end of the text.
	 */
	kind: "word" | "path" | "literal" | "symbol" | "end";
	/** The token as written, for messages. */
	text: string;
	/** The decoded path of a `path` token, or the value of a `literal`. */
	value?: unknown;
	/** Where the token starts, as an offset into the text. */
	offset: number;
}

/** A bare path: an identifier, then identifiers or array indexes after each dot. */
export const WORD = /[A-Za-z_$][\w$]*(?:\.(?:[A-Za-z_$][\w$]*|\d+))*/y;

/** A JSON string, escapes included. */
// oxlint-disable-next-line no-control-regex -- JSON refuses an unescaped control character inside a string
const STRING = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;

/** A JSON number. */
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/** A backtick-quoted path, which names a field a bare path cannot spell. */
const QUOTED_PATH = /`((?:[^`\\]|\\[`\\])*)`/y;

/** Comparisons first, longest first, then single-character punctuation. */
const SYMBOL = /==|!=|<=|>=|[<>()[\]{},:]/y;

/** Whitespace between tokens, newlines included. */
const SPACE = /\s+/y;

/**
 * Reads every token of `text`, ending with an `end` token at its length.
 *
 * @param text The text form of an expression.
 * @returns The tokens, or a failure at the first character no token starts with.
 */
export function tokenize(text: string): Result<Token[], ExpressionError> {
	let tokens: Token[] = [];
	let offset = 0;

	while (offset < text.length) {
		let space = match(SPACE, text, offset);
		if (space !== undefined) {
			offset += space[0].length;
			continue;
		}

		let token = readToken(text, offset);
		if (token === undefined) {
			let character = String.fromCodePoint(text.codePointAt(offset) ?? 0);
			return failure(syntaxError(`Unexpected character '${character}'`, text, offset));
		}
		tokens.push(token);
		offset += token.text.length;
	}

	tokens.push({ kind: "end", text: "", offset: text.length });
	return success(tokens);
}

/** Reads the one token that starts at `offset`, if any does. */
function readToken(text: string, offset: number): Token | undefined {
	let word = match(WORD, text, offset);
	if (word !== undefined) return { kind: "word", text: word[0], offset };

	let quoted = match(QUOTED_PATH, text, offset);
	if (quoted !== undefined) {
		let value = (quoted[1] ?? "").replaceAll(/\\([`\\])/g, "$1");
		return { kind: "path", text: quoted[0], value, offset };
	}

	let literal = match(STRING, text, offset) ?? match(NUMBER, text, offset);
	if (literal !== undefined) {
		return { kind: "literal", text: literal[0], value: JSON.parse(literal[0]), offset };
	}

	let symbol = match(SYMBOL, text, offset);
	if (symbol !== undefined) return { kind: "symbol", text: symbol[0], offset };

	return undefined;
}

/** Runs a sticky pattern at one offset. */
function match(pattern: RegExp, text: string, offset: number): RegExpExecArray | undefined {
	pattern.lastIndex = offset;
	return pattern.exec(text) ?? undefined;
}

/**
 * Builds the error a parse failure reports, naming the 1-based line and
 * column `offset` falls on.
 */
export function syntaxError(message: string, text: string, offset: number): ExpressionError {
	let before = text.slice(0, offset);
	let line = before.split("\n").length;
	let column = offset - before.lastIndexOf("\n");
	return new ExpressionError(message, { line, column });
}
