/**
 * The project files the source-reading checks walk: every file under a folder, relative to the
 * project root with `/` separators, so a finding names a path the same way on every platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

/** A TypeScript or JavaScript module. */
const SOURCE = /\.[cm]?[jt]sx?$/;

/** A test or a declaration file, which no layout rule applies to. */
const NOT_APP_CODE = /(?:\.test\.[cm]?[jt]sx?|\.d\.[cm]?ts)$/;

/**
 * Every file under `folder`, sorted, `node_modules` and dot-folders left out; a missing folder
 * lists nothing.
 */
export async function listFiles(root: string, folder: string): Promise<string[]> {
	let base = join(root, folder);
	let entries = await wrap(() => readdir(base, { recursive: true, withFileTypes: true }));
	if (isFailure(entries)) return [];
	return entries.data
		.filter((entry) => entry.isFile())
		.map((entry) => relative(base, join(entry.parentPath, entry.name)).split(sep).join("/"))
		.filter(
			(path) => !path.split("/").some((part) => part === "node_modules" || part.startsWith(".")),
		)
		.map((path) => `${folder}/${path}`)
		.sort();
}

/** Whether `path` is a module, tests included and declaration files left out. */
export function isModule(path: string): boolean {
	return SOURCE.test(path) && !/\.d\.[cm]?ts$/.test(path);
}

/** Whether `path` is a module the app runs, its tests and declaration files left out. */
export function isAppSource(path: string): boolean {
	return SOURCE.test(path) && !NOT_APP_CODE.test(path);
}
