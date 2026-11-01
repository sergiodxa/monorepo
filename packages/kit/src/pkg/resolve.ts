/**
 * How `sdxc pkg <name>` turns a typed name into a command: the package it names (or the one a
 * typo most likely meant), the copy installed at or above the working directory when there is
 * one, and otherwise `bunx`, or `npx` without Bun, downloading the published package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";

import { closest } from "@sdxc/cli";
import { isSuccess, wrap } from "@sdxc/result";

import { PACKAGE_COMMAND_LINES, PACKAGES_WITHOUT_COMMAND_LINES } from "./catalog.js";

/** Where a request for a package's command line is posted, with the package in the title. */
export const REQUEST_URL = "https://github.com/sergiodxa/monorepo/discussions/new?category=ideas";

/** What a typed name refers to. */
export type PackageLookup =
	| { kind: "command-line"; name: string }
	| { kind: "without-command-line"; name: string }
	| { kind: "unknown"; name: string; suggestion: string | undefined };

/**
 * The package `input` names. The package name, its `@sdxc/` specifier and its `sdxc-` binary
 * name all resolve, so pasting any of the three works; any other name is unknown, with the
 * nearest name that has a command line as its suggestion.
 *
 * @example lookupPackage("@sdxc/uuid") // { kind: "command-line", name: "uuid" }
 * @example lookupPackage("uiid") // { kind: "unknown", name: "uiid", suggestion: "uuid" }
 */
export function lookupPackage(input: string): PackageLookup {
	let name = input
		.trim()
		.toLowerCase()
		.replace(/^@sdxc\//, "")
		.replace(/^sdxc-/, "");
	if (Object.hasOwn(PACKAGE_COMMAND_LINES, name)) return { kind: "command-line", name };
	if (PACKAGES_WITHOUT_COMMAND_LINES.includes(name)) return { kind: "without-command-line", name };
	return { kind: "unknown", name, suggestion: closest(name, Object.keys(PACKAGE_COMMAND_LINES)) };
}

/**
 * The link that opens a request for `name`'s command line in the Ideas discussions, titled
 * with the package alone so nothing else from the command line leaves the machine.
 */
export function requestURL(name: string): string {
	return `${REQUEST_URL}&title=${encodeURIComponent(`Command line for @sdxc/${name}`)}`;
}

/** The fields of a `package.json` the lookup reads. */
interface Manifest {
	name?: string;
	bin?: string | Record<string, string>;
	workspaces?: string[] | { packages?: string[] };
}

/** The `package.json` in `dir`, or `null` when it is missing or unreadable. */
async function manifestIn(dir: string): Promise<Manifest | null> {
	let read = await wrap(async () => {
		return JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as Manifest;
	});
	return isSuccess(read) ? read.data : null;
}

/** The path of the `sdxc-<name>` binary a package in `dir` declares, or `null`. */
function binaryOf(dir: string, manifest: Manifest, name: string): string | null {
	let bin = manifest.bin;
	let target = typeof bin === "string" ? bin : bin?.[`sdxc-${name}`];
	return target === undefined ? null : join(dir, target);
}

/**
 * The folder of the workspace package named `@sdxc/<name>` that the workspace root `dir`
 * declares, through a `packages/*`-style pattern or an exact path, or `null`.
 */
async function workspacePackage(dir: string, manifest: Manifest, name: string) {
	let patterns = Array.isArray(manifest.workspaces)
		? manifest.workspaces
		: (manifest.workspaces?.packages ?? []);
	for (let pattern of patterns) {
		let folder = pattern.endsWith("/*")
			? join(dir, pattern.slice(0, -2), name)
			: join(dir, pattern);
		let candidate = await manifestIn(folder);
		if (candidate?.name === `@sdxc/${name}`) return { folder, manifest: candidate };
	}
	return null;
}

/**
 * The binary of `@sdxc/<name>` installed at or above `cwd`, or declared by a workspace that
 * contains `cwd`, or `null` when neither holds it. A workspace runs its checked-out source,
 * and a project runs the version it installs.
 */
export async function installedBinary(cwd: string, name: string): Promise<string | null> {
	let dir = cwd;
	for (;;) {
		let installed = join(dir, "node_modules", "@sdxc", name);
		let manifest = await manifestIn(installed);
		if (manifest !== null) return binaryOf(installed, manifest, name);
		let root = await manifestIn(dir);
		let member = root === null ? null : await workspacePackage(dir, root, name);
		if (member !== null) return binaryOf(member.folder, member.manifest, name);
		let parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/** Whether an executable named `program` is in one of `path`'s directories. */
export async function onPath(program: string, path: string | undefined): Promise<boolean> {
	for (let dir of (path ?? "").split(delimiter)) {
		if (dir === "" || !isSuccess(await wrap(() => stat(join(dir, program))))) continue;
		return true;
	}
	return false;
}

/**
 * The command that runs `name`'s command line with `args`: the installed binary under Bun when
 * Bun is on `PATH` and under Node otherwise, or the published package through `bunx --bun`,
 * falling back to `npx`. Bun runs an installed binary that is still TypeScript source.
 *
 * @param binary - The installed binary, from `installedBinary`, or `null` to download it
 * @param bun - Whether `bun` is on `PATH`
 */
export function packageCommand(
	name: string,
	args: readonly string[],
	binary: string | null,
	bun: boolean,
): string[] {
	if (binary !== null) return [bun ? "bun" : "node", binary, ...args];
	let specifier = `@sdxc/${name}`;
	let program = `sdxc-${name}`;
	if (bun) return ["bunx", "--bun", "--package", specifier, program, ...args];
	return ["npx", "--yes", "--package", specifier, program, ...args];
}
