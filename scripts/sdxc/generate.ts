#!/usr/bin/env bun
/**
 * `bun run sdxc:generate`: rewrites the kit's JSON schemas, then the committed `sdxc` umbrella
 * (every re-export module and the manifest's `exports` and dependencies), and deletes generated
 * files no subpath backs any more. Re-run it after adding a package, an export subpath or a
 * configuration key; the drift test fails until the regeneration is committed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, match, success, wrap } from "@sdxc/result";

import type { PackageManifest } from "../release/workspace.js";

import { REPO_ROOT } from "../release/workspace.js";

import {
	KIT_DIR,
	UMBRELLA_DIR,
	generateKitSchemas,
	generateUmbrella,
	umbrellaManifest,
	umbrellaSources,
} from "./umbrella.js";

/**
 * Writes the kit's schemas and then the umbrella, which copies them, and answers a one-line
 * summary of what changed.
 */
async function main(): Promise<Result<string, Error>> {
	let schemas = generateKitSchemas();
	if (isFailure(schemas)) return schemas;
	let kitDir = join(REPO_ROOT, "packages", KIT_DIR);
	let schemasWritten = await wrap(async () => {
		for (let [path, content] of schemas.data) await writeFile(join(kitDir, path), content);
	});
	if (isFailure(schemasWritten)) return schemasWritten;
	let umbrella = await generateUmbrella(REPO_ROOT);
	if (isFailure(umbrella)) return umbrella;
	let packageDir = join(REPO_ROOT, "packages", UMBRELLA_DIR);
	let manifestPath = join(packageDir, "package.json");
	let manifest = await wrap(
		async () => JSON.parse(await readFile(manifestPath, "utf8")) as PackageManifest,
	);
	if (isFailure(manifest)) return manifest;
	let written = await wrap(async () => {
		for (let [path, content] of umbrella.data.files) {
			await mkdir(dirname(join(packageDir, path)), { recursive: true });
			await writeFile(join(packageDir, path), content);
		}
		let next = umbrellaManifest(manifest.data, umbrella.data);
		await writeFile(manifestPath, `${JSON.stringify(next, null, "\t")}\n`);
	});
	if (isFailure(written)) return written;
	let removed = await wrap(async () => {
		let sources = await umbrellaSources(packageDir);
		let stale = sources.filter((path) => !umbrella.data.files.has(path));
		for (let path of stale) await rm(join(packageDir, path));
		await pruneEmptyDirectories(join(packageDir, "src"));
		return stale.length;
	});
	if (isFailure(removed)) return removed;
	let formatted = spawnSync(
		"bunx",
		[
			"vp",
			"fmt",
			relative(REPO_ROOT, manifestPath),
			...[...schemas.data.keys()].map((path) => `packages/${KIT_DIR}/${path}`),
			...[...umbrella.data.files.keys()]
				.filter((path) => path.endsWith(".json"))
				.map((path) => `packages/${UMBRELLA_DIR}/${path}`),
		],
		{ cwd: REPO_ROOT, stdio: "inherit" },
	);
	if (formatted.status !== 0) return failure(new Error("vp fmt failed on the generated JSON"));
	return success(
		`Wrote ${umbrella.data.files.size} files for ${umbrella.data.dependencies.length} packages; removed ${removed.data}.`,
	);
}

/** Removes every directory under `dir` that holds no file, deepest first, keeping `dir` itself. */
async function pruneEmptyDirectories(dir: string): Promise<void> {
	let entries = await readdir(dir, { withFileTypes: true });
	for (let entry of entries) {
		if (!entry.isDirectory()) continue;
		let path = join(dir, entry.name);
		await pruneEmptyDirectories(path);
		if ((await readdir(path)).length === 0) await rmdir(path);
	}
}

match(await main(), {
	success: (report) => {
		process.stdout.write(`${report}\n`);
	},
	failure: (error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	},
});
