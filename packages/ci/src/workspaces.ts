/**
 * The project's workspaces, read from the `workspaces` field of the root `package.json` the way
 * npm, Bun, pnpm and Yarn read it, with the dependency graph between them and the tracked files
 * each one owns, so a script can filter them and a scoped run can widen to dependents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { trackedFiles } from "./git.js";
import { fileGlob } from "./glob.js";

/** The parts of a `package.json` a run reads. */
export interface PackageManifest {
	name?: string;
	workspaces?: string[] | { packages?: string[] };
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	[key: string]: unknown;
}

/** One workspace of the project. */
export interface Workspace {
	/** The package name, or the path when the manifest names none. */
	name: string;
	/** Relative to the project root, with forward slashes. */
	path: string;
	absolute: string;
	manifest: PackageManifest;
	/** Names of the workspaces this one depends on directly. */
	dependencies: string[];
	/** Names of the workspaces that depend on this one, directly or through others. */
	dependents: string[];
	/** The workspace's tracked files, relative to the project root. */
	files(): Promise<string[]>;
	/** Whether a tracked file matches `glob`, read relative to the workspace. */
	has(glob: string): boolean;
}

/** The workspaces `ci.workspaces()` made, recognised by a matrix for its default cache inputs. */
const MADE = new WeakSet<object>();

/** Whether `item` is a workspace `ci.workspaces()` returned. */
export function isWorkspace(item: unknown): item is Workspace {
	return typeof item === "object" && item !== null && MADE.has(item);
}

/** A `package.json` parsed, or a failure naming the file. */
async function readManifest(path: string): Promise<Result<PackageManifest, Error>> {
	let text = await wrap(() => readFile(path, "utf8"));
	if (isFailure(text)) return text;
	let parsed = wrap((): unknown => JSON.parse(text.data));
	if (isFailure(parsed)) return failure(new Error(`${path} is not valid JSON`));
	if (typeof parsed.data !== "object" || parsed.data === null) {
		return failure(new Error(`${path} holds no object`));
	}
	return success(parsed.data as PackageManifest);
}

