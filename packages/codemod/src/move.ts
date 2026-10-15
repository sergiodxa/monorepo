/**
 * Moves named imports and named re-exports from one module specifier to another, the edit that
 * points a file at a local copy of some of a library's exports. Aliases, `type` modifiers, the
 * quote character and the semicolon style of the original declaration carry over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { Edit, Replacement } from "./edit.js";
import type { CodemodError } from "./errors.js";
import type { BoundName, ModuleReference } from "./references.js";

import { finish } from "./edit.js";
import { referencesIn } from "./references.js";
import {
	afterLine,
	analyze,
	crossesLine,
	lineBreak,
	lineIndent,
	lineStart,
	quote,
} from "./structure.js";

/** Which names move, and between which specifiers. */
export interface MoveOptions {
	/** The specifier the names are imported or re-exported from now. */
	from: string;
	/** The names as `from` exports them, whatever alias a declaration gives them. */
	names: string[];
	/** The specifier the names move to. */
	to: string;
}

/** Names bound to one join target, collected so a target receives one insertion. */
interface Join {
	target: ModuleReference;
	specifiers: string[];
}

/**
 * `source` with every named import and named re-export of `options.names` from `options.from`
 * moved to `options.to`. A declaration whose names all move has its specifier replaced in
 * place; otherwise it keeps the rest and a declaration for the moved names follows it. When a
 * declaration of the same kind for `to` already exists, the moved names join it. Default and
 * namespace imports and `export *` of `from` cannot be split by name and come back in
 * `unhandled`.
 *
 * @example moveImports("page.tsx", source, { from: "sdxc/ui", names: ["Button"], to: "~/ui/button.js" })
 */
export function moveImports(
	filename: string,
	source: string,
	options: MoveOptions,
): Result<Edit, CodemodError> {
	let structure = analyze(filename, source);
	if (isFailure(structure)) return structure;
	let references = referencesIn(structure.data);
	if (isFailure(references)) return references;
	let declarations = references.data.filter(
		(reference) => reference.kind === "import" || reference.kind === "export",
	);
	let wanted = new Set(options.names);
	let newline = lineBreak(source);
	let replacements: Replacement[] = [];
	let unhandled: ModuleReference[] = [];
	let joins = new Map<ModuleReference, Join>();

	if (options.from === options.to) return finish(filename, source, []);

	for (let reference of declarations) {
		if (reference.specifier !== options.from) continue;
		let braced = reference.names.filter((name) => isBraced(reference, name));
		let unsplittable =
			braced.length < reference.names.length ||
			(reference.kind === "export" && reference.braces === null);
		if (unsplittable) unhandled.push(reference);
		let moving = braced.filter((name) => wanted.has(name.imported));
		if (moving.length === 0) continue;

		let quoteCharacter = source[reference.specifierRange.start] ?? '"';
		let specifiers = moving.map((name) => source.slice(name.range.start, name.range.end));
		let target = declarations.find(
			(candidate) =>
				candidate.specifier === options.to &&
				candidate.kind === reference.kind &&
				candidate.typeOnly === reference.typeOnly &&
				candidate.braces !== null,
		);
		let everything = moving.length === braced.length && !unsplittable;

		if (everything && target === undefined) {
			let { start, end } = reference.specifierRange;
			replacements.push({ start, end, text: quote(options.to, quoteCharacter) });
			continue;
		}
		if (everything) {
			replacements.push(removeLine(source, reference.range.start, reference.range.end));
		} else {
			replacements.push(...removeNames(source, reference, braced, new Set(moving)));
		}
		if (target !== undefined) {
			let join = joins.get(target) ?? { target, specifiers: [] };
			join.specifiers.push(...specifiers);
			joins.set(target, join);
			continue;
		}
		let declaration = [
			reference.kind,
			reference.typeOnly ? " type" : "",
			" ",
			list(source, reference, specifiers),
			" from ",
			quote(options.to, quoteCharacter),
			source[reference.range.end - 1] === ";" ? ";" : "",
		].join("");
		let at = afterLine(source, reference.range.end);
		replacements.push({
			start: at,
			end: at,
			text: newline + lineIndent(source, reference.range.start) + declaration,
		});
	}

	for (let join of joins.values()) {
		let replacement = joinNames(source, join);
		if (replacement !== null) replacements.push(replacement);
	}
	return finish(filename, source, replacements, unhandled);
}

