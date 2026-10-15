/**
 * Finds every module specifier a file names: static imports and re-exports at the top level,
 * dynamic `import()` anywhere, and the first argument of listed calls such as `vi.mock`. Each
 * reference carries the ranges an edit replaces, so no edit ever has to search the text again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Structure } from "./structure.js";
import type { Token } from "./tokenize.js";

import { CodemodError } from "./errors.js";
import {
	analyze,
	cook,
	elements,
	findCalls,
	isIdentifier,
	isMember,
	isPunctuator,
} from "./structure.js";

/** A source range as UTF-16 offsets, `end` exclusive, the way `String.prototype.slice` reads it. */
export interface Range {
	start: number;
	end: number;
}

/**
 * Where a specifier appears: an `import` declaration (side-effect imports included, with no
 * names), an `export … from` declaration, a dynamic `import()`, or a listed call.
 */
export type ReferenceKind = "import" | "export" | "dynamic" | "call";

/**
 * One name a declaration binds. `imported` is the name in the referenced module, `"default"`
 * for a default import and `"*"` for a namespace; `local` is the name in this file, which for
 * a re-export is the name it is exported under.
 */
export interface BoundName {
	imported: string;
	local: string;
	/** Whether the name is type-only, through its own `type` modifier or the declaration's. */
	typeOnly: boolean;
	/** The range of the whole specifier inside braces, `type` modifier and alias included. */
	range: Range;
}

/** One module specifier and where it sits. */
export interface ModuleReference {
	kind: ReferenceKind;
	/** The specifier's value, escapes resolved. */
	specifier: string;
	/** Whether the declaration is `import type` or `export type`. */
	typeOnly: boolean;
	/** The names the declaration binds, in source order; empty for `import()` and calls. */
	names: BoundName[];
	/** The whole declaration (its `;` included) or the whole call expression. */
	range: Range;
	/** The string literal, quotes included. */
	specifierRange: Range;
	/** The listed callee a `call` reference came from, `null` for every other kind. */
	callee: string | null;
	/** The range of the `{…}` name list, or `null` when the declaration has none. */
	braces: Range | null;
}

/** What else to report besides imports, re-exports and `import()`. */
export interface FindOptions {
	/** Dotted callees whose first argument is a specifier, such as `vi.mock` or `require`. */
	calls?: string[];
	/**
	 * Also report TypeScript import types (`typeof import("…")`, `import("…").Name`), as
	 * `dynamic` references with `typeOnly` set; a declaration file names its dependencies this way.
	 * @default false
	 */
	importTypes?: boolean;
}

/**
 * Every module reference in `source`, in source order. The extension of `filename` decides
 * whether TypeScript and JSX are read. A file that cannot be scanned, or an import or export
 * declaration outside the grammar, is a failure.
 */
export function findModuleReferences(
	filename: string,
	source: string,
	options: FindOptions = {},
): Result<ModuleReference[], CodemodError> {
	let structure = analyze(filename, source);
	if (isFailure(structure)) return structure;
	return referencesIn(structure.data, options);
}

/** {@link findModuleReferences} over a file already scanned. */
export function referencesIn(
	structure: Structure,
	options: FindOptions = {},
): Result<ModuleReference[], CodemodError> {
	let code = structure.code;
	let references: ModuleReference[] = [];
	for (let index = 0; index < code.length; index += 1) {
		let token = code[index]!;
		if (token.type !== "identifier" || isMember(structure, index)) continue;
		if (token.value === "import") {
			if (isPunctuator(code[index + 1], "(")) {
				let reference = dynamicImport(structure, index, options.importTypes === true);
				if (reference !== null) references.push(reference);
			} else if (!isPunctuator(code[index + 1], ".") && structure.depth[index] === 0) {
				let reference = importDeclaration(structure, index);
				if (isFailure(reference)) return reference;
				if (reference.data !== null) references.push(reference.data);
			}
		} else if (token.value === "export" && structure.depth[index] === 0) {
			let reference = exportDeclaration(structure, index);
			if (isFailure(reference)) return reference;
			if (reference.data !== null) references.push(reference.data);
		}
	}
	for (let callee of options.calls ?? []) {
		for (let call of findCalls(structure, callee)) {
			let literal = code[call.open + 1];
			let after = code[call.open + 2];
			if (literal?.type !== "string") continue;
			if (!isPunctuator(after, ")") && !isPunctuator(after, ",")) continue;
			references.push({
				kind: "call",
				specifier: cook(literal.value),
				typeOnly: false,
				names: [],
				range: { start: code[call.callee]!.start, end: code[call.close]!.end },
				specifierRange: { start: literal.start, end: literal.end },
				callee,
				braces: null,
			});
		}
	}
	references.sort((a, b) => a.range.start - b.range.start);
	return success(references);
}

