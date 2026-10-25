/**
 * Matches a URI against a template, the inverse of expansion, for routing requests by the
 * templates a server publishes. Each expression only matches the characters its operator can
 * produce, which is what makes the split between expressions and literals unambiguous.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Expression, OperatorRules, TemplatePart } from "./syntax.js";

import { UriTemplateError } from "./error.js";
import { OPERATORS } from "./syntax.js";

/** A matched value: a string, a list, or an associative array's members. */
export type MatchedValue = string | string[] | Record<string, string>;

/** RFC 3986 unreserved characters as a regular expression class body. */
const UNRESERVED = "A-Za-z0-9\\-._~";

/** RFC 3986 reserved characters as a regular expression class body. */
const RESERVED = ":/?#\\[\\]@!$&'()*+,;=";

/** A percent-encoded octet. */
const OCTET = "%[0-9A-Fa-f]{2}";

/** A run of percent-encoded octets, decoded together so multi-byte UTF-8 stays whole. */
const OCTET_RUN = /(?:%[0-9A-Fa-f]{2})+/g;

/** Characters whose octets reserved expansion leaves encoded on the way back. */
const KEEP_ENCODED = /[:/?#[\]@!$&'()*+,;=%]/;

/** One decoding step: an expression, or adjacent named ones merged, and its capture groups. */
interface Group {
	expression: Expression;
	captures: number[];
}

/** A compiled matcher: the anchored expression and the decoding step behind its captures. */
export interface Matcher {
	pattern: RegExp;
	groups: Group[];
}

/**
 * Builds the matcher for `parts`, or fails when two adjacent expressions leave the boundary
 * between them undecidable: the second writes no leading character, or one the first can hold.
 * A named expression followed by one that continues its items (`{?a}{&b}`) decodes as one.
 *
 * @param parts - The parsed template.
 */
export function compileMatcher(parts: readonly TemplatePart[]): Result<Matcher, UriTemplateError> {
	let source = "";
	let groups: Group[] = [];
	let previous: TemplatePart | undefined;
	let capture = 0;
	for (let part of parts) {
		if (typeof part === "string") {
			source += escapeRegExp(part);
			previous = part;
			continue;
		}
		let rules = OPERATORS[part.operator];
		source += `(?:${escapeRegExp(rules.first)}((?:[${bodyClass(rules)}]|${OCTET})*))?`;
		capture++;
		let last = groups.at(-1);
		if (previous !== undefined && typeof previous !== "string" && last !== undefined) {
			if (continues(previous, part)) {
				last.expression = {
					...last.expression,
					variables: [...last.expression.variables, ...part.variables],
				};
				last.captures.push(capture);
				previous = part;
				continue;
			}
			if (!separable(previous, part)) {
				return failure(
					new UriTemplateError(part.offset, "Two adjacent expressions make matching ambiguous"),
				);
			}
		}
		groups.push({ expression: part, captures: [capture] });
		previous = part;
	}
	return success({ pattern: new RegExp(`^${source}$`), groups });
}

/**
 * The variables `uri` was expanded from, or `null` when the template cannot produce it.
 *
 * @param matcher - The compiled template.
 * @param uri - The URI to match, compared as written, percent-encoding case included.
 */
export function matchUri(matcher: Matcher, uri: string): Record<string, MatchedValue> | null {
	let match = matcher.pattern.exec(uri);
	if (match === null) return null;
	let variables: Record<string, MatchedValue> = {};
	for (let { expression, captures } of matcher.groups) {
		let bodies = captures.flatMap((index) => (match[index] === undefined ? [] : [match[index]]));
		if (bodies.length === 0) continue;
		let separator = OPERATORS[expression.operator].separator;
		let decoded = decodeExpression(
			expression,
			bodies.filter((body) => body !== "").join(separator),
		);
		if (decoded === null) return null;
		Object.assign(variables, decoded);
	}
	return variables;
}

/** `text` with every regular expression metacharacter escaped. */
function escapeRegExp(text: string): string {
	return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `next` writes more items of the same named list `previous` writes, as `{&…}` after `{?…}`. */
function continues(previous: Expression, next: Expression): boolean {
	let rules = OPERATORS[previous.operator];
	let nextRules = OPERATORS[next.operator];
	return rules.named && nextRules.named && nextRules.first === rules.separator;
}

/** The characters an operator's expansion can write, besides percent-encoded octets. */
function bodyClass(rules: OperatorRules): string {
	if (rules.allowReserved) return UNRESERVED + RESERVED;
	let extra = new Set([",", "=", rules.separator]);
	return UNRESERVED + [...extra].map((char) => `\\${char}`).join("");
}

/** Whether the leading character of `next` cannot be read as part of `previous`. */
function separable(previous: Expression, next: Expression): boolean {
	let lead = OPERATORS[next.operator].first;
	if (lead === "") return false;
	let rules = OPERATORS[previous.operator];
	if (rules.allowReserved) return false;
	return !new RegExp(`^[${bodyClass(rules)}]$`).test(lead);
}

/** The variables one expression's matched text holds, or `null` when it cannot be decoded. */
function decodeExpression(
	expression: Expression,
	body: string,
): Record<string, MatchedValue> | null {
	let rules = OPERATORS[expression.operator];
	return rules.named
		? decodeNamed(expression, body, rules)
		: decodeUnnamed(expression, body, rules);
}

/**
 * Unnamed operators: one variable takes the whole body, split into a list at separators its
 * values cannot hold; several variables take one separated piece each, in order.
 */
function decodeUnnamed(
	expression: Expression,
	body: string,
	rules: OperatorRules,
): Record<string, MatchedValue> | null {
	let [only, ...rest] = expression.variables;
	if (only === undefined) return {};
	if (rest.length === 0) {
		let value = only.explode
			? decodeItems(body.split(rules.separator), rules)
			: decodeComposite(body, rules);
		return value === null ? null : { [only.name]: value };
	}
	let pieces = body.split(rules.separator);
	let exploded = expression.variables.findIndex((spec) => spec.explode);
	let spare = pieces.length - expression.variables.length;
	if (spare > 0 && exploded === -1) return null;
	let out: Record<string, MatchedValue> = {};
	let at = 0;
	for (let [index, spec] of expression.variables.entries()) {
		if (at >= pieces.length) break;
		let count = index === exploded ? Math.max(1, spare + 1) : 1;
		let taken = pieces.slice(at, at + count);
		at += count;
		let value = spec.explode ? decodeItems(taken, rules) : decode(taken[0] as string, rules);
		if (value === null) return null;
		out[spec.name] = value;
	}
	return out;
}

/**
 * Named operators: each `name=value` item goes to the variable whose name it carries as
 * written, percent-encoding included; repeated names
 * of an exploded list collect into a list, and an exploded associative array takes the rest.
 */
function decodeNamed(
	expression: Expression,
	body: string,
	rules: OperatorRules,
): Record<string, MatchedValue> | null {
	let items: [string, string][] = [];
	for (let item of body === "" ? [] : body.split(rules.separator)) {
		let equals = item.indexOf("=");
		items.push([
			equals === -1 ? item : item.slice(0, equals),
			equals === -1 ? "" : item.slice(equals + 1),
		]);
	}
	let used = new Set<number>();
	let out: Record<string, MatchedValue> = {};
	for (let spec of expression.variables) {
		let indexes = items.flatMap(([key], index) =>
			key === spec.name && !used.has(index) ? [index] : [],
		);
		if (!spec.explode) {
			let index = indexes[0];
			if (index === undefined) continue;
			used.add(index);
			let value = decodeComposite((items[index] as [string, string])[1], rules);
			if (value === null) return null;
			out[spec.name] = value;
			continue;
		}
		if (indexes.length > 0) {
			let values: string[] = [];
			for (let index of indexes) {
				used.add(index);
				let text = decode((items[index] as [string, string])[1], rules);
				if (text === null) return null;
				values.push(text);
			}
			out[spec.name] = values;
			continue;
		}
		let members: Record<string, string> = {};
		for (let [index, [rawKey, raw]] of items.entries()) {
			if (used.has(index)) continue;
			let key = decode(rawKey, rules);
			let text = decode(raw, rules);
			if (key === null || text === null) return null;
			used.add(index);
			members[key] = text;
		}
		if (Object.keys(members).length > 0) out[spec.name] = members;
	}
	return used.size === items.length ? out : null;
}

/** A non-exploded value: a list when it holds the `,` a string value would have encoded. */
function decodeComposite(body: string, rules: OperatorRules): MatchedValue | null {
	if (rules.allowReserved || !body.includes(",")) return decode(body, rules);
	return decodeItems(body.split(","), rules);
}

/** Exploded items: members when each is `key=value` and `=` cannot be a value character, else a list. */
function decodeItems(items: string[], rules: OperatorRules): MatchedValue | null {
	if (!rules.allowReserved && items.every((item) => item.includes("="))) {
		let members: Record<string, string> = {};
		for (let item of items) {
			let equals = item.indexOf("=");
			let key = decode(item.slice(0, equals), rules);
			let value = decode(item.slice(equals + 1), rules);
			if (key === null || value === null) return null;
			members[key] = value;
		}
		return members;
	}
	let values: string[] = [];
	for (let item of items) {
		let text = decode(item, rules);
		if (text === null) return null;
		values.push(text);
	}
	return values;
}

/**
 * Percent-decodes a value, or `null` when its octets are not UTF-8. Reserved expansion
 * passes `%XX` through as written, so there the octets of reserved characters and `%` stay
 * encoded: decoding them would name a different value than the one expanded.
 */
function decode(text: string, rules: OperatorRules): string | null {
	if (!rules.allowReserved) {
		let decoded = wrap(() => decodeURIComponent(text));
		return isFailure(decoded) ? null : decoded.data;
	}
	let failed = false;
	let out = text.replaceAll(OCTET_RUN, (run) => {
		let bytes = Uint8Array.from(run.slice(1).split("%"), (hex) => Number.parseInt(hex, 16));
		let decoded = wrap(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes));
		if (isFailure(decoded)) {
			failed = true;
			return run;
		}
		let kept = "";
		let offset = 0;
		for (let char of decoded.data) {
			let width = new TextEncoder().encode(char).length * 3;
			kept += KEEP_ENCODED.test(char) ? run.slice(offset, offset + width) : char;
			offset += width;
		}
		return kept;
	});
	return failed ? null : out;
}
