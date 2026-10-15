/**
 * Adds a property to the object literal a named call receives, such as a job map, a route
 * contract or an MCP declaration list, walking nested object literals and nested calls on the
 * way. The new property copies the indentation and trailing-comma style of its siblings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { Edit, Replacement } from "./edit.js";
import type { Span, Structure } from "./structure.js";
import type { Token } from "./tokenize.js";

import { finish } from "./edit.js";
import { CodemodError } from "./errors.js";
import {
	afterLine,
	analyze,
	closingOf,
	cook,
	crossesLine,
	elements,
	findCalls,
	indentUnit,
	isIdentifier,
	isPunctuator,
	lineBreak,
	lineIndent,
	preferredQuote,
	quote,
	reindent,
} from "./structure.js";

/** Where the property goes and what it is. */
export interface AddPropertyOptions {
	/** The dotted callee whose first argument is the object literal, such as `jobs` or `route`. */
	call: string;
	/**
	 * Keys of nested object literals to walk, outermost first. A value that is a call, such as
	 * `route("/prefix", { … })`, is walked through its object argument; a missing level is created.
	 */
	path?: string[];
	key: string;
	/** Source text, inserted verbatim except for indentation added to its later lines. */
	value: string;
}

/** One property of an object literal, as indices into `code` and its source range. */
interface Property {
	/** The key's value, or `null` for a computed key or a spread. */
	key: string | null;
	span: Span;
	/** The first token of the value, or -1 for a shorthand, method or spread. */
	value: number;
	start: number;
	end: number;
	/** The comma after the property, or `null` when it is the last one without a trailing comma. */
	comma: Token | null;
}

/** Keywords that may precede a method name in an object literal. */
const METHOD_MODIFIERS = new Set(["get", "set", "async", "static"]);

/**
 * `source` with `key: value` appended to the object literal passed as the first argument of the
 * first call to `options.call`, after walking `options.path`. An existing `key`, or no such
 * call, is a failure.
 *
 * @example addProperty("index.ts", source, { call: "jobs", path: ["trials"], key: "expire", value: "job({})" })
 */
export function addProperty(
	filename: string,
	source: string,
	options: AddPropertyOptions,
): Result<Edit, CodemodError> {
	let scanned = analyze(filename, source);
	if (isFailure(scanned)) return scanned;
	let structure = scanned.data;
	let notFound = (reason: string): Result<never, CodemodError> =>
		failure(new CodemodError("not-found", filename, reason));

	let call = findCalls(structure, options.call).find((candidate) =>
		isPunctuator(structure.code[candidate.open + 1], "{"),
	);
	if (call === undefined) {
		return notFound(`no call to \`${options.call}\` with an object literal as its first argument`);
	}
	let object = call.open + 1;
	let path = options.path ?? [];
	for (let [depth, segment] of path.entries()) {
		let property = properties(structure, object).find((candidate) => candidate.key === segment);
		if (property === undefined) {
			let text = nested(structure, path.slice(depth), options);
			return finish(filename, source, append(structure, object, text));
		}
		let inner = property.value === -1 ? -1 : objectIn(structure, property);
		if (inner === -1) {
			return notFound(`\`${path.slice(0, depth + 1).join(".")}\` is not an object literal`);
		}
		object = inner;
	}
	if (properties(structure, object).some((property) => property.key === options.key)) {
		return failure(
			new CodemodError(
				"duplicate-key",
				filename,
				`\`${[...path, options.key].join(".")}\` already exists`,
			),
		);
	}
	let text = `${keyText(structure, options.key)}: ${options.value}`;
	return finish(filename, source, append(structure, object, text));
}

/** The properties of the object literal opening at `code[open]`. */
function properties(structure: Structure, open: number): Property[] {
	let code = structure.code;
	let close = closingOf(structure, open);
	return elements(structure, open).map((span) => {
		let first = code[span.start]!;
		let second = code[span.start + 1];
		let key: string | null = null;
		let value = -1;
		let named = first.type === "identifier" || first.type === "string" || first.type === "number";
		if (named && isPunctuator(second, ":")) {
			key = first.type === "string" ? cook(first.value) : first.value;
			value = span.start + 2;
		} else if (
			first.type === "identifier" &&
			(span.end - span.start === 1 || isPunctuator(second, "("))
		) {
			key = first.value;
		} else if (METHOD_MODIFIERS.has(first.value) && isIdentifier(second)) {
			key = second!.value;
		}
		let after = code[span.end];
		return {
			key,
			span,
			value,
			start: first.start,
			end: code[span.end - 1]!.end,
			comma: span.end < close && isPunctuator(after, ",") ? after! : null,
		};
	});
}

