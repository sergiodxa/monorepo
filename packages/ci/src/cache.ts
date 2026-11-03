/**
 * Step caching: a pass is stored under a key built from what the step runs, the contents of its
 * inputs, the environment it names and the platform it ran on, so a later run whose inputs are
 * unchanged reuses the pass instead of running the step again. Only passes are ever stored, and
 * a pass nobody reused for a month is pruned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { inputFiles } from "./git.js";

/** How long a pass is kept without a run reusing it: 30 days. */
export const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

/** What a key is built from. */
export interface CacheKeyInput {
	/** The step's address and what it runs: the command, or a function's source. */
	identity: string;
	/** Git pathspec globs whose contents form the key. */
	inputs: readonly string[];
	/** Environment variable names whose values form the key. */
	env: readonly string[];
}

/** A stored pass. */
export interface CacheEntry {
	duration: number;
	output: string;
	/** Hashes of the declared outputs as the step left them. */
	outputs: Record<string, string>;
}

/** sha256 of `text` as hex. */
function sha256(text: string | Uint8Array): string {
	return createHash("sha256").update(text).digest("hex");
}

/** The hash of one file read from disk, or a marker when it no longer exists. */
async function hashFile(path: string): Promise<string> {
	let content = await wrap(() => readFile(path));
	return isFailure(content) ? "deleted" : sha256(content.data);
}

/**
 * The key a step's pass is stored under; it changes whenever a byte of an input, a listed
 * variable, the OS, the CPU architecture, or the Node or Bun version changes.
 *
 * @param root - The repository root the inputs are relative to
 * @param env - The environment the step runs with
 */
export async function cacheKey(
	root: string,
	input: CacheKeyInput,
	env: Readonly<Record<string, string | undefined>>,
): Promise<Result<string, Error>> {
	let files = await inputFiles(root, input.inputs);
	if (isFailure(files)) return files;
	let hash = createHash("sha256");
	hash.update(
		JSON.stringify([
			input.identity,
			platform(),
			arch(),
			process.versions.node,
			process.versions.bun ?? "",
		]),
	);
	for (let name of [...input.env].sort()) hash.update(`\0env:${name}=${env[name] ?? ""}`);
	for (let path of [...files.data.keys()].sort()) {
		let object = files.data.get(path) ?? (await hashFile(join(root, path)));
		hash.update(`\0file:${path}=${object}`);
	}
	return success(hash.digest("hex"));
}

/** Hashes of every file under each declared output path, keyed by the path as declared. */
export async function hashOutputs(
	root: string,
	outputs: readonly string[],
): Promise<Record<string, string>> {
	let hashes: Record<string, string> = {};
	for (let output of outputs) hashes[output] = await hashTree(join(root, output));
	return hashes;
}

/** One hash over a file, or over every file below a directory in path order. */
async function hashTree(path: string): Promise<string> {
	let info = await wrap(() => stat(path));
	if (isFailure(info)) return "missing";
	if (!info.data.isDirectory()) return hashFile(path);
	let listed = await wrap(() => readdir(path, { recursive: true, withFileTypes: true }));
	if (isFailure(listed)) return "missing";
	let hash = createHash("sha256");
	let files = listed.data
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
	for (let file of files) hash.update(`${file.slice(path.length)}=${await hashFile(file)}\0`);
	return hash.digest("hex");
}

/** Where passes are stored: below the clone's shared git directory, shared by its worktrees. */
export function cacheDirectory(gitDirectory: string): string {
	return join(gitDirectory, "sdxc-ci", "cache");
}

/**
 * The pass stored under `key`, when its declared outputs still hold what the step left;
 * `null` when there is none or an output changed. A hit refreshes the entry's modification
 * time, so `pruneCache` measures age from the last run that reused it.
 */
export async function readCache(
	root: string,
	directory: string,
	key: string,
): Promise<CacheEntry | null> {
	let text = await wrap(() => readFile(join(directory, `${key}.json`), "utf8"));
	if (isFailure(text)) return null;
	let entry = wrap((): CacheEntry => JSON.parse(text.data) as CacheEntry);
	if (isFailure(entry)) return null;
	let now = await hashOutputs(root, Object.keys(entry.data.outputs));
	let unchanged = Object.entries(entry.data.outputs).every(([path, hash]) => now[path] === hash);
	if (!unchanged) return null;
	let touched = new Date();
	await wrap(() => utimes(join(directory, `${key}.json`), touched, touched));
	return entry.data;
}

/** Stores a pass under `key`. */
export async function writeCache(
	directory: string,
	key: string,
	entry: CacheEntry,
): Promise<Result<void, Error>> {
	let made = await wrap(() => mkdir(directory, { recursive: true }));
	if (isFailure(made)) return failure(made.error);
	let written = await wrap(() => writeFile(join(directory, `${key}.json`), JSON.stringify(entry)));
	if (isFailure(written)) return failure(written.error);
	return success(undefined);
}

/**
 * Removes every pass last written or reused more than `maxAge` milliseconds before `now`, so the
 * cache holds what recent runs need instead of every input state ever seen. A missing directory
 * prunes nothing; an entry that cannot be read or removed is left for the next prune.
 *
 * @returns How many entries were removed
 */
export async function pruneCache(
	directory: string,
	maxAge: number = CACHE_MAX_AGE,
	now: number = Date.now(),
): Promise<number> {
	let listed = await wrap(() => readdir(directory));
	if (isFailure(listed)) return 0;
	let removed = 0;
	for (let name of listed.data) {
		if (!name.endsWith(".json")) continue;
		let path = join(directory, name);
		let info = await wrap(() => stat(path));
		if (isFailure(info) || now - info.data.mtimeMs <= maxAge) continue;
		let gone = await wrap(() => rm(path, { force: true }));
		if (!isFailure(gone)) removed += 1;
	}
	return removed;
}
