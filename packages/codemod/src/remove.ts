/**
 * The removals that undo `addProperty` and `insertAfterLast`: a property taken out of the object
 * literal a named call receives, groups it leaves empty pruned, and every statement that names a
 * module, such as the mapping that lazy-loads a handler. The lines around each removal stay as
 * they were.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Edit, Replacement } from "./edit.js";
import type { Structure } from "./structure.js";

import { finish } from "./edit.js";
import { CodemodError } from "./errors.js";
import { objectIn, properties } from "./property.js";
import {
	analyze,
	closingOf,
	cook,
	crossesLine,
	elements,
	findCalls,
	isPunctuator,
	lineStart,
	startsStatement,
	statementEnd,
} from "./structure.js";

/** Which property to remove. */
export interface RemovePropertyOptions {
	/** The dotted callee that receives the object literal, such as `jobs` or `route`. */
	call: string;
	/**
	 * The zero-based position of the object literal among the call's arguments.
	 *
	 * @default 0
	 */
	argument?: number;
	/** Keys of nested object literals to walk, outermost first, as `addProperty` takes them. */
	path?: string[];
	key: string;
}

/** One statement that names a module, by source range and text. */
export interface FoundStatement {
	start: number;
	end: number;
	text: string;
}

/** Which statements to find or remove. */
export interface StatementOptions {
	/** The module specifier a string literal in the statement equals, as `~/app/jobs/digest`. */
	specifier: string;
}

/**
 * `source` without `options.key` in the object literal `options.call` receives after walking
 * `options.path`, its comma and its line included; the last property leaves `{}`. A group the
 * removal leaves empty is removed from its parent in turn. A missing call, path or key is a failure.
 *
 * @example removeProperty("index.ts", source, { call: "jobs", path: ["trials"], key: "expire" })
 */
export function removeProperty(
	filename: string,
	source: string,
	options: RemovePropertyOptions,
): Result<Edit, CodemodError> {
	let path = options.path ?? [];
	let removed = removeOne(filename, source, { ...options, path });
	if (isFailure(removed)) return removed;
	let current = removed.data;
	for (let depth = path.length; depth > 0; depth -= 1) {
		let parent = path.slice(0, depth);
		let empty = isEmptyGroup(filename, current.source, { ...options, path: parent });
		if (!empty) break;
		let pruned = removeOne(filename, current.source, {
			...options,
			path: parent.slice(0, -1),
			key: parent.at(-1) as string,
		});
		if (isFailure(pruned)) break;
		current = pruned.data;
	}
	return success({ ...current, changed: current.source !== source });
}

/**
 * The object literal argument `options.argument` of the first call to `options.call`, walked
 * through `path`, or a failure saying which step is missing.
 */
function objectAt(
	filename: string,
	structure: Structure,
	options: RemovePropertyOptions & { path: string[] },
): Result<number, CodemodError> {
	let notFound = (reason: string) => failure(new CodemodError("not-found", filename, reason));
	let position = options.argument ?? 0;
	let object = -1;
	for (let candidate of findCalls(structure, options.call)) {
		let span = elements(structure, candidate.open)[position];
		if (span === undefined || !isPunctuator(structure.code[span.start], "{")) continue;
		object = span.start;
		break;
	}
	if (object === -1) {
		return notFound(
			`no call to \`${options.call}\` with an object literal as argument ${position}`,
		);
	}
	for (let [depth, segment] of options.path.entries()) {
		let property = properties(structure, object).find((candidate) => candidate.key === segment);
		let inner =
			property === undefined || property.value === -1 ? -1 : objectIn(structure, property);
		if (inner === -1) {
			return notFound(`\`${options.path.slice(0, depth + 1).join(".")}\` is not an object literal`);
		}
		object = inner;
	}
	return success(object);
}

