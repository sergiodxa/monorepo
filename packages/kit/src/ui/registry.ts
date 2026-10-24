/**
 * The component registry the installed `@sdxc/kit` carries in `registry/ui/`, written by its release
 * build: every `@sdxc/ui` component with its source already importing `@sdxc/ui/*`. Reading it from
 * the package itself keeps each copy matched to the helpers installed beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { failure, isFailure, success, wrap } from "@sdxc/result";

/** Where the registry sits inside the `@sdxc/kit` package. */
export const REGISTRY_DIR = "registry/ui";

/** A file the registry ships, named as its copy is named in the app: one path segment. */
const REGISTRY_FILE = s.object({
	path: s.string().pipe(checks.pattern(/^[a-z0-9][a-z0-9-]*(?:(?:\.browser)?\.test)?\.tsx?$/)),
	content: s.string(),
});

/** One `registry/ui/<name>.json`. */
export const REGISTRY_ENTRY = s.object({
	name: s.string().pipe(checks.pattern(/^[a-z0-9][a-z0-9-]*$/)),
	changedIn: s.string(),
	dependencies: s.array(s.string()),
	exports: s.array(s.string()),
	source: REGISTRY_FILE,
	test: s.nullable(REGISTRY_FILE),
});

/** A component as the installed release ships it. */
export type RegistryEntry = s.InferOutput<typeof REGISTRY_ENTRY>;

/** The installed release's components, by name, and the release they belong to. */
export interface Registry {
	release: string;
	entries: Map<string, RegistryEntry>;
}

/**
 * The registry of the `@sdxc/kit` package at `packageRoot`, with the version its `package.json`
 * declares. A package without `registry/ui` is a failure: the registry exists only in a
 * published release.
 */
export async function readRegistry(packageRoot: string): Promise<Result<Registry, Error>> {
	let manifest = await wrap(
		async () =>
			JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
				version?: unknown;
			},
	);
	if (isFailure(manifest)) return manifest;
	let release = manifest.data.version;
	if (typeof release !== "string") {
		return failure(new Error(`${join(packageRoot, "package.json")} declares no version`));
	}
	let dir = join(packageRoot, REGISTRY_DIR);
	let files = await wrap(() => readdir(dir));
	if (isFailure(files)) {
		return failure(
			new Error(
				`This @sdxc/kit has no component registry at ${dir}; sdxc ui reads it from a published @sdxc/kit release`,
			),
		);
	}
	let entries = new Map<string, RegistryEntry>();
	for (let file of files.data.filter((name) => name.endsWith(".json")).sort()) {
		let text = await wrap(() => readFile(join(dir, file), "utf8"));
		if (isFailure(text)) return text;
		let value = wrap(() => JSON.parse(text.data) as unknown);
		if (isFailure(value)) return failure(new Error(`${REGISTRY_DIR}/${file}: not valid JSON`));
		let entry = s.parseSafe(REGISTRY_ENTRY, value.data);
		if (!entry.success || `${entry.value.name}.json` !== file) {
			return failure(new Error(`${REGISTRY_DIR}/${file} is not a registry entry`));
		}
		entries.set(entry.value.name, entry.value);
	}
	return success({ release, entries });
}

/**
 * `names` and every component they reach through other components, transitively, in the order
 * first reached. A name the registry does not hold is skipped here; callers check names first.
 */
export function withDependencies(registry: Registry, names: readonly string[]): string[] {
	let reached: string[] = [];
	let pending = [...names];
	while (pending.length > 0) {
		let name = pending.shift() ?? "";
		if (reached.includes(name)) continue;
		let entry = registry.entries.get(name);
		if (entry === undefined) continue;
		reached.push(name);
		pending.push(...entry.dependencies);
	}
	return reached;
}
