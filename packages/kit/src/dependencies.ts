/**
 * Keeps a project's `package.json` listing every `@sdxc/*` package its generated code imports:
 * a package missing from it is added at the project's own release, so code `sdxc make` writes
 * installs beside packages of the same day and never pulls a newer one in on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import { projectRelease, resolveRelease, scopedPackageOf } from "./releases.js";

/** The `package.json` sections that count as listing a package. */
const LISTING_FIELDS = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
] as const;

/**
 * Optional peers a package subpath imports at runtime: a project importing the subpath lists
 * them itself, since installing the subpath's package leaves its optional peers out.
 */
const SUBPATH_PEERS: Readonly<Record<string, readonly string[]>> = {
	"@sdxc/data-model/testing": ["@sdxc/sample"],
};

/** A file's path relative to the project root and its whole content. */
export interface SourceText {
	path: string;
	content: string;
}

/** The `package.json` edit that lists the missing packages, and what it added. */
export interface DependencyEdit {
	path: "package.json";
	before: string;
	after: string;
	/** Each added package with its exact version, sorted by name. */
	added: Array<{ name: string; version: string }>;
}

/**
 * Every `@sdxc/*` package `files` import, statically or dynamically, with the optional peers
 * an imported subpath needs at runtime, and `@sdxc/spec` when any file is a pairing `.spec`,
 * sorted.
 */
export function importedPackages(files: readonly SourceText[]): string[] {
	let names = new Set<string>();
	for (let file of files) {
		if (file.path.endsWith(".spec")) names.add("@sdxc/spec");
		let references = findModuleReferences(file.path, file.content);
		if (isFailure(references)) continue;
		for (let { specifier } of references.data) {
			let name = scopedPackageOf(specifier);
			if (name !== null) names.add(name);
			for (let peer of SUBPATH_PEERS[specifier] ?? []) names.add(peer);
		}
	}
	return [...names].sort();
}

/**
 * The edit adding to the project at `root` every `@sdxc/*` package `files` import that its
 * `package.json` does not list, each at its newest version on or before the project's release,
 * the newest date among its `@sdxc/*` pins, or at `latest` when it pins none. `null` when
 * nothing is missing.
 */
export async function missingDependencies(
	root: string,
	files: readonly SourceText[],
	signal?: AbortSignal,
): Promise<Result<DependencyEdit | null, Error>> {
	let before = await wrap(() => readFile(join(root, "package.json"), "utf8"));
	if (isFailure(before)) return before;
	let manifest = wrap(() => JSON.parse(before.data) as Record<string, unknown>);
	if (isFailure(manifest)) {
		return failure(new Error(`package.json: ${manifest.error.message}`));
	}
	let sections = LISTING_FIELDS.map((field) => section(manifest.data[field]));
	let listed = new Set(sections.flatMap((entries) => Object.keys(entries)));
	let missing = importedPackages(files).filter((name) => !listed.has(name));
	if (missing.length === 0) return success(null);
	let release = projectRelease(sections.slice(0, 3));
	let versions = await resolveRelease(missing, release, signal);
	if (isFailure(versions)) return versions;
	let dependencies = { ...section(manifest.data.dependencies) };
	for (let [name, version] of versions.data) dependencies[name] = version;
	manifest.data.dependencies = Object.fromEntries(
		Object.entries(dependencies).sort(([a], [b]) => {
			if (a < b) return -1;
			if (a > b) return 1;
			return 0;
		}),
	);
	let indent = /^[ \t]+/m.exec(before.data)?.[0] ?? "\t";
	return success({
		path: "package.json",
		before: before.data,
		after: `${JSON.stringify(manifest.data, null, indent)}\n`,
		added: [...versions.data].map(([name, version]) => ({ name, version })),
	});
}

/** A `package.json` section as a string record, or an empty one when it is missing or malformed. */
function section(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}
