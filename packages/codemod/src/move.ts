/**
 * Moves imports and re-exports from one module specifier to another, the edit that points a
 * file at a local copy of some of a library's exports. Aliases, `type` modifiers, the quote
 * character and the semicolon style of the original declaration carry over.
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
	/**
	 * The names as `from` exports them, whatever alias a declaration gives them: `"default"` for
	 * the default export, `"*"` for the whole module (`import * as X`, `export *`).
	 */
	names: string[];
	/** The specifier the names move to. */
	to: string;
}

/** The bindings of one declaration of `from`, by how each one moves. */
interface Parts {
	reference: ModuleReference;
	/** The default binding outside the braces (`import D from`). */
	defaultName: BoundName | null;
	/** The namespace binding, `* as X`, of an import or a re-export. */
	namespace: BoundName | null;
	/** Whether the declaration is a bare `export * from`. */
	star: boolean;
	braced: BoundName[];
	/** The bindings `names` selects; a bare `export *` moves with an empty list and `star`. */
	moving: Set<BoundName>;
	starMoves: boolean;
	complete: boolean;
}

/**
 * The one declaration of `to` that collects every moved name of a kind (`import` or `export`,
 * type-only or not): an existing declaration of `to`, a declaration of `from` whose specifier is
 * replaced in place, or a new declaration written after `anchor`.
 */
interface Collector {
	target: ModuleReference | null;
	anchor: ModuleReference | null;
	/** Whether the collector admits a default binding beside its names. */
	acceptsDefault: boolean;
	defaultText: string | null;
	specifiers: string[];
}

