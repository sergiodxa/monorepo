/**
 * The lexer for `.spec` source text: turns a file into the flat token stream
 * GRAMMAR.md's token table defines — literals, dotted identifiers, keywords,
 * punctuation, and significant newlines — with every failure reported as a
 * `ParseError` value, never a throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { parse as parseDuration } from "@pkg/duration";
import { failure, isFailure, success } from "@pkg/result";

import type { SourceFile } from "./source";
import type { Keyword, Token, TokenKind } from "./tokens";

import { ParseError } from "./errors";
import { KEYWORDS } from "./tokens";

/** Single-character punctuation, mapped to the token kind each one lexes as. */
const PUNCTUATION: Record<string, TokenKind | undefined> = {
	"{": "lbrace",
	"}": "rbrace",
	"(": "lparen",
	")": "rparen",
	",": "comma",
	":": "colon",
	"=": "equals",
};

/** The escape sequences a single-line string accepts, by escaped character. */
const STRING_ESCAPES: Record<string, string | undefined> = {
	'"': '"',
	"\\": "\\",
	n: "\n",
	t: "\t",
	r: "\r",
};

/** Matches a line that is empty or contains only horizontal whitespace. */
const BLANK_LINE = /^[ \t\r]*$/;

/** Matches the leading horizontal whitespace of a line. */
const LEADING_WHITESPACE = /^[ \t]*/;

/**
 * Tokenize a `.spec` file per GRAMMAR.md's lexical rules: `#` comments are
 * discarded, runs of newlines collapse into a single `newline` token, dotted
 * identifiers with adjacent dots lex as one token, and durations are
 * validated (and converted to milliseconds) at lex time. The stream always
 * ends with an `eof` token.
 *
 * @param source - The file to tokenize.
 * @returns The token stream, or a `ParseError` pointing at the offending text.
 */
export function lex(source: SourceFile): Result<Token[], ParseError> {
	let text = source.text;
	let tokens: Token[] = [];
	let index = 0;

	/** Abort lexing with a `ParseError` pointing at the offending range. */
	function fail(message: string, start: number, end: number): never {
		throw new ParseError(message, source.path, { start, end: Math.max(end, start + 1) });
	}

	/** Emit a newline token unless the previous token already is one. */
	function pushNewline(): void {
		let last = tokens[tokens.length - 1];
		if (last && last.kind !== "newline") {
			tokens.push({ kind: "newline", text: "\n", span: { start: index, end: index + 1 } });
		}
		index += 1;
	}

	/** Lex a `"…"` string, decoding its escape sequences. */
	function readString(): void {
		let start = index;
		index += 1;
		let value = "";
		while (true) {
			if (index >= text.length || text[index] === "\n") {
				fail(
					'Unterminated string: expected a closing `"` before the end of the line.',
					start,
					index,
				);
			}
			let char = text[index] ?? "";
			if (char === '"') {
				index += 1;
				break;
			}
			if (char === "\\") {
				let escape = text[index + 1] ?? "";
				let decoded = STRING_ESCAPES[escape];
				if (decoded === undefined) {
					fail(
						`Unknown escape sequence "\\${escape}" in string; expected \\" \\\\ \\n \\t or \\r.`,
						index,
						index + 2,
					);
				}
				value += decoded;
				index += 2;
				continue;
			}
			value += char;
			index += 1;
		}
		tokens.push({
			kind: "string",
			text: text.slice(start, index),
			span: { start, end: index },
			value,
		});
	}

	/** Lex a `"""…"""` multiline string; content is raw, then dedented. */
	function readMultilineString(): void {
		let start = index;
		index += 3;
		let close = text.indexOf('"""', index);
		if (close === -1) {
			fail('Unterminated multiline string: expected a closing `"""`.', start, text.length);
		}
		let raw = text.slice(index, close);
		index = close + 3;
		tokens.push({
			kind: "multiline-string",
			text: text.slice(start, index),
			span: { start, end: index },
			value: dedentMultiline(raw),
		});
	}

	/** Lex a number, or a duration when a unit is glued to the integer. */
	function readNumberOrDuration(): void {
		let start = index;
		if (text[index] === "-") index += 1;
		while (isDigit(text[index] ?? "")) index += 1;
		let isInteger = true;
		if (text[index] === "." && isDigit(text[index + 1] ?? "")) {
			isInteger = false;
			index += 1;
			while (isDigit(text[index] ?? "")) index += 1;
		}
		if (isIdentifierStart(text[index] ?? "")) {
			while (isIdentifierPart(text[index] ?? "")) index += 1;
			let raw = text.slice(start, index);
			if (!isInteger) {
				fail(`Invalid duration "${raw}": the amount must be a whole number.`, start, index);
			}
			let parsed = parseDuration(raw);
			if (isFailure(parsed)) {
				fail(
					`Invalid duration "${raw}": expected an integer followed by a unit like ms, s, m, h, d, or w.`,
					start,
					index,
				);
			}
			tokens.push({
				kind: "duration",
				text: raw,
				span: { start, end: index },
				value: parsed.data,
			});
			return;
		}
		let raw = text.slice(start, index);
		tokens.push({ kind: "number", text: raw, span: { start, end: index }, value: Number(raw) });
	}

	/** Lex an identifier, a keyword, or a dotted path joined by adjacent dots. */
	function readIdentifierOrKeyword(): void {
		let start = index;
		let segments: string[] = [];
		while (true) {
			let segmentStart = index;
			while (isIdentifierPart(text[index] ?? "")) index += 1;
			segments.push(text.slice(segmentStart, index));
			if (text[index] === "." && isIdentifierStart(text[index + 1] ?? "")) {
				index += 1;
				continue;
			}
			break;
		}
		let raw = text.slice(start, index);
		if (segments.length === 1) {
			let keyword = asKeyword(raw);
			if (keyword) {
				tokens.push({ kind: "keyword", text: raw, span: { start, end: index }, keyword });
				return;
			}
			tokens.push({ kind: "identifier", text: raw, span: { start, end: index } });
			return;
		}
		for (let segment of segments) {
			if (asKeyword(segment)) {
				fail(
					`The keyword "${segment}" is reserved and cannot appear in the dotted name "${raw}".`,
					start,
					index,
				);
			}
		}
		tokens.push({ kind: "identifier", text: raw, span: { start, end: index } });
	}

	try {
		while (index < text.length) {
			let char = text[index] ?? "";
			if (char === " " || char === "\t" || char === "\r") {
				index += 1;
			} else if (char === "\n") {
				pushNewline();
			} else if (char === "#") {
				while (index < text.length && text[index] !== "\n") index += 1;
			} else if (char === '"') {
				if (text.startsWith('"""', index)) readMultilineString();
				else readString();
			} else if (isDigit(char) || (char === "-" && isDigit(text[index + 1] ?? ""))) {
				readNumberOrDuration();
			} else if (isIdentifierStart(char)) {
				readIdentifierOrKeyword();
			} else {
				let kind = PUNCTUATION[char];
				if (!kind) fail(`Unexpected character ${JSON.stringify(char)}.`, index, index + 1);
				tokens.push({ kind, text: char, span: { start: index, end: index + 1 } });
				index += 1;
			}
		}
		tokens.push({ kind: "eof", text: "", span: { start: text.length, end: text.length } });
		return success(tokens);
	} catch (error) {
		if (error instanceof ParseError) return failure(error);
		let message = error instanceof Error ? error.message : String(error);
		return failure(new ParseError(message, source.path));
	}
}

