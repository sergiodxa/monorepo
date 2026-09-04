/**
 * The workspace as the release tooling sees it: every `packages/*` manifest read into a
 * `Package` carrying the paths it ships and the `@sdxc/*` packages it depends on, plus the
 * graph walks a release needs — private reachability, dependent closure, topological order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

/** Repo root, resolved from this file so every command targets the same tree from any cwd. */
export const REPO_ROOT = resolve(import.meta.dirname, "../..");

/** The npm scope every workspace package publishes under; dependencies in it are internal. */
export const WORKSPACE_SCOPE = "@sdxc/";

/** The repository on GitHub, for release links. */
export const REPOSITORY_PAGE = "https://github.com/sergiodxa/monorepo";

/** The `repository.url` every publish manifest carries; the registry matches it to the OIDC claims. */
export const REPOSITORY_URL = "git+https://github.com/sergiodxa/monorepo.git";

/** The trusted-publisher entry every public package needs on npmjs.com, as the operator types it. */
export const TRUSTED_PUBLISHER =
	"GitHub Actions, organization sergiodxa, repository monorepo, workflow release.yml";

/** Targets the build emits from `src/` into `dist/`; every other target ships as a copy. */
export const TYPESCRIPT_TARGET = /\.tsx?$/;

/**
 * Files beside the sources that shape what a consumer receives — the manifest, the build
 * config the emit reads, and the two documents npm displays — so a change to any is a release.
 */
const SHIPPED_FILES = ["package.json", "tsconfig.json", "README.md", "LICENSE.md"];

/**
 * One `exports` entry: a path, a subpath or condition map, a fallback array, or `null` to
 * block a subpath.
 */
export type ExportTarget = string | null | ExportTarget[] | { [key: string]: ExportTarget };

/** The `repository` field npm validates against the OIDC claims of a trusted publisher. */
export interface Repository {
	type: string;
	url: string;
	directory?: string;
}

/** The `package.json` fields the release reads or rewrites; every other field passes through. */
export interface PackageManifest {
	name: string;
	version?: string;
	description?: string;
	private?: boolean;
	license?: string;
	type?: string;
	bin?: string | Record<string, string>;
	exports?: ExportTarget;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	publishConfig?: Record<string, unknown>;
	repository?: Repository;
	gitHead?: string;
	[field: string]: unknown;
}

/**
 * What the graph walks need from a package: its visibility and the internal packages it
 * depends on at runtime. `dependencies` holds names from `dependencies` only, because a
 * devDependency never reaches a consumer and so never cascades a release.
 */
export interface DependencyNode {
	name: string;
	isPrivate: boolean;
	dependencies: string[];
}

/**
 * A workspace package with what a release needs to know about it. `shippedPaths` are the
 * repo-relative inputs a consumer can observe a change to: sources, the manifest, the build
 * config, the two documents npm displays, and every export target that ships as a verbatim copy.
 */
export interface Package extends DependencyNode {
	dir: string;
	manifest: PackageManifest;
	shippedPaths: string[];
}

/** A private package a public one reaches, with the intermediate packages on the shortest path. */
export interface PrivateDependency {
	package: string;
	dependency: string;
	via: string[];
}

/**
 * Every `packages/<dir>/package.json` under `root` as a `Package`, sorted by directory so
 * plans and tables come out in a stable order. A directory without a manifest is skipped; a
 * manifest that cannot be read or parsed is a failure naming its path.
 */
export async function readPackages(root: string): Promise<Result<Package[], Error>> {
	let packagesDir = join(root, "packages");
	let entries = await wrap(() => readdir(packagesDir, { withFileTypes: true }));
	if (isFailure(entries)) return entries;
	let directories = entries.data
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	let read = await Promise.all(directories.map((dir) => readPackage(packagesDir, dir)));
	let packages: Package[] = [];
	for (let pkg of read) {
		if (isFailure(pkg)) return pkg;
		if (pkg.data !== null) packages.push(pkg.data);
	}
	return success(packages);
}

/**
 * Derives a `Package` from its manifest alone, so fixtures and the repo scan share one
 * definition of visibility, internal dependencies and shipped paths.
 */
export function packageFromManifest(dir: string, manifest: PackageManifest): Package {
	let base = posix.join("packages", dir);
	let shippedPaths = new Set([
		posix.join(base, "src"),
		...SHIPPED_FILES.map((file) => posix.join(base, file)),
	]);
	for (let target of collectExportTargets(manifest)) {
		if (!TYPESCRIPT_TARGET.test(target)) shippedPaths.add(posix.join(base, target));
	}
	return {
		dir,
		name: manifest.name,
		manifest,
		isPrivate: manifest.private === true,
		dependencies: Object.keys(manifest.dependencies ?? {}).filter((name) =>
			name.startsWith(WORKSPACE_SCOPE),
		),
		shippedPaths: [...shippedPaths],
	};
}

/**
 * Every private package `pkg` reaches through runtime dependencies, each with the chain that
 * reaches it, so the message shows the fix: open the private package or close the public
 * one. Breadth-first, so `via` is the shortest chain.
 */
