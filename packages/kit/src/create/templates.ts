/**
 * The templates `sdxc create` starts a project from: a name without a slash is a template
 * shipped in the `@sdxc/kit` package, and `org/repo[/path][#ref]` is a GitHub repository. Either
 * way the template becomes an in-memory file tree, completed for the new project, then written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { addHeaderTags } from "../author.js";
import { renderConfig } from "../init.js";
import { resolveInside } from "../project.js";
import { resolveRelease, scopedPackageOf } from "../releases.js";

/** The template `create` uses without `--template`. */
export const DEFAULT_TEMPLATE = "app";

/**
 * The built-in templates `sdxc create` offers to pick from on a terminal, in the order it lists
 * them; a test keeps it equal to the package's `templates/` folder.
 */
export const BUILTIN_TEMPLATES: readonly string[] = ["app"];

/**
 * Built-in template files stored under another name, because npm drops a `.gitignore` from a
 * published tarball; each is written under the name it maps to.
 */
const RENAMED_FILES = new Map([["gitignore", ".gitignore"]]);

/**
 * The configuration every built-in template ships beyond `sdxc init`'s defaults: each one checks
 * with Vite+, so the files `make` and `ui add` write are formatted as `vp check` expects. A run
 * that wrote only files `vp fmt` has no formatter for, such as a migration, succeeds.
 */
const BUILTIN_CONFIG = { format: ["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"] };

/** Where a template comes from, as `--template` spells it. */
export type TemplateSource =
	| { kind: "builtin"; name: string }
	| { kind: "github"; owner: string; repo: string; path: string | null; ref: string | null };

/**
 * A template's files and directories by project-relative POSIX path. Directories are listed
 * only when a template carries one with nothing in it.
 */
export interface TemplateTree {
	files: Map<string, Uint8Array>;
	directories: Set<string>;
}

/** The kit's own manifest field a built-in template pins `remix` from. */
interface OwnManifest {
	peerDependencies?: Record<string, string>;
}

/** The directory of the installed `@sdxc/kit` package, which holds `templates/` and `package.json`. */
export function defaultPackageRoot(): string {
	return fileURLToPath(new URL("../../", import.meta.url));
}

/**
 * Reads `--template`. A `host:` prefix is reserved for hosts besides GitHub and refused; a
 * GitHub path may not climb with `..` or hold empty segments.
 */
export function parseTemplate(spec: string): Result<TemplateSource, Error> {
	let host = /^([A-Za-z][\w.-]*):/.exec(spec);
	if (host !== null) {
		return failure(
			new Error(
				`Template host "${host[1]}:" is not supported; name a GitHub repository as org/repo`,
			),
		);
	}
	if (!spec.includes("/")) {
		if (!/^[a-z0-9][a-z0-9-]*$/.test(spec)) {
			return failure(new Error(`"${spec}" is not a template name`));
		}
		return success({ kind: "builtin", name: spec });
	}
	let hash = spec.indexOf("#");
	let location = hash === -1 ? spec : spec.slice(0, hash);
	let ref = hash === -1 ? null : spec.slice(hash + 1);
	if (ref === "") return failure(new Error(`${spec} names an empty ref after #`));
	let segments = location.split("/");
	let [owner, repo, ...rest] = segments;
	let invalid = segments.some((segment) => segment === "" || segment === "." || segment === "..");
	if (owner === undefined || repo === undefined || invalid) {
		return failure(new Error(`${spec} is not a template; write org/repo[/path][#ref]`));
	}
	return success({
		kind: "github",
		owner,
		repo,
		path: rest.length === 0 ? null : rest.join("/"),
		ref,
	});
}

/** The built-in template names shipped in the package at `packageRoot`, sorted. */
export async function builtinTemplates(packageRoot: string): Promise<Result<string[], Error>> {
	let entries = await wrap(() => readdir(join(packageRoot, "templates"), { withFileTypes: true }));
	if (isFailure(entries)) return entries;
	return success(
		entries.data
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort(),
	);
}

/**
 * Reads the built-in template `name` into a tree. An unknown name is a failure listing the
 * templates the package ships.
 */
export async function readBuiltinTemplate(
	packageRoot: string,
	name: string,
): Promise<Result<TemplateTree, Error>> {
	let available = await builtinTemplates(packageRoot);
	if (isFailure(available)) return available;
	if (!available.data.includes(name)) {
		return failure(
			new Error(`No built-in template "${name}"; choose one of: ${available.data.join(", ")}`),
		);
	}
	let root = join(packageRoot, "templates", name);
	let tree: TemplateTree = { files: new Map(), directories: new Set() };
	let read = await wrap(() => readInto(root, "", tree));
	if (isFailure(read)) return read;
	return success(tree);
}

/** Adds every file under `directory` to `tree`, keyed by its path relative to the template. */
async function readInto(directory: string, prefix: string, tree: TemplateTree): Promise<void> {
	for (let entry of await readdir(directory, { withFileTypes: true })) {
		let path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
		let source = join(directory, entry.name);
		if (entry.isDirectory()) {
			await readInto(source, path, tree);
		} else if (entry.isFile()) {
			let renamed = prefix === "" ? (RENAMED_FILES.get(entry.name) ?? path) : path;
			tree.files.set(renamed, new Uint8Array(await readFile(source)));
		}
	}
}

