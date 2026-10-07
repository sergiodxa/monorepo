/**
 * Splits the text form into tokens, each carrying the offset it starts at, so
 * every parse failure can name the line and column where the text broke.
 * Literals are JSON literals, so a value reads exactly as it is stored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { ExpressionError } from "./expression-error.js";

/** One token of the text form. */
export interface Token {
	/**
	 * `word` is an operator name, a keyword or a dotted word, `path` a context
	 * path under `ctx.`, `quoted` a backtick-quoted name outside one, `literal` a
	 * JSON string or number, `symbol` punctuation or a comparison, `end` the end
	 * of the text.
	 */
	kind: "word" | "path" | "quoted" | "literal" | "symbol" | "end";
	/** The token as written, for messages. */
	text: string;
	/** The decoded field of a `path` token, without `ctx.`, or the value of a `literal`. */
	value?: unknown;
	/** Where the token starts, as an offset into the text. */
	offset: number;
}

/**
 * An identifier, then identifiers or array indexes after each dot. Only an
 * operator name or a keyword parses; a dotted word is reported as a path
 * written without `ctx.`.
 */
const WORD = /[A-Za-z_$][\w$]*(?:\.(?:[A-Za-z_$][\w$]*|\d+))*/y;

/** A segment of a context path a bare word can spell: an identifier or an array index. */
export const BARE_SEGMENT = /^(?:[A-Za-z_$][\w$]*|\d+)$/;

/** A context path: `ctx`, then one or more segments, each bare or backtick-quoted. */
const PATH = /ctx(?:\.(?:[A-Za-z_$][\w$]*|\d+|`(?:[^`\\]|\\[`\\])*`))+/y;

/** One segment of a matched context path, after its dot. */
const SEGMENT = /\.(?:([A-Za-z_$][\w$]*|\d+)|`((?:[^`\\]|\\[`\\])*)`)/y;

/** A JSON string, escapes included. */
// oxlint-disable-next-line no-control-regex -- JSON refuses an unescaped control character inside a string
const STRING = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;

/** A JSON number. */
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/** A backtick-quoted name outside a context path. */
const QUOTED = /`((?:[^`\\]|\\[`\\])*)`/y;

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

		let read = readToken(text, offset);
		if (isFailure(read)) return read;
		let token = read.data;
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

/**
 * Reads the one token that starts at `offset`, if any does. A context path is
 * tried before a word, so `ctx.plan` is one path rather than the word `ctx`.
 */
function readToken(text: string, offset: number): Result<Token | undefined, ExpressionError> {
	let path = match(PATH, text, offset);
	if (path !== undefined) return pathToken(text, path[0], offset);

	let word = match(WORD, text, offset);
	if (word !== undefined) {
		if (word[0] === "ctx" && text[offset + 3] === ".") {
			return failure(syntaxError("Expected a field after 'ctx.'", text, offset + 4));
		}
		return success({ kind: "word", text: word[0], offset });
	}

	let quoted = match(QUOTED, text, offset);
	if (quoted !== undefined) return success({ kind: "quoted", text: quoted[0], offset });

	let literal = match(STRING, text, offset) ?? match(NUMBER, text, offset);
	if (literal !== undefined) {
		return success({ kind: "literal", text: literal[0], value: JSON.parse(literal[0]), offset });
	}

	let symbol = match(SYMBOL, text, offset);
	if (symbol !== undefined) return success({ kind: "symbol", text: symbol[0], offset });

	return success(undefined);
}

/**
 * Decodes the segments of a matched context path into the dotted field it
 * names. A quoted segment holding a dot fails, since every dot of a field
 * separates two segments.
 */
function pathToken(text: string, written: string, offset: number): Result<Token, ExpressionError> {
	let segments: string[] = [];
	let at = 3;

	while (at < written.length) {
		let segment = match(SEGMENT, written, at) as RegExpExecArray;
		let quoted = segment[2];
		if (quoted !== undefined && quoted.includes(".")) {
			let message = "A quoted segment cannot hold '.', which separates segments";
			return failure(syntaxError(message, text, offset + at + 1));
		}
		segments.push(segment[1] ?? (quoted ?? "").replaceAll(/\\([`\\])/g, "$1"));
		at += segment[0].length;
	}

	return success({ kind: "path", text: written, value: segments.join("."), offset });
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