/** Whether the object literal at `options.path` holds no properties. */
function isEmptyGroup(
	filename: string,
	source: string,
	options: RemovePropertyOptions & { path: string[] },
): boolean {
	let scanned = analyze(filename, source);
	if (isFailure(scanned)) return false;
	let object = objectAt(filename, scanned.data, options);
	return !isFailure(object) && properties(scanned.data, object.data).length === 0;
}

/** Removes the one property `options` names, without pruning. */
function removeOne(
	filename: string,
	source: string,
	options: RemovePropertyOptions & { path: string[] },
): Result<Edit, CodemodError> {
	let scanned = analyze(filename, source);
	if (isFailure(scanned)) return scanned;
	let structure = scanned.data;
	let object = objectAt(filename, structure, options);
	if (isFailure(object)) return object;
	let list = properties(structure, object.data);
	let index = list.findIndex((property) => property.key === options.key);
	let property = list[index];
	if (property === undefined) {
		return failure(
			new CodemodError(
				"not-found",
				filename,
				`\`${[...options.path, options.key].join(".")}\` is not declared`,
			),
		);
	}
	let brace = structure.code[object.data];
	let close = structure.code[closingOf(structure, object.data)];
	let multiline = brace !== undefined && crossesLine(source, brace.end, property.start);
	let replacement: Replacement;
	if (list.length === 1 && brace !== undefined && close !== undefined) {
		replacement = { start: brace.end, end: close.start, text: "" };
	} else if (multiline) {
		let end = property.comma?.end ?? property.end;
		let lineEnd = source.indexOf("\n", end);
		replacement = {
			start: lineStart(source, property.start),
			end: lineEnd === -1 ? source.length : lineEnd + 1,
			text: "",
		};
	} else if (property.comma !== null) {
		let after = property.comma.end;
		while (source[after] === " ") after += 1;
		replacement = { start: property.start, end: after, text: "" };
	} else {
		let previous = list[index - 1];
		let start = previous?.comma?.start ?? property.start;
		replacement = { start, end: property.end, text: "" };
	}
	return finish(filename, source, [replacement]);
}

/**
 * Every innermost statement of `source` holding a string literal equal to `options.specifier`,
 * such as `router.map(routes.home, lazy(() => import("~/app/http/controllers/home")));` for
 * `~/app/http/controllers/home`, in source order.
 */
export function findStatements(
	filename: string,
	source: string,
	options: StatementOptions,
): Result<FoundStatement[], CodemodError> {
	let scanned = analyze(filename, source);
	if (isFailure(scanned)) return scanned;
	let structure = scanned.data;
	let { code } = structure;
	let found: FoundStatement[] = [];
	for (let [index, token] of code.entries()) {
		if (token.type !== "string" || cook(token.value) !== options.specifier) continue;
		let best = -1;
		for (let at = 0; at <= index; at += 1) {
			if (!startsStatement(structure, at)) continue;
			if (statementEnd(structure, at) < index) continue;
			if (best === -1 || (structure.depth[at] ?? 0) >= (structure.depth[best] ?? 0)) best = at;
		}
		if (best === -1) continue;
		let start = code[best]!.start;
		let end = code[statementEnd(structure, best)]!.end;
		if (found.some((statement) => statement.start === start)) continue;
		found.push({ start, end, text: source.slice(start, end) });
	}
	return success(found);
}

/**
 * `source` without every statement {@link findStatements} finds, each with the rest of its
 * lines; no such statement leaves `source` as it is.
 *
 * @example removeStatements("router.ts", source, { specifier: "~/app/http/controllers/home" })
 */
export function removeStatements(
	filename: string,
	source: string,
	options: StatementOptions,
): Result<Edit, CodemodError> {
	let found = findStatements(filename, source, options);
	if (isFailure(found)) return found;
	let replacements = found.data.map((statement) => {
		let lineEnd = source.indexOf("\n", statement.end);
		return {
			start: lineStart(source, statement.start),
			end: lineEnd === -1 ? source.length : lineEnd + 1,
			text: "",
		};
	});
	return finish(filename, source, replacements);
}
