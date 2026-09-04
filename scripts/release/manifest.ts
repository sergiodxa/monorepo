/**
 * The manifest a package publishes with, generated from its workspace manifest at release
 * time: export and bin targets move from `src/*.ts` to `dist/*.js`, `workspace:` ranges become
 * the exact versions shipping alongside, and the registry-only fields are stamped in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExportTarget, Package, PackageManifest } from "./workspace.js";

import { TYPESCRIPT_TARGET, collectExportTargets } from "./workspace.js";

/** Fields that describe the workspace copy and mean nothing to a consumer installing from npm. */
const WORKSPACE_ONLY_FIELDS = new Set(["private", "scripts", "devDependencies"]);

/** A TypeScript target under `src/`, its path captured for the matching `dist/` location. */
const SOURCE_TARGET = /^\.\/src\/(.+)\.tsx?$/;

const WORKSPACE_RANGE = "workspace:";

/** Where a published package says it lives; npm checks it against the trusted publisher. */
export interface PublishRepository {
	url: string;
	directory: string;
}

export interface PublishOptions {
	version: string;
	pins: Record<string, string>;
	gitHead: string;
	repository: PublishRepository;
}

/**
 * The manifest to publish for `pkg`: a new object, so the workspace manifest is untouched.
 * Throws when a target is TypeScript outside `src/`, when a workspace dependency has no pin,
 * or when anything workspace-only would survive into the registry copy.
 */
export function publishManifest(pkg: Package, options: PublishOptions): PackageManifest {
	let source = pkg.manifest;
	let output: PackageManifest = { name: source.name, version: options.version };
	for (let [field, value] of Object.entries(source)) {
		if (field === "name" || field === "version" || WORKSPACE_ONLY_FIELDS.has(field)) continue;
		output[field] = value;
	}
	if (source.exports !== undefined) output.exports = rewriteExports(source.exports);
	if (source.bin !== undefined) output.bin = rewriteBin(source.bin);
	if (source.dependencies !== undefined) {
		output.dependencies = pinDependencies(pkg.name, source.dependencies, options.pins);
	}
	output.gitHead = options.gitHead;
	output.publishConfig = { access: "public" };
	output.repository = {
		type: "git",
		url: options.repository.url,
		directory: options.repository.directory,
	};
	assertPublishable(pkg.name, output);
	return output;
}

/**
 * The published location of one target: `./src/X.ts(x)` becomes `./dist/X.js`, a `*` pattern
 * moving along with it, and anything that is not TypeScript passes through for copying.
 * Throws for TypeScript outside `src/`, which the build never emits.
 */
export function rewriteTarget(target: string): string {
	if (SOURCE_TARGET.test(target)) return target.replace(SOURCE_TARGET, "./dist/$1.js");
	if (TYPESCRIPT_TARGET.test(target)) {
		throw new Error(
			`Export target ${target} is TypeScript outside ./src/, where the build emits from`,
		);
	}
	return target;
}

/** The export and bin targets the build copies verbatim into the staged package. */
export function nonTypeScriptTargets(manifest: PackageManifest): string[] {
	return collectExportTargets(manifest).filter((target) => !TYPESCRIPT_TARGET.test(target));
}

function rewriteExports(entry: ExportTarget): ExportTarget {
	if (entry === null) return null;
	if (typeof entry === "string") return rewriteTarget(entry);
	if (Array.isArray(entry)) return entry.map((item) => rewriteExports(item));
	return Object.fromEntries(
		Object.entries(entry).map(([key, item]) => [key, rewriteExports(item)]),
	);
}

/**
 * `bin` targets in npm's canonical form, without the `./` npm strips at publish time (with a
 * warning that reads as an error), after the same `src` → `dist` rewrite an export gets.
 */
function rewriteBin(bin: string | Record<string, string>): string | Record<string, string> {
	if (typeof bin === "string") return binTarget(bin);
	return Object.fromEntries(
		Object.entries(bin).map(([command, target]) => [command, binTarget(target)]),
	);
}

function binTarget(target: string): string {
	let built = rewriteTarget(target);
	return built.startsWith("./") ? built.slice(2) : built;
}

/** Workspace ranges become their exact pins; every external range is published as written. */
function pinDependencies(
	name: string,
	dependencies: Record<string, string>,
	pins: Record<string, string>,
): Record<string, string> {
	let pinned: Record<string, string> = {};
	for (let [dependency, range] of Object.entries(dependencies)) {
		if (!range.startsWith(WORKSPACE_RANGE)) {
			pinned[dependency] = range;
			continue;
		}
		let pin = pins[dependency];
		if (pin === undefined) {
			throw new Error(
				`${name} depends on ${dependency} through the workspace and no version was pinned for it`,
			);
		}
		pinned[dependency] = pin;
	}
	return pinned;
}

/**
 * The last line of defence before the registry: a surviving `private` makes npm refuse the
 * publish, and a surviving `workspace:` range makes every consumer's install fail.
 */
function assertPublishable(name: string, manifest: PackageManifest): void {
	if ("private" in manifest) throw new Error(`${name} would publish with a private field`);
	if (JSON.stringify(manifest).includes(WORKSPACE_RANGE)) {
		throw new Error(`${name} would publish with a workspace: range`);
	}
}