/** Whether the character can start an identifier segment. */
function isIdentifierStart(char: string): boolean {
	return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
}

/** Whether the character can continue an identifier segment. */
function isIdentifierPart(char: string): boolean {
	return isIdentifierStart(char) || isDigit(char);
}

/** Whether the character is an ASCII digit. */
function isDigit(char: string): boolean {
	return char >= "0" && char <= "9";
}

/** The reserved word the text spells, or `undefined` when it is not one. */
function asKeyword(text: string): Keyword | undefined {
	return KEYWORDS.find((keyword) => keyword === text);
}

/**
 * Apply GRAMMAR.md's three multiline-string steps in order: drop a leading
 * newline, drop the whitespace that indents a closing delimiter sitting on
 * its own line (keeping the final newline), then strip the common indentation
 * of the non-blank lines. No escape sequences are processed; content is raw.
 *
 * @param raw - The text between the `"""` delimiters, untouched.
 * @returns The processed string value.
 */
function dedentMultiline(raw: string): string {
	let content = raw;
	if (content.startsWith("\r\n")) content = content.slice(2);
	else if (content.startsWith("\n")) content = content.slice(1);
	let lastBreak = content.lastIndexOf("\n");
	if (lastBreak !== -1) {
		let tail = content.slice(lastBreak + 1);
		if (tail.length > 0 && BLANK_LINE.test(tail)) content = content.slice(0, lastBreak + 1);
	}
	let lines = content.split("\n");
	let indent: string | undefined;
	for (let line of lines) {
		if (BLANK_LINE.test(line)) continue;
		let leading = LEADING_WHITESPACE.exec(line)?.[0] ?? "";
		indent = indent === undefined ? leading : commonPrefix(indent, leading);
	}
	if (indent === undefined || indent === "") return content;
	let prefix = indent;
	return lines
		.map((line) => {
			let leading = LEADING_WHITESPACE.exec(line)?.[0] ?? "";
			let strip = commonPrefix(prefix, leading);
			return line.slice(strip.length);
		})
		.join("\n");
}

/** The longest prefix two strings share, character by character. */
function commonPrefix(left: string, right: string): string {
	let length = 0;
	while (length < left.length && length < right.length && left[length] === right[length]) {
		length += 1;
	}
	return left.slice(0, length);
}
