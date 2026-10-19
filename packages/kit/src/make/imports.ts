/**
 * The imports a declaration or mapping needs in the file it edits: a namespace for a schema
 * builder, the default export of a declaration module, a named helper such as `lazy`. Each is
 * reused when the file already imports it, under whatever name it uses there, and added after
 * the file's last import otherwise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dirname, posix } from "node:path";

import type { ModuleReference } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure, success } from "@sdxc/result";

import { literal } from "./generate.js";

/** A source with an import ensured, and the local name that import binds. */
export interface Imported {
	source: string;
	local: string;
}

/** What to import: a namespace, the default export, or one named export. */
export type ImportKind =
	| { kind: "namespace" }
	| { kind: "default" }
	| { kind: "named"; name: string };

/**
 * `source` importing `what` from a module `matches` accepts, as a value. An existing import is
 * reused under its local name; otherwise `import … from "<specifier>"` is added as `preferred`
 * after the last import, joining an existing named import list of `specifier` when there is one.
 */
export function ensureImport(
	filename: string,
	source: string,
	what: ImportKind,
	matches: (specifier: string) => boolean,
	specifier: string,
	preferred: string,
): Result<Imported, Error> {
	let references = findModuleReferences(filename, source);
	if (isFailure(references)) return references;
	let imports = references.data.filter(
		(reference) =>
			reference.kind === "import" && !reference.typeOnly && matches(reference.specifier),
	);
	for (let reference of imports) {
		let bound = reference.names.find((name) => !name.typeOnly && bindsAs(name.imported, what));
		if (bound !== undefined) return success({ source, local: bound.local });
	}
	if (what.kind === "named") {
		let list = imports.find((reference) => reference.braces !== null);
		if (list?.braces) {
			let inner = source.slice(list.braces.start + 1, list.braces.end - 1);
			let at = list.braces.start + 1 + inner.replace(/[\s,]*$/, "").length;
			let text = inner.trim() === "" ? ` ${what.name} ` : `, ${what.name}`;
			return success({
				source: `${source.slice(0, at)}${text}${source.slice(at)}`,
				local: what.name,
			});
		}
	}
	let clause =
		what.kind === "namespace"
			? `* as ${preferred}`
			: what.kind === "default"
				? preferred
				: `{ ${what.name} }`;
	let local = what.kind === "named" ? what.name : preferred;
	let statement = `import ${clause} from ${literal(specifier)};`;
	return success({ source: insertImport(source, references.data, statement), local });
}

/**
 * `source` importing the type `name` from `specifier`. An existing binding of it, as a type or a
 * value, is reused under its local name; otherwise `import type { … }` is added after the last
 * import, since a declaration that only names the type keeps the module out of the bundle.
 */
export function ensureTypeImport(
	filename: string,
	source: string,
	name: string,
	specifier: string,
): Result<Imported, Error> {
	let references = findModuleReferences(filename, source);
	if (isFailure(references)) return references;
	for (let reference of references.data) {
		if (reference.kind !== "import" || reference.specifier !== specifier) continue;
		let bound = reference.names.find((each) => each.imported === name);
		if (bound !== undefined) return success({ source, local: bound.local });
	}
	let statement = `import type { ${name} } from ${literal(specifier)};`;
	return success({ source: insertImport(source, references.data, statement), local: name });
}

/** Whether a bound import name is the kind of binding `what` asks for. */
function bindsAs(imported: string, what: ImportKind): boolean {
	if (what.kind === "namespace") return imported === "*";
	if (what.kind === "default") return imported === "default";
	return imported === what.name;
}

/** `source` with `statement` on its own line after the last static import, or first. */
function insertImport(source: string, references: ModuleReference[], statement: string): string {
	let last = references.filter((reference) => reference.kind === "import").at(-1);
	if (last === undefined) return `${statement}\n${source}`;
	let end = source.indexOf("\n", last.range.end);
	let at = end === -1 ? source.length : end;
	return `${source.slice(0, at)}\n${statement}${source.slice(at)}`;
}

/**
 * Whether `specifier`, written in `fromFile`, names the module at `target`: through the `~/`
 * alias or a relative path, with or without an extension or a trailing `/index`. Both paths
 * are relative to the project root.
 */
export function resolvesTo(specifier: string, fromFile: string, target: string): boolean {
	let path: string;
	if (specifier.startsWith("~/")) path = specifier.slice(2);
	else if (specifier.startsWith(".")) path = posix.join(dirname(fromFile), specifier);
	else return false;
	return moduleKey(path) === moduleKey(target);
}

/** A module path without its extension or a trailing `/index`, for comparing two spellings. */
function moduleKey(path: string): string {
	return posix
		.normalize(path)
		.replace(/\.(?:[cm]?[jt]sx?)$/, "")
		.replace(/\/index$/, "");
}

/**
 * How `fromFile` should import `target` (a project-relative path without extension), following
 * `examples`, the specifiers of the same kind the file already writes: through the `~/` alias
 * when they use it, relatively when they do, with a `.js` extension when theirs carry one.
 * Without examples, `aliased` decides, which is whether the project declares the `~/` alias.
 */
export function specifierFor(
	fromFile: string,
	target: string,
	examples: readonly string[],
	aliased: boolean,
): string {
	let relative = examples.filter((example) => example.startsWith("."));
	let alias = examples.some((example) => example.startsWith("~/"));
	if (alias || (relative.length === 0 && aliased)) return `~/${target.replace(/\/index$/, "")}`;
	let withJs = relative.some((example) => example.endsWith(".js"));
	let path = posix.relative(dirname(fromFile), target);
	if (!path.startsWith(".")) path = `./${path}`;
	return withJs ? `${path}.js` : path.replace(/\/index$/, "");
}