/** Whether `name` sits inside the declaration's braces, where it can be moved by name. */
function isBraced(reference: ModuleReference, name: BoundName): boolean {
	let braces = reference.braces;
	return braces !== null && name.range.start > braces.start && name.range.end < braces.end;
}

/**
 * `{ a, b }` for a new declaration, spaced like the braces of `reference`: tight when they are
 * written `{a}`, padded otherwise.
 */
function list(source: string, reference: ModuleReference, specifiers: string[]): string {
	let braces = reference.braces;
	let tight = braces !== null && !/\s/.test(source[braces.start + 1] ?? " ");
	return tight ? `{${specifiers.join(", ")}}` : `{ ${specifiers.join(", ")} }`;
}

/**
 * Deletions that take `moving` out of the braces of `reference`, keeping the separators and
 * trailing comma of the names that stay. When no braced name stays, the braces go with the
 * comma that joined them to the default binding.
 */
function removeNames(
	source: string,
	reference: ModuleReference,
	braced: BoundName[],
	moving: Set<BoundName>,
): Replacement[] {
	let kept = braced.filter((name) => !moving.has(name));
	if (kept.length === 0) {
		let braces = reference.braces!;
		let outside = reference.names.filter((name) => !moving.has(name) && !braced.includes(name));
		let before = outside[outside.length - 1];
		let start = before === undefined ? braces.start : before.range.end;
		return [{ start, end: braces.end, text: "" }];
	}
	let lastKept = braced.indexOf(kept[kept.length - 1]!);
	let deletions: Replacement[] = [];
	for (let [index, name] of braced.entries()) {
		if (!moving.has(name) || index > lastKept) continue;
		deletions.push({ start: name.range.start, end: braced[index + 1]!.range.start, text: "" });
	}
	let last = braced[braced.length - 1]!;
	if (lastKept < braced.length - 1) {
		deletions.push({ start: braced[lastKept]!.range.end, end: last.range.end, text: "" });
	}
	return deletions;
}

/**
 * The insertion that adds a join's names to its target's braces, after the last name and in the
 * list's own layout: one per line for a list written one per line, inline otherwise. Names the
 * target already binds are skipped; `null` when none is left.
 */
function joinNames(source: string, join: Join): Replacement | null {
	let target = join.target;
	let braces = target.braces!;
	let present = new Set(target.names.map((name) => source.slice(name.range.start, name.range.end)));
	let adding = [...new Set(join.specifiers)].filter((specifier) => !present.has(specifier));
	if (adding.length === 0) return null;
	let braced = target.names.filter((name) => isBraced(target, name));
	let last = braced[braced.length - 1];
	if (last === undefined) {
		return { start: braces.start, end: braces.end, text: `{ ${adding.join(", ")} }` };
	}
	let first = braced[0]!;
	let multiline = crossesLine(source, braces.start, first.range.start);
	let after = source.slice(last.range.end, braces.end - 1);
	let trailingComma = after.trimStart().startsWith(",");
	if (!multiline) {
		return { start: last.range.end, end: last.range.end, text: `, ${adding.join(", ")}` };
	}
	let indent = lineIndent(source, first.range.start);
	let newline = lineBreak(source);
	let lines = adding.map((specifier) => `${newline}${indent}${specifier},`).join("");
	if (trailingComma) {
		let comma = last.range.end + after.indexOf(",") + 1;
		return { start: comma, end: comma, text: lines };
	}
	return { start: last.range.end, end: last.range.end, text: `,${lines.slice(0, -1)}` };
}

/**
 * The deletion of a whole declaration, along with its line when nothing else shares it, so no
 * blank line is left where it stood.
 */
function removeLine(source: string, start: number, end: number): Replacement {
	let from = lineStart(source, start);
	let ownsLine = source.slice(from, start).trim() === "";
	let to = end;
	while (source[to] === " " || source[to] === "\t") to += 1;
	if (ownsLine && (source[to] === "\n" || source.startsWith("\r\n", to))) {
		return { start: from, end: to + (source[to] === "\n" ? 1 : 2), text: "" };
	}
	return { start, end, text: "" };
}
