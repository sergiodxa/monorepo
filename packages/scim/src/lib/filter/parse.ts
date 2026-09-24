/**
 * A tokenizer and recursive-descent parser for the RFC 7644 §3.4.2.2 filter ABNF, and the
 * §3.5.2 PATCH path built on the same pieces. Keywords match case-insensitively and
 * precedence runs `not` over `and` over `or`, both logical operators associating left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Filter } from "../../filter.js";
import type { Scim } from "../../index.js";
import type { Patch } from "../../patch.js";

import { badRequest, ScimError } from "../error.js";

/** A lexical unit of filter text; `position` is its offset, for error details. */
type Token =
	| { kind: "(" | ")" | "[" | "]"; position: number }
	| { kind: "word"; text: string; position: number }
	| { kind: "string"; value: string; position: number }
	| { kind: "number"; value: number; position: number };

/** The operators RFC 7644 Table 3 defines, lowercased. */
const OPERATORS = new Set<string>(["eq", "ne", "co", "sw", "ew", "gt", "ge", "lt", "le"]);

/** RFC 7644 `ATTRNAME`, plus `$ref`, which RFC 7643 §2.1 names as the one exception. */
const ATTRIBUTE_NAME = /^(?:\$ref|[A-Za-z][\w-]*)$/;

/** A JSON number, the only numeric form a `compValue` may take. */
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

