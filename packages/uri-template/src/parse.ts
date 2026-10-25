/**
 * Reads RFC 6570 template text into literal parts and expressions, enforcing the section 2
 * grammar at level 4: the eight operators, dotted variable names, and one `:N` or `*`
 * modifier per variable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Expression, Operator, TemplatePart, VariableSpec } from "./syntax.js";

import { encodeLiteral } from "./encode.js";
import { UriTemplateError } from "./error.js";

/** The operator characters section 2.2 defines. */
const OPERATOR_CHARS = new Set(["+", "#", ".", "/", ";", "?", "&"]);

/** Operator characters section 2.2 reserves for future extensions, which a template may not use. */
const RESERVED_OPERATORS = new Set(["=", ",", "!", "@", "|"]);

/** ASCII characters literal text may hold: section 2.1, plus the `'` sub-delimiter RFC errata restore. */
const LITERAL_ASCII = /[!#$&-;=?-[\]_a-z~]/;

/** One `varchar`: a letter, digit, underscore, or percent-encoded octet. */
const VARCHAR = /[A-Za-z0-9_]|%[0-9A-Fa-f]{2}/y;

/** A `max-length`: 1 to 9999 with no leading zero. */
const MAX_LENGTH = /[1-9]\d{0,3}/y;

/**
 * Parses a template into its parts, literal text already percent-encoded for output.
 *
 * @param template - The template text.
 * @returns The parts, or where and why the text is not a URI Template.
 */
export function parseTemplate(template: string): Result<TemplatePart[], UriTemplateError> {
	let parts: TemplatePart[] = [];
	let literal = "";
	let pos = 0;
	while (pos < template.length) {
		let char = template[pos] as string;
		if (char === "{") {
			if (literal !== "") parts.push(encodeLiteral(literal));
			literal = "";
			let parsed = parseExpression(template, pos + 1);
			if (isFailure(parsed)) return parsed;
			parts.push(parsed.data.expression);
			pos = parsed.data.end;
			continue;
		}
		let code = template.codePointAt(pos) as number;
		if (char === "%") {
			if (!/^%[0-9A-Fa-f]{2}$/.test(template.slice(pos, pos + 3))) {
				return fail(pos, "A '%' in literal text must start a percent-encoded octet");
			}
			literal += template.slice(pos, pos + 3);
			pos += 3;
			continue;
		}
		if (code < 0x80 ? !LITERAL_ASCII.test(char) : code >= 0xd800 && code <= 0xdfff) {
			return fail(pos, `${JSON.stringify(char)} cannot appear in literal text`);
		}
		let text = String.fromCodePoint(code);
		literal += text;
		pos += text.length;
	}
	if (literal !== "") parts.push(encodeLiteral(literal));
	return success(parts);
}

/** The expression starting just after its `{`, and the offset just after its `}`. */
function parseExpression(
	template: string,
	start: number,
): Result<{ expression: Expression; end: number }, UriTemplateError> {
	let pos = start;
	let operator: Operator = "";
	let first = template[pos] ?? "";
	if (OPERATOR_CHARS.has(first)) {
		operator = first as Operator;
		pos++;
	} else if (RESERVED_OPERATORS.has(first)) {
		return fail(pos, `The operator ${JSON.stringify(first)} is reserved`);
	}
	let variables: VariableSpec[] = [];
	for (;;) {
		let name = readName(template, pos);
		if (name === "") return fail(pos, "Expected a variable name");
		pos += name.length;
		let prefix: number | null = null;
		let explode = false;
		if (template[pos] === ":") {
			MAX_LENGTH.lastIndex = pos + 1;
			let match = MAX_LENGTH.exec(template);
			if (match === null) return fail(pos + 1, "A prefix length is 1 to 9999");
			prefix = Number(match[0]);
			pos += 1 + match[0].length;
		} else if (template[pos] === "*") {
			explode = true;
			pos++;
		}
		variables.push({ name, prefix, explode });
		if (template[pos] === ",") {
			pos++;
			continue;
		}
		if (template[pos] === "}")
			return success({ expression: { operator, variables, offset: start - 1 }, end: pos + 1 });
		if (pos >= template.length) return fail(start - 1, "Unclosed expression");
		return fail(pos, "Expected ',' or '}'");
	}
}

/** A `varname`: varchars, with single dots between them. */
function readName(template: string, start: number): string {
	let pos = start;
	for (;;) {
		VARCHAR.lastIndex = pos;
		let match = VARCHAR.exec(template);
		if (match === null) break;
		pos += match[0].length;
		if (template[pos] === "." && template[pos + 1] !== undefined) {
			VARCHAR.lastIndex = pos + 1;
			if (VARCHAR.test(template)) pos++;
		}
	}
	return template.slice(start, pos);
}

/** The failure at `offset`. */
function fail(offset: number, message: string): Result<never, UriTemplateError> {
	return failure(new UriTemplateError(offset, message));
}
