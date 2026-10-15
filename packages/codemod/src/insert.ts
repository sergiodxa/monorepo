/**
 * Adds a statement after the last statement that calls a named callee, so a sequence of
 * `router.map(…)` or `dispatcher.map(…)` calls grows in place, in its own block and at its own
 * indentation, whether it sits in a factory function or at module level.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { Edit } from "./edit.js";
import type { Structure } from "./structure.js";

import { finish } from "./edit.js";
import { CodemodError } from "./errors.js";
import {
	afterLine,
	analyze,
	findCalls,
	isIdentifier,
	lineBreak,
	lineIndent,
	reindent,
	startsStatement,
	statementEnd,
} from "./structure.js";

/** What to insert and where. */
export interface InsertOptions {
	/** The dotted callee whose last statement-level call the new statement follows. */
	call: string;
	/** Source text, inserted verbatim except for indentation added to its later lines. */
	statement: string;
	/**
	 * A callee whose call initializes a declaration (`let dispatcher = createJobDispatcher(…)`);
	 * with no call to `call`, the statement follows that declaration.
	 */
	fallbackAfter?: string;
}

/** Keywords that begin a variable declaration. */
const DECLARATIONS = new Set(["let", "const", "var"]);

/**
 * `source` with `options.statement` on a new line after the last statement that calls
 * `options.call`, or after the declaration whose initializer calls `options.fallbackAfter`.
 * With neither, the edit fails.
 *
 * @example insertAfterLast("router.ts", source, { call: "router.map", statement: "router.map(routes.a, a);" })
 */
export function insertAfterLast(
	filename: string,
	source: string,
	options: InsertOptions,
): Result<Edit, CodemodError> {
	let scanned = analyze(filename, source);
	if (isFailure(scanned)) return scanned;
	let structure = scanned.data;
	let anchor = lastCall(structure, options.call);
	if (anchor === -1 && options.fallbackAfter !== undefined) {
		anchor = declarationCalling(structure, options.fallbackAfter);
	}
	if (anchor === -1) {
		let fallback =
			options.fallbackAfter === undefined
				? ""
				: ` and no declaration initialized by \`${options.fallbackAfter}\``;
		return failure(
			new CodemodError("not-found", filename, `no statement calls \`${options.call}\`${fallback}`),
		);
	}
	let start = structure.code[anchor]!;
	let end = structure.code[statementEnd(structure, anchor)]!;
	let indent = lineIndent(source, start.start);
	let newline = lineBreak(source);
	let at = afterLine(source, end.end);
	let text = `${newline}${indent}${reindent(options.statement, indent, newline)}`;
	return finish(filename, source, [{ start: at, end: at, text }]);
}

/** The first token of the last statement that is a call to `callee`, or -1. */
function lastCall(structure: Structure, callee: string): number {
	let calls = findCalls(structure, callee).filter((call) =>
		startsStatement(structure, call.callee),
	);
	return calls[calls.length - 1]?.callee ?? -1;
}

/**
 * The first token of the first variable declaration (optionally exported) whose initializer
 * calls `callee`, or -1.
 */
function declarationCalling(structure: Structure, callee: string): number {
	let code = structure.code;
	for (let call of findCalls(structure, callee)) {
		let level = structure.depth[call.callee];
		let start = call.callee;
		while (start > 0 && !(structure.depth[start] === level && startsStatement(structure, start))) {
			start -= 1;
		}
		let keyword = isIdentifier(code[start], "export") ? code[start + 1] : code[start];
		if (keyword !== undefined && isIdentifier(keyword) && DECLARATIONS.has(keyword.value)) {
			return start;
		}
	}
	return -1;
}