/** Characters that end a word or number without being part of it. */
const DELIMITER = /[\s()[\]"]/;

/**
 * Splits filter text into tokens. A word is any run of characters up to whitespace, a
 * bracket, a parenthesis or a quote; the parser decides whether it is a path or a keyword.
 *
 * @param text - The filter or path text
 * @param scimType - The `scimType` a lexical error carries
 * @returns The tokens, or the first lexical error
 */
function tokenize(text: string, scimType: Scim.ErrorType): Token[] | ScimError {
	let tokens: Token[] = [];
	let index = 0;

	while (index < text.length) {
		let char = text.charAt(index);

		if (/\s/.test(char)) {
			index += 1;
		} else if (char === "(" || char === ")" || char === "[" || char === "]") {
			tokens.push({ kind: char, position: index });
			index += 1;
		} else if (char === '"') {
			let end = index + 1;
			while (end < text.length && text.charAt(end) !== '"') {
				end += text.charAt(end) === "\\" ? 2 : 1;
			}
			if (end >= text.length) {
				return badRequest(scimType, `Unterminated string starting at position ${index}.`);
			}
			let value = parseJsonString(text.slice(index, end + 1));
			if (value === null) {
				return badRequest(scimType, `Invalid string escape starting at position ${index}.`);
			}
			tokens.push({ kind: "string", value, position: index });
			index = end + 1;
		} else {
			let end = index;
			while (end < text.length && !DELIMITER.test(text.charAt(end))) end += 1;
			let word = text.slice(index, end);
			let number = NUMBER.exec(word);
			if (number && number[0] === word) {
				tokens.push({ kind: "number", value: Number(word), position: index });
			} else {
				tokens.push({ kind: "word", text: word, position: index });
			}
			index = end;
		}
	}

	return tokens;
}

/**
 * Decodes a quoted JSON string literal, escapes included.
 *
 * @param literal - The literal with its quotes
 * @returns The decoded string, or `null` when an escape is invalid
 */
function parseJsonString(literal: string): string | null {
	try {
		let value: unknown = JSON.parse(literal);
		return typeof value === "string" ? value : null;
	} catch {
		return null;
	}
}

/**
 * Reads RFC 7644 attribute notation, `[URN ":"] ATTRNAME ["." ATTRNAME]`. The URN is
 * everything before the last colon, since URNs contain both colons and dots.
 *
 * @param text - A word token's text
 * @returns The path, or `null` when the text is not attribute notation
 */
function readPath(text: string): Filter.AttributePath | null {
	let schema: string | null = null;
	let rest = text;
	let colon = text.lastIndexOf(":");
	if (colon !== -1) {
		schema = text.slice(0, colon);
		rest = text.slice(colon + 1);
		if (!/^urn:[^:]+:./i.test(schema)) return null;
	}

	let parts = rest.split(".");
	if (parts.length > 2 || !parts.every((part) => ATTRIBUTE_NAME.test(part))) return null;
	let [attribute = "", subAttribute = null] = parts;
	return { schema, attribute, subAttribute };
}

/** The parser's position in a token list, advanced as tokens are consumed. */
interface Cursor {
	tokens: Token[];
	index: number;
	/** The `scimType` every syntax error carries: `invalidFilter`, or `invalidPath` in PATCH. */
	scimType: Scim.ErrorType;
}

/**
 * The token under the cursor, without consuming it.
 *
 * @param cursor - The parser position
 * @param offset - How far past the cursor to look
 * @returns The token, or `undefined` at the end
 */
function peek(cursor: Cursor, offset = 0): Token | undefined {
	return cursor.tokens[cursor.index + offset];
}

/**
 * Whether the token is the given keyword, ignoring case.
 *
 * @param token - The token to test
 * @param keyword - The lowercase keyword
 * @returns Whether it matches
 */
function isKeyword(token: Token | undefined, keyword: string): boolean {
	return token?.kind === "word" && token.text.toLowerCase() === keyword;
}

/**
 * A syntax error naming what the parser expected where it stopped.
 *
 * @param cursor - The parser position
 * @param expected - What would have been valid
 * @returns The error
 */
function unexpected(cursor: Cursor, expected: string): ScimError {
	let token = peek(cursor);
	let where = token ? `at position ${token.position}` : "at the end of the input";
	return badRequest(cursor.scimType, `Expected ${expected} ${where}.`);
}

/**
 * Parses `FILTER`: a chain of `and`-terms joined by `or`.
 *
 * @param cursor - The parser position
 * @param inValuePath - Whether the text sits inside `[...]`, where value paths cannot nest
 * @returns The expression, or a syntax error
 */
function parseOr(cursor: Cursor, inValuePath: boolean): Filter.Expression | ScimError {
	let left = parseAnd(cursor, inValuePath);
	if (left instanceof ScimError) return left;
	while (isKeyword(peek(cursor), "or")) {
		cursor.index += 1;
		let right = parseAnd(cursor, inValuePath);
		if (right instanceof ScimError) return right;
		left = { kind: "or", left, right };
	}
	return left;
}

/**
 * Parses a chain of terms joined by `and`, which binds tighter than `or`.
 *
 * @param cursor - The parser position
 * @param inValuePath - Whether the text sits inside `[...]`
 * @returns The expression, or a syntax error
 */
function parseAnd(cursor: Cursor, inValuePath: boolean): Filter.Expression | ScimError {
	let left = parseTerm(cursor, inValuePath);
	if (left instanceof ScimError) return left;
	while (isKeyword(peek(cursor), "and")) {
		cursor.index += 1;
		let right = parseTerm(cursor, inValuePath);
		if (right instanceof ScimError) return right;
		left = { kind: "and", left, right };
	}
	return left;
}

/**
 * Parses one term: `not (...)`, a parenthesized group, a value path or an attribute
 * expression. `not` is a keyword only when a parenthesis follows it, so an attribute may
 * still be named `not`.
 *
 * @param cursor - The parser position
 * @param inValuePath - Whether the text sits inside `[...]`
 * @returns The expression, or a syntax error
 */
function parseTerm(cursor: Cursor, inValuePath: boolean): Filter.Expression | ScimError {
	let token = peek(cursor);

	if (isKeyword(token, "not") && peek(cursor, 1)?.kind === "(") {
		cursor.index += 1;
		let group = parseGroup(cursor, inValuePath);
		if (group instanceof ScimError) return group;
		return { kind: "not", expression: group };
	}

	if (token?.kind === "(") return parseGroup(cursor, inValuePath);
	if (token?.kind !== "word") return unexpected(cursor, "an attribute path");

	let path = readPath(token.text);
	if (!path) {
		return badRequest(
			cursor.scimType,
			`"${token.text}" at position ${token.position} is not an attribute path.`,
		);
	}
	cursor.index += 1;

	if (peek(cursor)?.kind === "[") {
		if (inValuePath) return badRequest(cursor.scimType, "Value paths cannot nest.");
		if (path.subAttribute !== null) {
			return badRequest(cursor.scimType, "A value path filters an attribute, not a sub-attribute.");
		}
		cursor.index += 1;
		let filter = parseOr(cursor, true);
		if (filter instanceof ScimError) return filter;
		if (peek(cursor)?.kind !== "]") return unexpected(cursor, '"]"');
		cursor.index += 1;
		return { kind: "valuePath", path, filter };
	}

	let operator = peek(cursor);
	if (operator?.kind !== "word") return unexpected(cursor, "an operator");
	let name = operator.text.toLowerCase();
	cursor.index += 1;

	if (name === "pr") return { kind: "present", path };
	if (!OPERATORS.has(name)) {
		return badRequest(
			cursor.scimType,
			`"${operator.text}" at position ${operator.position} is not a filter operator.`,
		);
	}

	let value = parseValue(cursor);
	if (value instanceof ScimError) return value;
	return { kind: "compare", path, operator: name as Filter.Operator, value };
}

/**
 * Parses `"(" FILTER ")"`.
 *
 * @param cursor - The parser position, on the opening parenthesis
 * @param inValuePath - Whether the text sits inside `[...]`
 * @returns The inner expression, or a syntax error
 */
function parseGroup(cursor: Cursor, inValuePath: boolean): Filter.Expression | ScimError {
	if (peek(cursor)?.kind !== "(") return unexpected(cursor, '"("');
	cursor.index += 1;
	let inner = parseOr(cursor, inValuePath);
	if (inner instanceof ScimError) return inner;
	if (peek(cursor)?.kind !== ")") return unexpected(cursor, '")"');
	cursor.index += 1;
	return inner;
}

/**
 * Parses `compValue`: a string, a number, or `true`/`false`/`null` in any case, as ABNF
 * literals are case-insensitive.
 *
 * @param cursor - The parser position
 * @returns The value, or a syntax error
 */
function parseValue(cursor: Cursor): Filter.Value | ScimError {
	let token = peek(cursor);
	if (token?.kind === "string" || token?.kind === "number") {
		cursor.index += 1;
		return token.value;
	}
	if (token?.kind === "word") {
		let lower = token.text.toLowerCase();
		if (lower === "true" || lower === "false" || lower === "null") {
			cursor.index += 1;
			return lower === "null" ? null : lower === "true";
		}
	}
	return unexpected(cursor, "a quoted string, a number, true, false or null");
}

/**
 * Parses a SCIM filter. Any text the RFC 7644 §3.4.2.2 ABNF accepts parses; anything else
 * fails with `400 invalidFilter` and a detail naming the position.
 *
 * @param text - The filter, as read from the `filter` query parameter or search body
 * @returns The expression tree
 * @example parseFilter('userName eq "bjensen"')
 * @example parseFilter('emails[type eq "work" and value co "@example.com"]')
 */
export function parseFilter(text: string): Result<Filter.Expression, ScimError> {
	let tokens = tokenize(text, "invalidFilter");
	if (tokens instanceof ScimError) return failure(tokens);
	let cursor: Cursor = { tokens, index: 0, scimType: "invalidFilter" };
	let expression = parseOr(cursor, false);
	if (expression instanceof ScimError) return failure(expression);
	if (cursor.index < tokens.length) return failure(unexpected(cursor, '"and", "or" or the end'));
	return success(expression);
}

/**
 * Parses attribute notation such as `name.familyName` or a fully qualified
 * `urn:ietf:params:scim:schemas:core:2.0:User:userName`, as `sortBy` and `attributes` take.
 *
 * @param text - The path
 * @returns The path, or `400 invalidPath`
 */
export function parsePath(text: string): Result<Filter.AttributePath, ScimError> {
	let path = readPath(text.trim());
	if (!path) return failure(badRequest("invalidPath", `"${text}" is not an attribute path.`));
	return success(path);
}

/**
 * Parses a PATCH `path`, RFC 7644 §3.5.2's `attrPath / valuePath [subAttr]`, with the value
 * filter parsed by the same grammar as `filter`.
 *
 * @param text - The operation's `path`
 * @returns The target, or `400 invalidPath`
 */
export function parsePatchPath(text: string): Result<Patch.Path, ScimError> {
	let tokens = tokenize(text, "invalidPath");
	if (tokens instanceof ScimError) return failure(tokens);
	let cursor: Cursor = { tokens, index: 0, scimType: "invalidPath" };

	let first = peek(cursor);
	let attribute = first?.kind === "word" ? readPath(first.text) : null;
	if (!attribute) return failure(badRequest("invalidPath", `"${text}" is not a PATCH path.`));
	cursor.index += 1;

	let filter: Filter.Expression | null = null;
	let subAttribute: string | null = null;

	if (peek(cursor)?.kind === "[") {
		if (attribute.subAttribute !== null) {
			return failure(
				badRequest("invalidPath", "A value path filters an attribute, not a sub-attribute."),
			);
		}
		cursor.index += 1;
		let parsed = parseOr(cursor, true);
		if (parsed instanceof ScimError) return failure(parsed);
		if (peek(cursor)?.kind !== "]") return failure(unexpected(cursor, '"]"'));
		cursor.index += 1;
		filter = parsed;

		let after = peek(cursor);
		if (after?.kind === "word") {
			let name = after.text.slice(1);
			if (!after.text.startsWith(".") || !ATTRIBUTE_NAME.test(name)) {
				return failure(unexpected(cursor, "a sub-attribute"));
			}
			subAttribute = name;
			cursor.index += 1;
		}
	}

	if (cursor.index < tokens.length) return failure(unexpected(cursor, "the end of the path"));
	return success({ attribute, filter, subAttribute });
}