/** The directories under `root` matching one `workspaces` pattern, relative to `root`. */
async function expand(root: string, pattern: string): Promise<string[]> {
	let segments = pattern.replace(/^\.\//, "").replace(/\/$/, "").split("/");
	let found = [""];
	for (let segment of segments) {
		let next: string[] = [];
		for (let base of found) next.push(...(await matchSegment(root, base, segment)));
		found = next;
	}
	return found;
}

/** The directories inside `base` a single pattern segment reaches; `**` reaches any depth. */
async function matchSegment(root: string, base: string, segment: string): Promise<string[]> {
	if (!segment.includes("*") && !segment.includes("?")) return [join(base, segment)];
	let listed = await wrap(() => readdir(join(root, base), { withFileTypes: true }));
	if (isFailure(listed)) return [];
	let directories = listed.data
		.filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
		.map((entry) => join(base, entry.name));
	if (segment !== "**") {
		let matcher = fileGlob(segment);
		return directories.filter((directory) =>
			matcher.test(directory.slice(base.length + (base === "" ? 0 : 1))),
		);
	}
	let deeper: string[] = [base];
	for (let directory of directories) deeper.push(...(await matchSegment(root, directory, "**")));
	return deeper;
}

/** The `workspaces` patterns, positive and negated, in either shape package managers accept. */
function patternsOf(manifest: PackageManifest): string[] {
	let field = manifest.workspaces;
	if (Array.isArray(field)) return field;
	return field?.packages ?? [];
}

/** Every dependency name a manifest declares, across the four dependency fields. */
function declaredDependencies(manifest: PackageManifest): string[] {
	return [
		...Object.keys(manifest.dependencies ?? {}),
		...Object.keys(manifest.devDependencies ?? {}),
		...Object.keys(manifest.peerDependencies ?? {}),
		...Object.keys(manifest.optionalDependencies ?? {}),
	];
}

/**
 * The project's workspaces in path order. A directory a pattern reaches without a
 * `package.json` is left out, as package managers leave it out; `!pattern` entries exclude.
 *
 * @param root - The directory holding the root `package.json`, inside a git repository
 */
export async function loadWorkspaces(root: string): Promise<Result<Workspace[], Error>> {
	let rootManifest = await readManifest(join(root, "package.json"));
	if (isFailure(rootManifest)) return rootManifest;
	let included = new Set<string>();
	let excluded = new Set<string>();
	for (let pattern of patternsOf(rootManifest.data)) {
		let negated = pattern.startsWith("!");
		let target = negated ? excluded : included;
		for (let path of await expand(root, negated ? pattern.slice(1) : pattern)) target.add(path);
	}
	let paths = [...included].filter((path) => !excluded.has(path) && path !== "").sort();
	let manifests = new Map<string, PackageManifest>();
	for (let path of paths) {
		let manifest = await readManifest(join(root, path, "package.json"));
		if (isFailure(manifest)) continue;
		manifests.set(path, manifest.data);
	}
	let tracked = await trackedFiles(root);
	let files = isFailure(tracked) ? [] : tracked.data;
	return success(buildWorkspaces(root, manifests, files));
}

/** Workspaces with their graph and files, from each one's manifest and the repository's files. */
function buildWorkspaces(
	root: string,
	manifests: ReadonlyMap<string, PackageManifest>,
	files: readonly string[],
): Workspace[] {
	let nameOf = new Map([...manifests].map(([path, manifest]) => [path, manifest.name ?? path]));
	let names = new Set(nameOf.values());
	let direct = new Map<string, string[]>();
	for (let [path, manifest] of manifests) {
		let name = nameOf.get(path) ?? path;
		direct.set(
			name,
			[...new Set(declaredDependencies(manifest))].filter(
				(dependency) => names.has(dependency) && dependency !== name,
			),
		);
	}
	let owned = partitionFiles([...manifests.keys()], files);
	let workspaces: Workspace[] = [];
	for (let [path, manifest] of manifests) {
		let name = nameOf.get(path) ?? path;
		let own = owned.get(path) ?? [];
		let relative = own.map((file) => file.slice(path.length + 1));
		let workspace: Workspace = {
			name,
			path,
			absolute: join(root, path),
			manifest,
			dependencies: direct.get(name) ?? [],
			dependents: dependentsOf(name, direct),
			files: async () => own,
			has: (glob) => {
				let matcher = fileGlob(glob);
				return relative.some((file) => matcher.test(file));
			},
		};
		MADE.add(workspace);
		workspaces.push(workspace);
	}
	return workspaces;
}

/** Each file assigned to the deepest workspace containing it; files outside every workspace drop. */
function partitionFiles(paths: readonly string[], files: readonly string[]): Map<string, string[]> {
	let deepestFirst = [...paths].sort((a, b) => b.length - a.length);
	let owned = new Map<string, string[]>(paths.map((path) => [path, []]));
	for (let file of files) {
		let owner = deepestFirst.find((path) => file.startsWith(`${path}/`));
		if (owner !== undefined) owned.get(owner)?.push(file);
	}
	return owned;
}

/** Every workspace that reaches `name` through dependencies, in name order. */
function dependentsOf(name: string, direct: ReadonlyMap<string, readonly string[]>): string[] {
	let found = new Set<string>();
	let queue = [name];
	while (queue.length > 0) {
		let current = queue.shift();
		for (let [candidate, dependencies] of direct) {
			if (current !== undefined && dependencies.includes(current) && !found.has(candidate)) {
				found.add(candidate);
				queue.push(candidate);
			}
		}
	}
	found.delete(name);
	return [...found].sort();
}

/** Every workspace `name` depends on, directly or through others. */
export function transitiveDependencies(name: string, workspaces: readonly Workspace[]): string[] {
	let byName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
	let found = new Set<string>();
	let queue = [...(byName.get(name)?.dependencies ?? [])];
	while (queue.length > 0) {
		let current = queue.shift();
		if (current === undefined || found.has(current)) continue;
		found.add(current);
		queue.push(...(byName.get(current)?.dependencies ?? []));
	}
	return [...found].sort();
}
