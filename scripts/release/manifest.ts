/**
 * The manifest a package publishes with, generated from its workspace manifest at release
 * time: export and bin targets move from `src/*.ts` to `dist/*.js`, `workspace:` ranges become
 * the exact versions shipping alongside, and the registry-only fields are stamped in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

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
 * A TypeScript target outside `src/`, a workspace dependency without a pin, and anything
 * workspace-only that would survive into the registry copy are each a failure.
 */
export function publishManifest(
	pkg: Package,
	options: PublishOptions,
): Result<PackageManifest, Error> {
	let source = pkg.manifest;
	let output: PackageManifest = { name: source.name, version: options.version };
	for (let [field, value] of Object.entries(source)) {
		if (field === "name" || field === "version" || WORKSPACE_ONLY_FIELDS.has(field)) continue;
		output[field] = value;
	}
	if (source.exports !== undefined) {
		let rewritten = rewriteExports(source.exports);
		if (isFailure(rewritten)) return rewritten;
		output.exports = rewritten.data;
	}
	if (source.bin !== undefined) {
		let bin = rewriteBin(source.bin);
		if (isFailure(bin)) return bin;
		output.bin = bin.data;
	}
	if (source.dependencies !== undefined) {
		let dependencies = pinDependencies(pkg.name, source.dependencies, options.pins);
		if (isFailure(dependencies)) return dependencies;
		output.dependencies = dependencies.data;
	}
	output.gitHead = options.gitHead;
	output.publishConfig = { access: "public" };
	output.repository = {
		type: "git",
		url: options.repository.url,
		directory: options.repository.directory,
	};
	return checkPublishable(pkg.name, output);
}

/**
 * The published location of one target: `./src/X.ts(x)` becomes `./dist/X.js`, a `*` pattern
 * moving along with it, and anything that is not TypeScript passes through for copying.
 * TypeScript outside `src/` is a failure, since the build only ever emits from there.
 */
export function rewriteTarget(target: string): Result<string, Error> {
	if (SOURCE_TARGET.test(target)) return success(target.replace(SOURCE_TARGET, "./dist/$1.js"));
	if (TYPESCRIPT_TARGET.test(target)) {
		return failure(
			new Error(`Export target ${target} is TypeScript outside ./src/, where the build emits from`),
		);
	}
	return success(target);
}

/** The export and bin targets the build copies verbatim into the staged package. */
export function nonTypeScriptTargets(manifest: PackageManifest): string[] {
	return collectExportTargets(manifest).filter((target) => !TYPESCRIPT_TARGET.test(target));
}

/** `exports` with every string target rewritten, the first refused target ending the walk. */
function rewriteExports(entry: ExportTarget): Result<ExportTarget, Error> {
	if (entry === null) return success(null);
	if (typeof entry === "string") return rewriteTarget(entry);
	if (Array.isArray(entry)) {
		let items: ExportTarget[] = [];
		for (let item of entry) {
			let rewritten = rewriteExports(item);
			if (isFailure(rewritten)) return rewritten;
			items.push(rewritten.data);
		}
		return success(items);
	}
	let map: Record<string, ExportTarget> = {};
	for (let [key, item] of Object.entries(entry)) {
		let rewritten = rewriteExports(item);
		if (isFailure(rewritten)) return rewritten;
		map[key] = rewritten.data;
	}
	return success(map);
}

/**
 * `bin` targets in npm's canonical form, without the `./` npm strips at publish time (with a
 * warning that reads as an error), after the same `src` → `dist` rewrite an export gets.
 */
function rewriteBin(
	bin: string | Record<string, string>,
): Result<string | Record<string, string>, Error> {
	if (typeof bin === "string") return binTarget(bin);
	let commands: Record<string, string> = {};
	for (let [command, target] of Object.entries(bin)) {
		let built = binTarget(target);
		if (isFailure(built)) return built;
		commands[command] = built.data;
	}
	return success(commands);
}

function binTarget(target: string): Result<string, Error> {
	let built = rewriteTarget(target);
	if (isFailure(built)) return built;
	return success(built.data.startsWith("./") ? built.data.slice(2) : built.data);
}

/** Workspace ranges become their exact pins; every external range is published as written. */
function pinDependencies(
	name: string,
	dependencies: Record<string, string>,
	pins: Record<string, string>,
): Result<Record<string, string>, Error> {
	let pinned: Record<string, string> = {};
	for (let [dependency, range] of Object.entries(dependencies)) {
		if (!range.startsWith(WORKSPACE_RANGE)) {
			pinned[dependency] = range;
			continue;
		}
		let pin = pins[dependency];
		if (pin === undefined) {
			return failure(
				new Error(
					`${name} depends on ${dependency} through the workspace and no version was pinned for it`,
				),
			);
		}
		pinned[dependency] = pin;
	}
	return success(pinned);
}

/**
 * The last line of defence before the registry: a surviving `private` makes npm refuse the
 * publish, and a surviving `workspace:` range makes every consumer's install fail.
 */
function checkPublishable(name: string, manifest: PackageManifest): Result<PackageManifest, Error> {
	if ("private" in manifest)
		return failure(new Error(`${name} would publish with a private field`));
	if (JSON.stringify(manifest).includes(WORKSPACE_RANGE)) {
		return failure(new Error(`${name} would publish with a workspace: range`));
	}
	return success(manifest);
}
