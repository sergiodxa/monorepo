/**
 * What `sdxc upgrade` reads from and changes in the project: the release its `@sdxc/*` pins are
 * on, the dependency pins in `package.json`, and the files that import an `@sdxc/*` package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import * as s from "@sdxc/json-schema";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import { datedPin, projectRelease, scopedPackageOf } from "../releases.js";

/** The `package.json` sections a project's installed versions come from. */
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"] as const;

/** Files whose imports the upgrade reads. */
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

/** Folders that hold installed or generated code, which the project's own imports never live in. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", "build", "coverage"]);

/** The fields of `package.json` the upgrade reads. */
const MANIFEST_SCHEMA = s.object({
	name: s.optional(s.string()),
	packageManager: s.optional(s.string()),
	scripts: s.optional(s.record(s.string(), s.string())),
	dependencies: s.optional(s.record(s.string(), s.string())),
	devDependencies: s.optional(s.record(s.string(), s.string())),
	optionalDependencies: s.optional(s.record(s.string(), s.string())),
});

/** The project's `package.json` fields the upgrade reads. */
export type Manifest = s.InferOutput<typeof MANIFEST_SCHEMA>;

/** One dependency pin `bumpManifest` changed. */
export interface Bump {
	name: string;
	from: string;
	to: string;
}

/** The project's `package.json`, as written and as parsed. */
export async function readManifest(
	root: string,
): Promise<Result<{ text: string; manifest: Manifest }, Error>> {
	let text = await wrap(() => readFile(join(root, "package.json"), "utf8"));
	if (isFailure(text)) return text;
	let parsed = wrap(() => JSON.parse(text.data) as unknown);
	if (isFailure(parsed)) return failure(new Error(`package.json: ${parsed.error.message}`));
	let checked = s.parseSafe(MANIFEST_SCHEMA, parsed.data);
	if (!checked.success) return failure(new Error("package.json: a dependency field is malformed"));
	return success({ text: text.data, manifest: checked.value });
}

/**
 * The release the project is on: the newest date among the exact `@sdxc/*` pins its dependency
 * sections list, or `null` when it pins none.
 */
export function currentRelease(manifest: Manifest): string | null {
	return projectRelease(DEPENDENCY_FIELDS.map((field) => manifest[field]));
}

/**
 * `text` with each named dependency's pin set to its version, in every dependency section that
 * lists it, and every other byte kept, so the diff is exactly the bumped lines.
 *
 * @param versions - The exact versions to pin, by package name.
 */
export function bumpManifest(
	text: string,
	versions: Record<string, string>,
): { text: string; bumps: Bump[] } {
	let bumps: Bump[] = [];
	let output = text;
	for (let field of DEPENDENCY_FIELDS) {
		let header = new RegExp(`"${field}"\\s*:\\s*\\{`).exec(output);
		if (header === null) continue;
		let start = header.index + header[0].length;
		let end = output.indexOf("}", start);
		if (end === -1) continue;
		let section = output.slice(start, end);
		for (let [name, version] of Object.entries(versions)) {
			let pin = new RegExp(`("${escapeRegExp(name)}"\\s*:\\s*")([^"]*)(")`);
			section = section.replace(pin, (_, before: string, from: string, after: string) => {
				if (from !== version) bumps.push({ name, from, to: version });
				return `${before}${version}${after}`;
			});
		}
		output = `${output.slice(0, start)}${section}${output.slice(end)}`;
	}
	return { text: output, bumps };
}

/** Whether a dependency section of the manifest lists `name`. */
export function lists(manifest: Manifest, name: string): boolean {
	return DEPENDENCY_FIELDS.some((field) => manifest[field]?.[name] !== undefined);
}

/** The dated release `name` is pinned to in the first dependency section listing it, or `null`. */
export function pinnedRelease(manifest: Manifest, name: string): string | null {
	for (let field of DEPENDENCY_FIELDS) {
		let range = manifest[field]?.[name];
		if (range !== undefined) return datedPin(range);
	}
	return null;
}

/** Every `@sdxc/*` package the manifest lists, which the upgrade moves together. */
export function listedScopedPackages(manifest: Manifest): string[] {
	let names = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {}));
	return [...new Set(names.filter((name) => name.startsWith("@sdxc/")))].sort();
}

/**
 * Every `@sdxc/*` specifier the project's source files import, with the
 * files (relative to `root`) that import it. Installed and generated folders and dot-folders
 * are skipped; a file the scanner cannot read is skipped too.
 */
export async function projectImports(root: string): Promise<Map<string, string[]>> {
	let imports = new Map<string, string[]>();
	for (let file of await sourceFiles(root)) {
		let source = await wrap(() => readFile(file, "utf8"));
		if (isFailure(source)) continue;
		let references = findModuleReferences(file, source.data);
		if (isFailure(references)) continue;
		let path = relative(root, file);
		for (let { specifier } of references.data) {
			if (scopedPackageOf(specifier) === null) continue;
			let files = imports.get(specifier) ?? [];
			if (!files.includes(path)) files.push(path);
			imports.set(specifier, files);
		}
	}
	return imports;
}

async function sourceFiles(directory: string): Promise<string[]> {
	let entries = await wrap(() => readdir(directory, { withFileTypes: true }));
	if (isFailure(entries)) return [];
	let files: string[] = [];
	for (let entry of entries.data) {
		if (entry.name.startsWith(".") || SKIPPED_FOLDERS.has(entry.name)) continue;
		let path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
		else if (entry.isFile() && SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
			files.push(path);
		}
	}
	return files.sort();
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
