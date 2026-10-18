/**
 * Appends an entry to a list: a call's own arguments, such as a middleware chain built by
 * `createMiddleware(…)`, or an array literal inside the object a call receives, such as
 * `createRouter({ middleware: [ … ] })`. The entry follows the list's own layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { Edit, Replacement } from "./edit.js";
import type { Structure } from "./structure.js";

import { finish } from "./edit.js";
import { CodemodError } from "./errors.js";
import { properties, trailingCommas } from "./property.js";
import {
	afterLine,
	analyze,
	closingOf,
	crossesLine,
	elements,
	findCalls,
	indentUnit,
	isPunctuator,
	lineBreak,
	lineIndent,
	reindent,
} from "./structure.js";

/** Which list receives the entry and what the entry is. */
export interface AddElementOptions {
	/** The dotted callee, such as `createMiddleware` or `createRouter`. */
	call: string;
	/**
	 * The zero-based position of the object literal `path` walks from among the call's arguments.
	 *
	 * @default 0
	 */
	argument?: number;
	/**
	 * Keys to walk from that object literal to the array literal, outermost first; every level
	 * but the last is an object literal. Empty or omitted, the list is the call's arguments.
	 */
	path?: string[];
	/** Source text, inserted verbatim except for indentation added to its later lines. */
	value: string;
}

/**
 * `source` with `options.value` appended to the list `options` names, in the first call to
 * `options.call` that has it. A missing call, key or array literal is a `not-found` failure.
 *
 * @example addElement("router.ts", source, { call: "createRouter", path: ["middleware"], value: "auth()" })
 * @example addElement("page.ts", source, { call: "createMiddleware", value: "auth()" })
 */
export function addElement(
	filename: string,
	source: string,
	options: AddElementOptions,
): Result<Edit, CodemodError> {
	let scanned = analyze(filename, source);
	if (isFailure(scanned)) return scanned;
	let structure = scanned.data;
	let calls = findCalls(structure, options.call);
	let path = options.path ?? [];
	let list = -1;
	for (let call of calls) {
		list =
			path.length === 0 ? call.open : arrayAt(structure, call.open, options.argument ?? 0, path);
		if (list !== -1) break;
	}
	if (list === -1) {
		let where = path.length === 0 ? "" : ` with an array literal at \`${path.join(".")}\``;
		return failure(
			new CodemodError("not-found", filename, `no call to \`${options.call}\`${where}`),
		);
	}
	return finish(filename, source, append(structure, list, options.value));
}

/**
 * The `[` of the array literal at `path` inside the object literal passed as argument
 * `position` of the call opening at `open`, or -1 when any level is missing or of another shape.
 */
function arrayAt(structure: Structure, open: number, position: number, path: string[]): number {
	let code = structure.code;
	let span = elements(structure, open)[position];
	if (span === undefined || !isPunctuator(code[span.start], "{")) return -1;
	let object = span.start;
	for (let [depth, key] of path.entries()) {
		let property = properties(structure, object).find((candidate) => candidate.key === key);
		if (property === undefined || property.value === -1) return -1;
		let value = property.value;
		let whole = closingOf(structure, value) === property.span.end - 1;
		let bracket = depth === path.length - 1 ? "[" : "{";
		if (!isPunctuator(code[value], bracket) || !whole) return -1;
		object = value;
	}
	return object;
}

/**
 * The replacements that append `text` to the list opening at `code[open]`: on its own line
 * after the last entry when the list is written one per line, inline after it otherwise, and
 * inside the brackets of an empty list, on a new indented line when they already span lines.
 */
function append(structure: Structure, open: number, text: string): Replacement[] {
	let { code, source } = structure;
	let newline = lineBreak(source);
	let bracket = code[open]!;
	let closeIndex = closingOf(structure, open);
	let close = code[closeIndex]!;
	let spans = elements(structure, open);
	let last = spans.at(-1);

	if (last === undefined) {
		if (!crossesLine(source, bracket.end, close.start)) {
			return [{ start: bracket.end, end: bracket.end, text }];
		}
		let indent = lineIndent(source, bracket.start) + indentUnit(source);
		let comma = trailingCommas(structure) ? "," : "";
		return [
			{
				start: bracket.end,
				end: bracket.end,
				text: `${newline}${indent}${reindent(text, indent, newline)}${comma}`,
			},
		];
	}

	let first = code[spans[0]!.start]!;
	let lastStart = code[last.start]!.start;
	let lastEnd = code[last.end - 1]!.end;
	let after = code[last.end];
	let comma = last.end < closeIndex && isPunctuator(after, ",") ? after! : null;

	if (!crossesLine(source, bracket.end, first.start)) {
		if (comma !== null) return [{ start: comma.end, end: comma.end, text: ` ${text},` }];
		return [{ start: lastEnd, end: lastEnd, text: `, ${text}` }];
	}

	let indent = lineIndent(source, lastStart);
	let entry = `${newline}${indent}${reindent(text, indent, newline)}`;
	if (comma !== null) {
		let at = afterLine(source, comma.end);
		return [{ start: at, end: at, text: `${entry},` }];
	}
	let at = afterLine(source, lastEnd);
	return [
		{ start: lastEnd, end: lastEnd, text: "," },
		{ start: at, end: at, text: entry },
	];
}