export function privateDependencies(
	pkg: DependencyNode,
	packages: DependencyNode[],
): PrivateDependency[] {
	let byName = new Map(packages.map((node) => [node.name, node]));
	let rows: PrivateDependency[] = [];
	let seen = new Set([pkg.name]);
	let queue: Array<{ name: string; via: string[] }> = pkg.dependencies.map((name) => ({
		name,
		via: [],
	}));
	for (let index = 0; index < queue.length; index += 1) {
		let entry = queue[index];
		if (entry === undefined || seen.has(entry.name)) continue;
		seen.add(entry.name);
		let node = byName.get(entry.name);
		if (node === undefined) continue;
		if (node.isPrivate) rows.push({ package: pkg.name, dependency: entry.name, via: entry.via });
		for (let next of node.dependencies) queue.push({ name: next, via: [...entry.via, entry.name] });
	}
	return rows;
}

/** One line per offence, naming the chain when the private package is reached indirectly. */
export function formatPrivateDependency(row: PrivateDependency): string {
	let chain = row.via.length > 0 ? ` (via ${row.via.join(" → ")})` : "";
	return `${row.package} depends on private ${row.dependency}${chain}`;
}

/**
 * `names` plus every public package that depends on one of them, transitively, through
 * runtime dependencies. Private packages never enter the set, seeds included.
 */
export function closeOverDependents(
	names: Iterable<string>,
	packages: DependencyNode[],
): Set<string> {
	let publicNames = new Set(packages.filter((node) => !node.isPrivate).map((node) => node.name));
	let dependents = new Map<string, string[]>();
	for (let node of packages) {
		if (node.isPrivate) continue;
		for (let dependency of node.dependencies) {
			dependents.set(dependency, [...(dependents.get(dependency) ?? []), node.name]);
		}
	}
	let closed = new Set<string>();
	let queue = [...names].filter((name) => publicNames.has(name));
	for (let index = 0; index < queue.length; index += 1) {
		let name = queue[index];
		if (name === undefined || closed.has(name)) continue;
		closed.add(name);
		queue.push(...(dependents.get(name) ?? []));
	}
	return closed;
}

/**
 * `names` ordered so every member comes after the members it depends on; edges to packages
 * outside `names` are ignored. Members that depend on each other in a loop are a failure
 * naming the cycle, since no publish order could satisfy them.
 */
export function topologicalOrder(
	names: Iterable<string>,
	packages: DependencyNode[],
): Result<string[], Error> {
	let members = new Set(names);
	let byName = new Map(packages.map((node) => [node.name, node]));
	let order: string[] = [];
	let done = new Set<string>();
	let path: string[] = [];

	/** Places `name` after its member dependencies; answers the cycle's path when the walk meets `name` again. */
	function visit(name: string): string[] | null {
		if (done.has(name)) return null;
		let start = path.indexOf(name);
		if (start !== -1) return [...path.slice(start), name];
		path.push(name);
		for (let dependency of byName.get(name)?.dependencies ?? []) {
			if (!members.has(dependency)) continue;
			let cycle = visit(dependency);
			if (cycle !== null) return cycle;
		}
		path.pop();
		done.add(name);
		order.push(name);
		return null;
	}

	for (let name of [...members].sort()) {
		let cycle = visit(name);
		if (cycle !== null) return failure(new Error(`Dependency cycle: ${cycle.join(" -> ")}`));
	}
	return success(order);
}

/**
 * Every string target under `exports` and `bin`, in document order and without duplicates:
 * subpath and condition maps are recursed, fallback arrays flattened, `null` blocks skipped,
 * and `*` patterns kept verbatim for the caller to interpret.
 */
export function collectExportTargets(manifest: PackageManifest): string[] {
	let targets = new Set<string>();
	collectTargets(manifest.exports, targets);
	if (typeof manifest.bin === "string") targets.add(manifest.bin);
	else if (manifest.bin !== undefined) {
		for (let target of Object.values(manifest.bin)) targets.add(target);
	}
	return [...targets];
}

function collectTargets(entry: ExportTarget | undefined, targets: Set<string>): void {
	if (entry === undefined || entry === null) return;
	if (typeof entry === "string") {
		targets.add(entry);
		return;
	}
	if (Array.isArray(entry)) {
		for (let item of entry) collectTargets(item, targets);
		return;
	}
	for (let item of Object.values(entry)) collectTargets(item, targets);
}

/**
 * The package in `packages/<dir>`, or `null` when the directory holds no manifest. Any other
 * trouble reading or parsing the manifest is a failure that names the file.
 */
async function readPackage(
	packagesDir: string,
	dir: string,
): Promise<Result<Package | null, Error>> {
	let path = join(packagesDir, dir, "package.json");
	let manifest = await wrap(
		async () => JSON.parse(await readFile(path, "utf8")) as PackageManifest,
	);
	if (isFailure(manifest)) {
		if (isMissingFile(manifest.error)) return success(null);
		return failure(new Error(`${path}: ${manifest.error.message}`));
	}
	return success(packageFromManifest(dir, manifest.data));
}

function isMissingFile(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