/**
 * The `import("…")` at `code[index]`, or `null` when its argument is not a string literal, or
 * when it is a TypeScript import type (`typeof import("…")`, `import("…").Name`) and
 * `importTypes` is off.
 */
function dynamicImport(
	structure: Structure,
	index: number,
	importTypes: boolean,
): ModuleReference | null {
	let code = structure.code;
	let literal = code[index + 2];
	let after = code[index + 3];
	if (literal?.type !== "string") return null;
	if (!isPunctuator(after, ")") && !isPunctuator(after, ",")) return null;
	let close = structure.match[index + 1] ?? -1;
	let type = isIdentifier(code[index - 1], "typeof") || isTypeQualifier(code, close + 1);
	if (type && !importTypes) return null;
	return {
		kind: "dynamic",
		specifier: cook(literal.value),
		typeOnly: type,
		names: [],
		range: { start: code[index]!.start, end: code[close]!.end },
		specifierRange: { start: literal.start, end: literal.end },
		callee: null,
		braces: null,
	};
}

/**
 * Whether the tokens from `at` qualify an import type (`.Name` not followed by a call, or type
 * arguments), which an awaited or chained `import()` never is.
 */
function isTypeQualifier(code: Token[], at: number): boolean {
	if (isPunctuator(code[at], "<")) return true;
	if (!isPunctuator(code[at], ".") || !isIdentifier(code[at + 1])) return false;
	return !isPunctuator(code[at + 2], "(");
}

/**
 * The declaration at `code[index]` (an `import` at the top level). TypeScript's
 * `import x = require("…")` and `import x = A.B` name no ES module and answer `null`.
 */
function importDeclaration(
	structure: Structure,
	index: number,
): Result<ModuleReference | null, CodemodError> {
	let code = structure.code;
	let at = index + 1;
	let typeOnly = false;
	let names: BoundName[] = [];
	let braces: Range | null = null;
	let invalid = (): Result<never, CodemodError> =>
		failure(
			new CodemodError(
				"invalid-declaration",
				structure.filename,
				"import declaration does not match the grammar",
				structure.source,
				code[index]!.start,
			),
		);

	if (code[at]?.type !== "string") {
		let next = code[at + 1];
		let modifier =
			isIdentifier(code[at], "type") &&
			!isPunctuator(next, ",") &&
			!isPunctuator(next, "=") &&
			!(isIdentifier(next, "from") && code[at + 2]?.type === "string");
		if (modifier) {
			typeOnly = true;
			at += 1;
		}
		if (isIdentifier(code[at])) {
			if (isPunctuator(code[at + 1], "=")) return success(null);
			let local = code[at]!;
			names.push({
				imported: "default",
				local: local.value,
				typeOnly,
				range: { start: local.start, end: local.end },
			});
			at += 1;
			if (isPunctuator(code[at], ",")) at += 1;
			else if (!isIdentifier(code[at], "from")) return invalid();
		}
		if (isPunctuator(code[at], "*")) {
			let local = code[at + 2];
			if (!isIdentifier(code[at + 1], "as") || !isIdentifier(local)) return invalid();
			names.push({
				imported: "*",
				local: local!.value,
				typeOnly,
				range: { start: code[at]!.start, end: local!.end },
			});
			at += 3;
		} else if (isPunctuator(code[at], "{")) {
			let list = nameList(structure, at, typeOnly);
			if (list === null) return invalid();
			names.push(...list);
			let close = structure.match[at]!;
			braces = { start: code[at]!.start, end: code[close]!.end };
			at = close + 1;
		}
		if (!isIdentifier(code[at], "from")) return invalid();
		at += 1;
		if (code[at]?.type !== "string") return invalid();
	}
	return success(finishDeclaration(structure, "import", index, at, typeOnly, names, braces));
}

/**
 * The declaration at `code[index]` (an `export` at the top level) when it re-exports from a
 * module, `null` for every export of local bindings.
 */
