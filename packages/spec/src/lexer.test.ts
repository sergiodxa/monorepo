/**
 * Lexer tests: the token table, comments, string escapes, the three
 * multiline-string processing steps, durations, dotted identifiers, newline
 * collapsing, and spans — each lexical rule of GRAMMAR.md pinned by example.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { ParseError } from "./errors";
import type { Token, TokenKind } from "./tokens";

import { lex } from "./lexer";
import { positionAt } from "./source";
import { KEYWORDS } from "./tokens";

/** Lex text that must tokenize, throwing the failure otherwise. */
function lexOk(text: string): Token[] {
	let result = lex({ path: "test.spec", text });
	if (!isSuccess(result)) throw new Error(`expected lex to succeed: ${result.error.message}`);
	return result.data;
}

/** Lex text that must fail, returning the error for assertions. */
function lexError(text: string): ParseError {
	let result = lex({ path: "test.spec", text });
	if (!isFailure(result)) throw new Error(`expected lex to fail: ${text}`);
	return result.error;
}

/** The kinds of a token list, for shape assertions. */
function kinds(tokens: Token[]): TokenKind[] {
	return tokens.map((token) => token.kind);
}

describe("lex: identifiers and keywords", () => {
	test("every reserved word lexes as a keyword token", () => {
		for (let word of KEYWORDS) {
			let tokens = lexOk(word);
			let [token] = tokens;
			expect(token?.kind).toBe("keyword");
			expect(token?.keyword).toBe(word);
			expect(token?.text).toBe(word);
		}
	});

	test("identifiers and dotted paths lex as single identifier tokens", () => {
		let tokens = lexOk("run http.post user.email_2");
		expect(kinds(tokens)).toEqual(["identifier", "identifier", "identifier", "eof"]);
		expect(tokens[0]?.text).toBe("run");
		expect(tokens[1]?.text).toBe("http.post");
		expect(tokens[2]?.text).toBe("user.email_2");
	});

	test("a dot merges segments only when adjacent on both sides", () => {
		expect(lexError("foo. bar").message).toContain('Unexpected character "."');
		expect(lexError("foo .bar").message).toContain('Unexpected character "."');
	});

	test("keywords cannot appear inside dotted names", () => {
		let error = lexError("http.true");
		expect(error.message).toContain('The keyword "true" is reserved');
		expect(error.message).toContain("http.true");
	});
});

describe("lex: punctuation and numbers", () => {
	test("punctuation lexes to its own kinds", () => {
		expect(kinds(lexOk("{ } ( ) , : ="))).toEqual([
			"lbrace",
			"rbrace",
			"lparen",
			"rparen",
			"comma",
			"colon",
			"equals",
			"eof",
		]);
	});

	test("integers, floats, and negatives lex as numbers", () => {
		expect(lexOk("42")[0]?.value).toBe(42);
		expect(lexOk("-7")[0]?.value).toBe(-7);
		expect(lexOk("3.14")[0]?.value).toBe(3.14);
		expect(lexOk("-0.5")[0]?.value).toBe(-0.5);
	});

	test("an unexpected character is a lex error", () => {
		expect(lexError("@").message).toContain('Unexpected character "@"');
	});
});

describe("lex: durations", () => {
	test("an integer glued to a unit lexes as one duration token in ms", () => {
		let cases: Array<[string, number]> = [
			["10s", 10_000],
			["500ms", 500],
			["3m", 180_000],
			["2h", 7_200_000],
			["1d", 86_400_000],
		];
		for (let [text, milliseconds] of cases) {
			let [token] = lexOk(text);
			expect(token?.kind).toBe("duration");
			expect(token?.text).toBe(text);
			expect(token?.value).toBe(milliseconds);
		}
	});

	test("an unknown unit is a lex error", () => {
		let error = lexError("10x");
		expect(error.message).toContain('Invalid duration "10x"');
		expect(error.message).toContain("ms, s, m, h, d, or w");
	});

	test("a fractional amount is a lex error", () => {
		expect(lexError("1.5s").message).toContain("whole number");
	});
});

describe("lex: strings", () => {
	test("a single-line string decodes its escapes", () => {
		let [token] = lexOk('"a\\"b\\\\c\\nd\\te\\rf"');
		expect(token?.kind).toBe("string");
		expect(token?.value).toBe('a"b\\c\nd\te\rf');
	});

	test("an unknown escape sequence is a lex error", () => {
		expect(lexError('"\\q"').message).toContain('Unknown escape sequence "\\q"');
	});

	test("a string must close before the end of the line", () => {
		expect(lexError('"abc').message).toContain("Unterminated string");
		expect(lexError('"abc\ndef"').message).toContain("Unterminated string");
	});

	test("a # inside a string is content, not a comment", () => {
		let tokens = lexOk('"a # b"');
		expect(kinds(tokens)).toEqual(["string", "eof"]);
		expect(tokens[0]?.value).toBe("a # b");
	});
});