/**
 * `source` with the bindings `options.names` selects moved from `options.from` to `options.to`;
 * a declaration whose bindings all move is repointed in place. Moved bindings of one kind merge
 * into one declaration of `to`, and a namespace or `export *` that stays comes back `unhandled`.
 *
 * @example moveImports("page.tsx", source, { from: "sdxc/ui", names: ["Button"], to: "~/ui/button.js" })
 * @example moveImports("page.tsx", source, { from: "sdxc/ui", names: ["default", "*"], to: "~/ui/index.js" })
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
	if (options.from === options.to) return finish(filename, source, []);

	let declarations = references.data.filter(
		(reference) => reference.kind === "import" || reference.kind === "export",
	);
	let wanted = new Set(options.names);
	let replacements: Replacement[] = [];
	let unhandled: ModuleReference[] = [];
	let moves: Parts[] = [];

	for (let reference of declarations) {
		if (reference.specifier !== options.from) continue;
		let parts = partsOf(reference, wanted);
		let wholeStays =
			(parts.namespace !== null && !parts.moving.has(parts.namespace)) ||
			(parts.star && !parts.starMoves);
		if (wholeStays && wanted.size > 0) unhandled.push(reference);
		if (parts.moving.size > 0 || parts.starMoves) moves.push(parts);
	}

	let collectors = new Map<string, Collector>();
	let inPlace = new Set<ModuleReference>();
	for (let parts of moves) {
		let key = groupOf(parts.reference);
		if (collectors.has(key)) continue;
		let target = declarations.find(
			(candidate) =>
				candidate.specifier === options.to &&
				groupOf(candidate) === key &&
				canCollect(partsOf(candidate, new Set())),
		);
		if (target === undefined) {
			let first = moves.find(
				(candidate) =>
					groupOf(candidate.reference) === key && candidate.complete && canCollect(candidate),
			);
			if (first !== undefined) {
				target = first.reference;
				inPlace.add(target);
			}
		}
		collectors.set(key, {
			target: target ?? null,
			anchor: null,
			acceptsDefault:
				parts.reference.kind === "import" &&
				!parts.reference.typeOnly &&
				(target === undefined || defaultOf(target) === null),
			defaultText: null,
			specifiers: [],
		});
	}

	for (let parts of moves) {
		let reference = parts.reference;
		let collector = collectors.get(groupOf(reference))!;
		let repoint: Replacement = {
			start: reference.specifierRange.start,
			end: reference.specifierRange.end,
			text: quote(options.to, source[reference.specifierRange.start] ?? '"'),
		};
		if (inPlace.has(reference)) {
			replacements.push(repoint);
			continue;
		}
		let movedDefault =
			parts.defaultName !== null && parts.moving.has(parts.defaultName) ? parts.defaultName : null;
		let defaultJoins = movedDefault === null || collector.acceptsDefault;
		if (parts.complete && (!canCollect(parts) || !defaultJoins)) {
			replacements.push(repoint);
			continue;
		}

		let specifiers = parts.braced
			.filter((name) => parts.moving.has(name))
			.map((name) => source.slice(name.range.start, name.range.end));
		if (parts.complete) {
			replacements.push(removeLine(source, reference.range.start, reference.range.end));
		} else {
			replacements.push(...removeParts(source, parts));
		}
		if (specifiers.length > 0 || (movedDefault !== null && defaultJoins)) {
			if (collector.target === null && collector.anchor === null) collector.anchor = reference;
			collector.specifiers.push(...specifiers);
		}
		if (movedDefault !== null && defaultJoins) {
			collector.defaultText = movedDefault.local;
			collector.acceptsDefault = false;
			if (collector.target === null && collector.anchor === null) collector.anchor = reference;
		} else if (movedDefault !== null) {
			replacements.push(declarationAfter(source, reference, options.to, movedDefault.local, []));
		}
		if (parts.namespace !== null && parts.moving.has(parts.namespace)) {
			let text = source.slice(parts.namespace.range.start, parts.namespace.range.end);
			replacements.push(declarationAfter(source, reference, options.to, text, []));
		}
	}

	for (let collector of collectors.values()) {
		if (collector.target !== null) {
			replacements.push(...joinNames(source, collector.target, collector));
		} else if (collector.anchor !== null) {
			let specifiers = [...new Set(collector.specifiers)];
			replacements.push(
				declarationAfter(source, collector.anchor, options.to, collector.defaultText, specifiers),
			);
		}
	}
	return finish(filename, source, replacements, unhandled);
}

/** The bindings of `reference` and which of them `wanted` moves. */
function partsOf(reference: ModuleReference, wanted: Set<string>): Parts {
	let braced = reference.names.filter((name) => isBraced(reference, name));
	let outside = reference.names.filter((name) => !isBraced(reference, name));
	let namespace = outside.find((name) => name.imported === "*") ?? null;
	let defaultName = outside.find((name) => name.imported === "default") ?? null;
	let star = reference.kind === "export" && reference.braces === null && namespace === null;
	let moving = new Set(reference.names.filter((name) => wanted.has(name.imported)));
	let starMoves = star && wanted.has("*");
	let complete = star ? starMoves : moving.size === reference.names.length && moving.size > 0;
	return { reference, defaultName, namespace, star, braced, moving, starMoves, complete };
}

/** The unbraced default binding of `reference`, or `null`. */
function defaultOf(reference: ModuleReference): BoundName | null {
	return (
		reference.names.find((name) => name.imported === "default" && !isBraced(reference, name)) ??
		null
	);
}

/**
 * Whether a declaration can take more names: one with braces, or a value import with a default
 * only. A namespace or `export *` binds the whole module, and a type-only default stands
 * alone.
 */
function canCollect(parts: Parts): boolean {
	if (parts.namespace !== null || parts.star) return false;
	if (parts.reference.braces !== null) return true;
	return parts.defaultName !== null && !parts.reference.typeOnly;
}

/** The key that keeps imports apart from re-exports and type-only declarations from values. */
function groupOf(reference: ModuleReference): string {
	return `${reference.kind}${reference.typeOnly ? " type" : ""}`;
}

/** Whether `name` sits inside the declaration's braces, where it can be moved by name. */
function isBraced(reference: ModuleReference, name: BoundName): boolean {
	let braces = reference.braces;
	return braces !== null && name.range.start > braces.start && name.range.end < braces.end;
}