/**
 * The object literal a property's value is: the literal itself, or the first object-literal
 * argument of a call such as `route("/prefix", { … })`; -1 for anything else.
 */
function objectIn(structure: Structure, property: Property): number {
	let code = structure.code;
	let start = property.value;
	let last = property.span.end - 1;
	if (isPunctuator(code[start], "{")) return closingOf(structure, start) === last ? start : -1;
	let at = start;
	while (isIdentifier(code[at]) || isPunctuator(code[at], ".")) at += 1;
	if (at === start || !isPunctuator(code[at], "(") || closingOf(structure, at) !== last) return -1;
	for (let argument of elements(structure, at)) {
		let first = argument.start;
		if (isPunctuator(code[first], "{") && closingOf(structure, first) === argument.end - 1) {
			return first;
		}
	}
	return -1;
}

/**
 * The text of a property that creates the missing `levels` as nested object literals around
 * `key: value`, indented one unit per level and relative to the property's own line.
 */
function nested(structure: Structure, levels: string[], options: AddPropertyOptions): string {
	let unit = indentUnit(structure.source);
	let newline = lineBreak(structure.source);
	let comma = trailingCommas(structure) ? "," : "";
	let text = `${keyText(structure, options.key)}: ${options.value}`;
	for (let level of [...levels].reverse()) {
		text = `${keyText(structure, level)}: {${newline}${unit}${reindent(text, unit, newline)}${comma}${newline}}`;
	}
	return text;
}

/** A key as an identifier when it is one, quoted in the file's quote style otherwise. */
function keyText(structure: Structure, key: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key, preferredQuote(structure));
}

/**
 * Whether multi-line lists in the file end with a trailing comma, judged from the first list
 * whose closing bracket starts a line; `true` when there is none.
 */
function trailingCommas(structure: Structure): boolean {
	let code = structure.code;
	for (let [index, token] of code.entries()) {
		let closes = token.type === "punctuator" && ["}", "]", ")"].includes(token.value);
		if (!closes || !token.newlineBefore) continue;
		let previous = code[index - 1];
		if (previous === undefined || structure.match[index] === index - 1) continue;
		return isPunctuator(previous, ",");
	}
	return true;
}

/**
 * The replacements that append the property `text` to the object literal at `code[open]`:
 * on its own line after the last property when the object is written one property per line,
 * inline after the last property otherwise, and on a new indented line in an empty object.
 */
function append(structure: Structure, open: number, text: string): Replacement[] {
	let { code, source } = structure;
	let newline = lineBreak(source);
	let brace = code[open]!;
	let close = code[closingOf(structure, open)]!;
	let list = properties(structure, open);
	let last = list[list.length - 1];

	if (last === undefined) {
		let braceIndent = lineIndent(source, brace.start);
		let indent = braceIndent + indentUnit(source);
		let comma = trailingCommas(structure) ? "," : "";
		let closing = crossesLine(source, brace.end, close.start) ? "" : newline + braceIndent;
		return [
			{
				start: brace.end,
				end: brace.end,
				text: `${newline}${indent}${reindent(text, indent, newline)}${comma}${closing}`,
			},
		];
	}

	let multiline = crossesLine(source, brace.end, list[0]!.start);
	if (!multiline) {
		if (last.comma !== null) {
			return [{ start: last.comma.end, end: last.comma.end, text: ` ${text},` }];
		}
		return [{ start: last.end, end: last.end, text: `, ${text}` }];
	}

	let indent = lineIndent(source, last.start);
	let property = `${newline}${indent}${reindent(text, indent, newline)}`;
	if (last.comma !== null) {
		let at = afterLine(source, last.comma.end);
		return [{ start: at, end: at, text: `${property},` }];
	}
	let at = afterLine(source, last.end);
	return [
		{ start: last.end, end: last.end, text: "," },
		{ start: at, end: at, text: property },
	];
}