/**
 * Completes a built-in template for the project `name`: names it, pins every `@sdxc/*` package it
 * lists to the version npm calls `latest` and `remix` to the peer the kit declares, and writes
 * `.config/sdxc.jsonc` as `sdxc init` renders it with the template's formatter, so a new
 * configuration key reaches new projects. It copies `.env.example` to `.dev.vars`, so the
 * development secrets it lists are in place for the project's first `bun dev`.
 */
export async function completeBuiltin(
	tree: TemplateTree,
	name: string,
	packageRoot: string,
	signal?: AbortSignal,
): Promise<Result<void, Error>> {
	let text = await wrap(() => readFile(join(packageRoot, "package.json"), "utf8"));
	if (isFailure(text)) return text;
	let own = wrap(() => JSON.parse(text.data) as OwnManifest);
	if (isFailure(own)) return own;
	let remix = own.data.peerDependencies?.remix;
	let listed = treeDependencies(tree);
	if (isFailure(listed)) return listed;
	let pins = await resolveRelease(
		listed.data.filter((dependency) => scopedPackageOf(dependency) === dependency),
		null,
		signal,
	);
	if (isFailure(pins)) return pins;
	let renamed = editManifest(tree, (manifest) => {
		manifest.name = name;
		for (let field of ["dependencies", "devDependencies"] as const) {
			let section = record(manifest[field]);
			for (let dependency of Object.keys(section)) {
				let pin = pins.data.get(dependency);
				if (pin !== undefined) section[dependency] = pin;
			}
			if (field === "dependencies" && remix !== undefined) section.remix = remix;
			if (Object.keys(section).length > 0) manifest[field] = section;
		}
	});
	if (isFailure(renamed)) return renamed;
	let example = tree.files.get(".env.example");
	if (example !== undefined && !tree.files.has(".dev.vars")) tree.files.set(".dev.vars", example);
	if (!tree.files.has(".config/sdxc.jsonc")) {
		let config = renderConfig(BUILTIN_CONFIG);
		if (isFailure(config)) return config;
		tree.files.set(".config/sdxc.jsonc", new TextEncoder().encode(config.data));
	}
	return success(undefined);
}

/**
 * Adds `tags` to the module JSDoc of every TypeScript module in a built-in template, so the new
 * project's files credit its author the way the files `sdxc make` writes do.
 */
export function creditTemplate(tree: TemplateTree, tags: string): void {
	for (let [path, bytes] of tree.files) {
		if (!/\.tsx?$/.test(path)) continue;
		let source = new TextDecoder().decode(bytes);
		tree.files.set(path, new TextEncoder().encode(addHeaderTags(source, tags)));
	}
}

/** Every package the tree's `package.json` lists under `dependencies` or `devDependencies`. */
function treeDependencies(tree: TemplateTree): Result<string[], Error> {
	let bytes = tree.files.get("package.json");
	if (bytes === undefined) return success([]);
	let parsed = wrap(() => JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>);
	if (isFailure(parsed)) {
		return failure(new Error(`The template's package.json is not JSON: ${parsed.error.message}`));
	}
	return success([
		...Object.keys(record(parsed.data.dependencies)),
		...Object.keys(record(parsed.data.devDependencies)),
	]);
}

/** Names the project in a template's `package.json`, when the template has one. */
export function nameProject(tree: TemplateTree, name: string): Result<void, Error> {
	return editManifest(tree, (manifest) => {
		manifest.name = name;
	});
}

/**
 * Applies `edit` to the tree's `package.json`, keeping its indentation and moving `name` to
 * the top when the template had none. A tree without one is left as it is.
 */
function editManifest(
	tree: TemplateTree,
	edit: (manifest: Record<string, unknown>) => void,
): Result<void, Error> {
	let bytes = tree.files.get("package.json");
	if (bytes === undefined) return success(undefined);
	let text = new TextDecoder().decode(bytes);
	let parsed = wrap(() => JSON.parse(text) as unknown);
	if (isFailure(parsed)) {
		return failure(new Error(`The template's package.json is not JSON: ${parsed.error.message}`));
	}
	if (typeof parsed.data !== "object" || parsed.data === null || Array.isArray(parsed.data)) {
		return failure(new Error("The template's package.json is not an object"));
	}
	let manifest: Record<string, unknown> = { name: undefined, ...parsed.data };
	edit(manifest);
	let indent = /^[ \t]+/m.exec(text)?.[0] ?? "\t";
	tree.files.set(
		"package.json",
		new TextEncoder().encode(`${JSON.stringify(manifest, null, indent)}\n`),
	);
	return success(undefined);
}

/** `value` as a string record, or a fresh one when it is missing or another shape. */
function record(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	return value as Record<string, string>;
}

/**
 * Writes `tree` under `directory`, creating it and every parent. Each path is checked to stay
 * inside `directory` before anything is written, so a tree that would escape writes nothing.
 */
export async function writeTree(
	directory: string,
	tree: TemplateTree,
): Promise<Result<void, Error>> {
	let targets: Array<[string, Uint8Array | null]> = [];
	for (let path of tree.directories) targets.push([path, null]);
	for (let [path, bytes] of tree.files) targets.push([path, bytes]);
	let resolved: Array<[string, Uint8Array | null]> = [];
	for (let [path, bytes] of targets) {
		let inside = resolveInside(directory, posix.normalize(path));
		if (isFailure(inside)) return inside;
		resolved.push([inside.data, bytes]);
	}
	return wrap(async () => {
		await mkdir(directory, { recursive: true });
		for (let [path, bytes] of resolved) {
			if (bytes === null) {
				await mkdir(path, { recursive: true });
				continue;
			}
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, bytes, { flag: "wx" });
		}
	});
}
