/**
 * Token vocabulary shared by the lexer and parser. The set is intentionally
 * tiny: the language has no operators, so tokens are literals, identifiers,
 * keywords, a handful of punctuation marks, and significant newlines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Span } from "./source.js";

/** Reserved words; never valid as identifiers, tool names, or definitions. */
export const KEYWORDS = [
	"use",
	"test",
	"given",
	"when",
	"then",
	"command",
	"fixture",
	"let",
	"return",
	"expect",
	"eventually",
	"within",
	"true",
	"false",
] as const;

/** One of the reserved words in {@link KEYWORDS}. */
export type Keyword = (typeof KEYWORDS)[number];

/**
 * Every kind of token the lexer emits. `identifier` covers dotted paths too:
 * identifiers joined by `.` with no surrounding whitespace lex as a single
 * token whose text contains the dots (`http.post`, `user.email`).
 */
export type TokenKind =
	| "string"
	| "multiline-string"
	| "number"
	| "duration"
	| "identifier"
	| "keyword"
	| "lbrace"
	| "rbrace"
	| "lparen"
	| "rparen"
	| "comma"
	| "colon"
	| "equals"
	| "newline"
	| "eof";

/** A lexed token: kind, raw text, location, and decoded value when relevant. */
export interface Token {
	kind: TokenKind;
	/** The raw source text the token covers. */
	text: string;
	/** Where in the file the token sits. */
	span: Span;
	/**
	 * Decoded payload: the unescaped/dedented content for strings, the numeric
	 * value for numbers, milliseconds for durations. Absent otherwise.
	 */
	value?: string | number;
	/** The specific reserved word, present when `kind` is `"keyword"`. */
	keyword?: Keyword;
}