describe("lex: multiline strings", () => {
	test("the GRAMMAR.md example produces the file content plus a newline", () => {
		let tokens = lexOk('write "index.js" """\n  console.log("hello")\n"""');
		expect(kinds(tokens)).toEqual(["identifier", "string", "multiline-string", "eof"]);
		expect(tokens[2]?.value).toBe('console.log("hello")\n');
	});

	test("step 1: a newline right after the opening delimiter is dropped", () => {
		expect(lexOk('"""\nabc"""')[0]?.value).toBe("abc");
	});

	test("step 2: whitespace indenting a closing delimiter on its own line is dropped", () => {
		expect(lexOk('"""\nabc\n\t"""')[0]?.value).toBe("abc\n");
	});

	test("step 3: the common indentation of non-blank lines is stripped", () => {
		expect(lexOk('"""\n\t\tfirst\n\t\t\tsecond\n\t"""')[0]?.value).toBe("first\n\tsecond\n");
	});

	test("blank interior lines survive and do not affect the common indent", () => {
		expect(lexOk('"""\n\tfoo\n\n\tbar\n"""')[0]?.value).toBe("foo\n\nbar\n");
	});

	test("a whitespace-only line with less indentation does not cap the strip", () => {
		// The middle line is a single space: it is blank, so the common indent
		// stays two spaces (per GRAMMAR.md, blank lines are ignored when
		// computing it) and the text lines dedent fully.
		expect(lexOk('"""\n  a\n \n  b\n"""')[0]?.value).toBe("a\n\nb\n");
	});

	test("content is raw: escape sequences are not processed", () => {
		expect(lexOk('"""a\\nb"""')[0]?.value).toBe("a\\nb");
	});

	test("a closing delimiter not on its own line keeps the last line intact", () => {
		expect(lexOk('"""\nhello\nworld"""')[0]?.value).toBe("hello\nworld");
	});

	test("a # inside a multiline string is content, not a comment", () => {
		expect(lexOk('"""\n# raw\n"""')[0]?.value).toBe("# raw\n");
	});

	test("an unterminated multiline string is a lex error", () => {
		expect(lexError('"""abc').message).toContain("Unterminated multiline string");
	});
});

describe("lex: comments and newlines", () => {
	test("comments are discarded, trailing and full-line alike", () => {
		let tokens = lexOk("use fs # trailing\n# full line\nuse http");
		expect(kinds(tokens)).toEqual([
			"keyword",
			"identifier",
			"newline",
			"keyword",
			"identifier",
			"eof",
		]);
	});

	test("runs of newlines collapse into a single newline token", () => {
		let tokens = lexOk("\n\nuse fs\n\n\nuse http\n\n");
		expect(kinds(tokens)).toEqual([
			"keyword",
			"identifier",
			"newline",
			"keyword",
			"identifier",
			"newline",
			"eof",
		]);
	});

	test("carriage returns are insignificant, so CRLF files lex", () => {
		let tokens = lexOk("use fs\r\nuse http");
		expect(kinds(tokens)).toEqual([
			"keyword",
			"identifier",
			"newline",
			"keyword",
			"identifier",
			"eof",
		]);
	});

	test("an empty or blank file lexes to just eof", () => {
		expect(kinds(lexOk(""))).toEqual(["eof"]);
		expect(kinds(lexOk("   \n \t\n"))).toEqual(["eof"]);
	});
});

describe("lex: spans", () => {
	test("tokens carry the exact source range they cover", () => {
		let tokens = lexOk("use fs");
		expect(tokens[0]?.span).toEqual({ start: 0, end: 3 });
		expect(tokens[1]?.span).toEqual({ start: 4, end: 6 });
		expect(tokens[2]?.span).toEqual({ start: 6, end: 6 });
	});

	test("spans translate to lines and columns via positionAt", () => {
		let text = "use fs\nlet x = 10s";
		let source = { path: "test.spec", text };
		let tokens = lexOk(text);
		let letToken = tokens.find((token) => token.text === "let");
		let durationToken = tokens.find((token) => token.kind === "duration");
		expect(letToken).toBeDefined();
		expect(durationToken).toBeDefined();
		expect(positionAt(source, letToken?.span.start ?? -1)).toEqual({ line: 2, column: 1 });
		expect(positionAt(source, durationToken?.span.start ?? -1)).toEqual({ line: 2, column: 9 });
	});
});