function exportDeclaration(
	structure: Structure,
	index: number,
): Result<ModuleReference | null, CodemodError> {
	let code = structure.code;
	let at = index + 1;
	let typeOnly = false;
	let names: BoundName[] = [];
	let braces: Range | null = null;
	let invalid = (): Result<never, CodemodError> =>
		failure(
			new CodemodError(
				"invalid-declaration",
				structure.filename,
				"export declaration does not match the grammar",
				structure.source,
				code[index]!.start,
			),
		);

	if (
		isIdentifier(code[at], "type") &&
		(isPunctuator(code[at + 1], "{") || isPunctuator(code[at + 1], "*"))
	) {
		typeOnly = true;
		at += 1;
	}
	if (isPunctuator(code[at], "*")) {
		let star = code[at]!;
		at += 1;
		if (isIdentifier(code[at], "as")) {
			let exported = code[at + 1];
			if (
				exported === undefined ||
				(exported.type !== "identifier" && exported.type !== "string")
			) {
				return invalid();
			}
			names.push({
				imported: "*",
				local: nameOf(exported),
				typeOnly,
				range: { start: star.start, end: exported.end },
			});
			at += 2;
		}
		if (!isIdentifier(code[at], "from") || code[at + 1]?.type !== "string") return invalid();
		at += 1;
	} else if (isPunctuator(code[at], "{")) {
		let close = structure.match[at]!;
		if (!isIdentifier(code[close + 1], "from")) return success(null);
		let list = nameList(structure, at, typeOnly);
		if (list === null || code[close + 2]?.type !== "string") return invalid();
		names.push(...list);
		braces = { start: code[at]!.start, end: code[close]!.end };
		at = close + 2;
	} else {
		return success(null);
	}
	return success(finishDeclaration(structure, "export", index, at, typeOnly, names, braces));
}

/**
 * The reference for a declaration whose specifier is `code[literal]`, extended over import
 * attributes (`with { … }`) and a closing `;`.
 */
function finishDeclaration(
	structure: Structure,
	kind: "import" | "export",
	index: number,
	literal: number,
	typeOnly: boolean,
	names: BoundName[],
	braces: Range | null,
): ModuleReference {
	let code = structure.code;
	let specifier = code[literal]!;
	let last = literal;
	let keyword = code[last + 1];
	if (
		(isIdentifier(keyword, "with") || isIdentifier(keyword, "assert")) &&
		isPunctuator(code[last + 2], "{")
	) {
		last = structure.match[last + 2] ?? last;
	}
	if (isPunctuator(code[last + 1], ";")) last += 1;
	return {
		kind,
		specifier: cook(specifier.value),
		typeOnly,
		names,
		range: { start: code[index]!.start, end: code[last]!.end },
		specifierRange: { start: specifier.start, end: specifier.end },
		callee: null,
		braces,
	};
}

/**
 * The names inside the braces at `code[open]`. Each element is `name`, `type name`,
 * `name as alias` or `type name as alias`, where a name may be a string literal; anything
 * else answers `null`. For a re-export the alias is the exported name.
 */
function nameList(structure: Structure, open: number, typeOnly: boolean): BoundName[] | null {
	let code = structure.code;
	let names: BoundName[] = [];
	for (let span of elements(structure, open)) {
		let tokens = code.slice(span.start, span.end);
		let parsed = specifier(tokens);
		if (parsed === null) return null;
		let range = { start: tokens[0]!.start, end: tokens[tokens.length - 1]!.end };
		names.push({
			imported: parsed.imported,
			local: parsed.local ?? parsed.imported,
			typeOnly: typeOnly || parsed.typeOnly,
			range,
		});
	}
	return names;
}

/** One element of a name list, read by its token count. */
function specifier(
	tokens: Token[],
): { imported: string; local: string | null; typeOnly: boolean } | null {
	let isName = (token: Token | undefined): boolean =>
		token !== undefined && (token.type === "identifier" || token.type === "string");
	let [first, second, third, fourth] = tokens;
	if (tokens.length === 1 && isName(first)) {
		return { imported: nameOf(first!), local: null, typeOnly: false };
	}
	if (tokens.length === 2 && isIdentifier(first, "type") && isName(second)) {
		return { imported: nameOf(second!), local: null, typeOnly: true };
	}
	if (tokens.length === 3 && isName(first) && isIdentifier(second, "as") && isName(third)) {
		return { imported: nameOf(first!), local: nameOf(third!), typeOnly: false };
	}
	if (
		tokens.length === 4 &&
		isIdentifier(first, "type") &&
		isName(second) &&
		isIdentifier(third, "as") &&
		isName(fourth)
	) {
		return { imported: nameOf(second!), local: nameOf(fourth!), typeOnly: true };
	}
	return null;
}

/** An identifier's text, or a string literal's value. */
function nameOf(token: Token): string {
	return token.type === "string" ? cook(token.value) : token.value;
}
