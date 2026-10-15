/**
 * What `sdxc upgrade` reads from and changes in the project: the installed `sdxc` version, the
 * dependency pins in `package.json`, the package manager that installs them, and the files that
 * import `sdxc` or an `@sdxc/*` package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import * as s from "@sdxc/json-schema";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

/** The `package.json` sections a project's installed versions come from. */
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"] as const;

/** Files whose imports the upgrade reads. */
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

/** Folders that hold installed or generated code, which the project's own imports never live in. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", "build", "coverage"]);

/** The fields of `package.json` the upgrade reads. */
const MANIFEST_SCHEMA = s.object({
	packageManager: s.optional(s.string()),
	scripts: s.optional(s.record(s.string(), s.string())),
	dependencies: s.optional(s.record(s.string(), s.string())),
	devDependencies: s.optional(s.record(s.string(), s.string())),
	optionalDependencies: s.optional(s.record(s.string(), s.string())),
});

/** The project's `package.json` fields the upgrade reads. */
export type Manifest = s.InferOutput<typeof MANIFEST_SCHEMA>;

/** A package manager, with how the project installs and how it runs an installed binary. */
export interface PackageManager {
	name: "bun" | "npm" | "pnpm" | "yarn";
	install: string[];
	/** The command prefix that runs a binary from the project's own `node_modules`. */
	exec: string[];
	/** The command prefix that runs a `package.json` script. */
	run: string[];
}

/** One dependency pin `bumpManifest` changed. */
export interface Bump {
	name: string;
	from: string;
	to: string;
}

/** The package managers by name, with the commands each one spells. */
const PACKAGE_MANAGERS: Record<PackageManager["name"], PackageManager> = {
	bun: { name: "bun", install: ["bun", "install"], exec: ["bunx", "sdxc"], run: ["bun", "run"] },
	npm: { name: "npm", install: ["npm", "install"], exec: ["npx", "sdxc"], run: ["npm", "run"] },
	pnpm: {
		name: "pnpm",
		install: ["pnpm", "install"],
		exec: ["pnpm", "exec", "sdxc"],
		run: ["pnpm", "run"],
	},
	yarn: {
		name: "yarn",
		install: ["yarn", "install"],
		exec: ["yarn", "sdxc"],
		run: ["yarn", "run"],
	},
};

/** Lock files by the package manager that writes them, in lookup order. */
const LOCK_FILES: Array<[string, PackageManager["name"]]> = [
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["package-lock.json", "npm"],
];

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
 * The version of `sdxc` installed for the project at `root`, found as Node resolves it: in the
 * nearest `node_modules/sdxc` at or above the root. Without one the project must install first.
 */
export async function installedVersion(root: string): Promise<Result<string, Error>> {
	let directory = root;
	while (true) {
		let text = await wrap(() =>
			readFile(join(directory, "node_modules", "sdxc", "package.json"), "utf8"),
		);
		if (isSuccess(text)) {
			let version = wrap(() => (JSON.parse(text.data) as { version?: unknown }).version);
			if (isSuccess(version) && typeof version.data === "string") return success(version.data);
		}
		let parent = dirname(directory);
		if (parent === directory) {
			return failure(new Error("sdxc is not installed; install the project's dependencies first"));
		}
		directory = parent;
	}
}

/**
 * The project's package manager: the `packageManager` field when it names one, otherwise the
 * first lock file found at or above the root, otherwise npm.
 */
export async function detectPackageManager(
	root: string,
	manifest: Manifest,
): Promise<PackageManager> {
	let declared = manifest.packageManager?.split("@")[0];
	if (declared !== undefined && declared in PACKAGE_MANAGERS) {
		return PACKAGE_MANAGERS[declared as PackageManager["name"]];
	}
	let directory = root;
	while (true) {
		for (let [file, name] of LOCK_FILES) {
			if (isSuccess(await wrap(() => stat(join(directory, file))))) return PACKAGE_MANAGERS[name];
		}
		let parent = dirname(directory);
		if (parent === directory) return PACKAGE_MANAGERS.npm;
		directory = parent;
	}
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

/** Every `@sdxc/*` package the manifest lists, which `sdxc` now ships under one install. */
export function listedScopedPackages(manifest: Manifest): string[] {
	let names = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {}));
	return [...new Set(names.filter((name) => name.startsWith("@sdxc/")))].sort();
}

/**
 * Every `sdxc`, `sdxc/*` and `@sdxc/*` specifier the project's source files import, with the
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
			if (!isSdxcSpecifier(specifier)) continue;
			let files = imports.get(specifier) ?? [];
			if (!files.includes(path)) files.push(path);
			imports.set(specifier, files);
		}
	}
	return imports;
}

function isSdxcSpecifier(specifier: string): boolean {
	return specifier === "sdxc" || specifier.startsWith("sdxc/") || specifier.startsWith("@sdxc/");
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
