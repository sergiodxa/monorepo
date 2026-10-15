/**
 * The app-wide import rewrite behind `sdxc ui`: every TypeScript and JavaScript file in the
 * project imports a copied component from its copy, and from `@sdxc/ui/<name>` again once the
 * copy is removed. Edits go through `@sdxc/codemod`, so only the import declarations change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join, posix } from "node:path";

import type { ModuleReference } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { findModuleReferences, moveImports, rewriteSpecifiers } from "@sdxc/codemod";
import { isFailure, success, wrap } from "@sdxc/result";

import type { CopyLayout } from "./layout.js";

import { copySpecifier, namesCopy } from "./layout.js";

/** The specifier that exports every component. */
export const UI_ROOT = "@sdxc/ui";

/** Extensions of the files the rewrite reads. */
const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** Folders that hold installed packages, build output or tool state, never project sources. */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	"coverage",
	".wrangler",
	".output",
	".cache",
	".turbo",
	".next",
	".vercel",
	".netlify",
]);

/** A copied component as the rewrite needs it: its name and every name its module exports. */
export interface CopiedComponent {
	name: string;
	exports: readonly string[];
}

/** A file's text after the rewrite, with the imports it could not split by name. */
export interface Rewritten {
	source: string;
	/** `<file>:<line>` of each default or namespace import of `@sdxc/ui` left as it was. */
	unhandled: string[];
}

/**
 * Every source file in the project at `root`, relative to it with `/` separators and sorted,
 * outside installed packages and build output.
 */
export async function projectSources(root: string): Promise<Result<string[], Error>> {
	return wrap(async () => {
		let found: string[] = [];
		let walk = async (directory: string): Promise<void> => {
			let entries = await readdir(join(root, directory), { withFileTypes: true });
			for (let entry of entries) {
				let path = directory === "" ? entry.name : `${directory}/${entry.name}`;
				if (entry.isDirectory()) {
					if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(path);
				} else if (entry.isFile() && SOURCE_FILE.test(entry.name)) {
					found.push(path);
				}
			}
		};
		await walk("");
		return found.sort();
	});
}

/** Reads a project file, `null` when it does not exist. */
export async function readProjectFile(root: string, path: string): Promise<string | null> {
	let text = await wrap(() => readFile(join(root, path), "utf8"));
	return isFailure(text) ? null : text.data;
}

/**
 * `source` importing each of `copies` from its copy: `@sdxc/ui/<name>` is replaced, and the
 * names a copy exports move off `@sdxc/ui` into an import of the copy. A default or namespace
 * import of `@sdxc/ui` stays and is reported, since it cannot be split by name.
 *
 * @param file - The file's path relative to the project root, which decides relative specifiers.
 */
export function pointAtCopies(
	file: string,
	source: string,
	copies: readonly CopiedComponent[],
	layout: CopyLayout,
): Result<Rewritten, Error> {
	if (copies.length === 0 || !source.includes(UI_ROOT)) return success({ source, unhandled: [] });
	let current = source;
	let unsplit = false;
	for (let copy of copies) {
		let target = copySpecifier(layout, file, copy.name);
		let renamed = rewriteSpecifiers(file, current, (reference) =>
			reference.specifier === `${UI_ROOT}/${copy.name}` ? target : null,
		);
		if (isFailure(renamed)) return renamed;
		current = renamed.data.source;
		if (copy.exports.length === 0) continue;
		let moved = moveImports(file, current, { from: UI_ROOT, names: [...copy.exports], to: target });
		if (isFailure(moved)) return moved;
		current = moved.data.source;
		if (moved.data.unhandled.length > 0) unsplit = true;
	}
	if (!unsplit) return success({ source: current, unhandled: [] });
	let references = findModuleReferences(file, current);
	if (isFailure(references)) return references;
	let reports = references.data
		.filter((reference) => reference.specifier === UI_ROOT && !splittable(reference))
		.map((reference) => `${file}:${lineOf(current, reference.range.start)}`);
	return success({ source: current, unhandled: reports });
}

/**
 * `source` importing each of `removed` from the package again: an import of a copy is folded
 * into the file's `@sdxc/ui` declaration when it has one, and points at `@sdxc/ui/<name>`
 * otherwise.
 */
export function pointBack(
	file: string,
	source: string,
	removed: readonly CopiedComponent[],
	layout: CopyLayout,
): Result<string, Error> {
	let current = source;
	for (let copy of removed) {
		if (!current.includes(copy.name)) continue;
		let references = findModuleReferences(file, current);
		if (isFailure(references)) return references;
		let specifiers = new Set(
			references.data
				.filter((reference) => namesCopy(layout, file, reference.specifier, copy.name))
				.map((reference) => reference.specifier),
		);
		if (specifiers.size === 0) continue;
		let hasRoot = references.data.some(
			(reference) =>
				(reference.kind === "import" || reference.kind === "export") &&
				reference.specifier === UI_ROOT &&
				reference.braces !== null,
		);
		for (let specifier of specifiers) {
			if (hasRoot && copy.exports.length > 0) {
				let folded = moveImports(file, current, {
					from: specifier,
					names: [...copy.exports],
					to: UI_ROOT,
				});
				if (isFailure(folded)) return folded;
				current = folded.data.source;
			}
			let renamed = rewriteSpecifiers(file, current, (reference) =>
				reference.specifier === specifier ? `${UI_ROOT}/${copy.name}` : null,
			);
			if (isFailure(renamed)) return renamed;
			current = renamed.data.source;
		}
	}
	return success(current);
}

/**
 * Whether a declaration can be split by name: no default or namespace binding, and no
 * `export *`. A side-effect import binds nothing and counts as splittable.
 */
function splittable(reference: ModuleReference): boolean {
	if (reference.kind === "export" && reference.braces === null) return false;
	return reference.names.every((name) => name.imported !== "default" && name.imported !== "*");
}

/** The 1-based line of `offset` in `source`. */
function lineOf(source: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index++) {
		if (source.charCodeAt(index) === 10) line += 1;
	}
	return line;
}

/** `path` joined under the copies' folder, as a project-relative path. */
export function copyPath(layout: CopyLayout, file: string): string {
	return posix.join(layout.directory, file);
}
