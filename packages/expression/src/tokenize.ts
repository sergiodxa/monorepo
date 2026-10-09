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

/** A context path segment written bare: an identifier or an array index. */
const BARE = /[A-Za-z_$][\w$]*|\d+/y;

/** One escape inside a JSON string, from its backslash. */
const STRING_ESCAPE = /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/y;

/** A JSON number. */
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

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
	let path = readPath(text, offset);
	if (path !== undefined) return path;

	let word = match(WORD, text, offset);
	if (word !== undefined) {
		if (word[0] === "ctx" && text[offset + 3] === ".") {
			return failure(syntaxError("Expected a field after 'ctx.'", text, offset + 4));
		}
		return success({ kind: "word", text: word[0], offset });
	}

	let quotedEnd = quotedNameEnd(text, offset);
	if (quotedEnd !== undefined) {
		return success({ kind: "quoted", text: text.slice(offset, quotedEnd), offset });
	}

	let stringEnd = jsonStringEnd(text, offset);
	let literal =
		stringEnd === undefined ? match(NUMBER, text, offset)?.[0] : text.slice(offset, stringEnd);
	if (literal !== undefined) {
		return success({ kind: "literal", text: literal, value: JSON.parse(literal), offset });
	}

	let symbol = match(SYMBOL, text, offset);
	if (symbol !== undefined) return success({ kind: "symbol", text: symbol[0], offset });

	return success(undefined);
}

/**
 * Reads the context path at `offset`: `ctx`, then one or more segments, each bare or
 * backtick-quoted. Without a segment after `ctx.` nothing is read, so the word rule reports it. A
 * quoted segment holding a dot fails, since every dot of a field separates two segments.
 */
function readPath(text: string, offset: number): Result<Token, ExpressionError> | undefined {
	if (!text.startsWith("ctx.", offset)) return undefined;
	let segments: string[] = [];
	let at = offset + 3;

	while (text.charAt(at) === ".") {
		let bare = match(BARE, text, at + 1);
		if (bare !== undefined) {
			segments.push(bare[0]);
			at += 1 + bare[0].length;
			continue;
		}

		let end = quotedNameEnd(text, at + 1);
		if (end === undefined) break;
		let quoted = text.slice(at + 2, end - 1);
		if (quoted.includes(".")) {
			let message = "A quoted segment cannot hold '.', which separates segments";
			return failure(syntaxError(message, text, at + 1));
		}
		segments.push(quoted.replaceAll(/\\([`\\])/g, "$1"));
		at = end;
	}

	if (segments.length === 0) return undefined;
	let written = text.slice(offset, at);
	return success({ kind: "path", text: written, value: segments.join("."), offset });
}

/**
 * Where the backtick-quoted name starting at `offset` ends, past its closing backtick. Inside it
 * a backslash escapes only a backtick or a backslash; an unclosed name ends nowhere.
 */
function quotedNameEnd(text: string, offset: number): number | undefined {
	if (text.charAt(offset) !== "`") return undefined;
	let at = offset + 1;
	while (at < text.length) {
		let character = text.charAt(at);
		if (character === "`") return at + 1;
		if (character === "\\") {
			let escaped = text.charAt(at + 1);
			if (escaped !== "`" && escaped !== "\\") return undefined;
			at += 2;
		} else {
			at += 1;
		}
	}
	return undefined;
}

/**
 * Where the JSON string starting at `offset` ends, past its closing quote. An unescaped control
 * character, an unknown escape or a missing closing quote ends it nowhere, as JSON refuses them.
 */
function jsonStringEnd(text: string, offset: number): number | undefined {
	if (text.charAt(offset) !== '"') return undefined;
	let at = offset + 1;
	while (at < text.length) {
		let code = text.charCodeAt(at);
		if (code === 0x22) return at + 1;
		if (code < 0x20) return undefined;
		if (code === 0x5c) {
			let escape = match(STRING_ESCAPE, text, at);
			if (escape === undefined) return undefined;
			at += escape[0].length;
		} else {
			at += 1;
		}
	}
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