/**
 * A new declaration of `to` on the line after `anchor`, in its kind, `type` modifier, quote
 * character, semicolon style and brace spacing. `head` is a default or `* as X` binding.
 */
function declarationAfter(
	source: string,
	anchor: ModuleReference,
	to: string,
	head: string | null,
	specifiers: string[],
): Replacement {
	let clause = [head, specifiers.length > 0 ? list(source, anchor, specifiers) : null]
		.filter((part) => part !== null)
		.join(", ");
	let declaration = [
		anchor.kind,
		anchor.typeOnly ? " type" : "",
		" ",
		clause,
		" from ",
		quote(to, source[anchor.specifierRange.start] ?? '"'),
		source[anchor.range.end - 1] === ";" ? ";" : "",
	].join("");
	let at = afterLine(source, anchor.range.end);
	return {
		start: at,
		end: at,
		text: lineBreak(source) + lineIndent(source, anchor.range.start) + declaration,
	};
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
 * Deletions that take the moving bindings out of a declaration that keeps some: a default with
 * the comma after it, a namespace with the comma before it, and braced names with their
 * separators.
 */
function removeParts(source: string, parts: Parts): Replacement[] {
	let deletions: Replacement[] = [];
	let { defaultName, namespace, reference } = parts;
	if (defaultName !== null && parts.moving.has(defaultName)) {
		let next = namespace?.range.start ?? reference.braces?.start ?? defaultName.range.end;
		deletions.push({ start: defaultName.range.start, end: next, text: "" });
	}
	if (namespace !== null && parts.moving.has(namespace) && defaultName !== null) {
		deletions.push({ start: defaultName.range.end, end: namespace.range.end, text: "" });
	}
	if (parts.braced.some((name) => parts.moving.has(name))) {
		deletions.push(...removeNames(reference, parts.braced, parts.moving));
	}
	return deletions;
}

/**
 * Deletions that take `moving` out of the braces of `reference`, keeping the separators and
 * trailing comma of the names that stay. When no braced name stays, the braces go with the
 * comma that joined them to the default binding.
 */
function removeNames(
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
 * The insertions that add a collector's default before `target`'s braces and its names after the
 * last name, one per line for a list written one per line; names `target` binds are skipped.
 */
function joinNames(source: string, target: ModuleReference, collector: Collector): Replacement[] {
	let insertions: Replacement[] = [];
	let braces = target.braces;
	let defaultName = defaultOf(target);
	if (collector.defaultText !== null && braces !== null) {
		insertions.push({ start: braces.start, end: braces.start, text: `${collector.defaultText}, ` });
	}
	let present = new Set(target.names.map((name) => source.slice(name.range.start, name.range.end)));
	let adding = [...new Set(collector.specifiers)].filter((specifier) => !present.has(specifier));
	if (adding.length === 0) return insertions;
	if (braces === null) {
		let end = defaultName!.range.end;
		insertions.push({ start: end, end, text: `, { ${adding.join(", ")} }` });
		return insertions;
	}
	let braced = target.names.filter((name) => isBraced(target, name));
	let last = braced[braced.length - 1];
	if (last === undefined) {
		insertions.push({ start: braces.start, end: braces.end, text: `{ ${adding.join(", ")} }` });
		return insertions;
	}
	let first = braced[0]!;
	let multiline = crossesLine(source, braces.start, first.range.start);
	let after = source.slice(last.range.end, braces.end - 1);
	let trailingComma = after.trimStart().startsWith(",");
	if (!multiline) {
		insertions.push({ start: last.range.end, end: last.range.end, text: `, ${adding.join(", ")}` });
		return insertions;
	}
	let indent = lineIndent(source, first.range.start);
	let newline = lineBreak(source);
	let lines = adding.map((specifier) => `${newline}${indent}${specifier},`).join("");
	if (trailingComma) {
		let comma = last.range.end + after.indexOf(",") + 1;
		insertions.push({ start: comma, end: comma, text: lines });
		return insertions;
	}
	insertions.push({ start: last.range.end, end: last.range.end, text: `,${lines.slice(0, -1)}` });
	return insertions;
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
