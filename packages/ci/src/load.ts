/**
 * Loading a CI script: the file is imported as a module and its default export must be a
 * function, the one `defineCI` returns or a plain one, so a script needs no import to be
 * runnable while `defineCI` gives it types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { CIScript } from "./types.js";

/**
 * Types a CI script: the function is returned as given, and its `ci` argument is typed.
 *
 * @example export default defineCI(async (ci) => { await ci.step("Test", "bun run test"); });
 */
export function defineCI(script: CIScript): CIScript {
	return script;
}

/** The script `path` default-exports, or a failure saying why it cannot run. */
export async function loadScript(path: string, cwd: string): Promise<Result<CIScript, Error>> {
	let absolute = resolve(cwd, path);
	let loaded = await wrap(
		() => import(pathToFileURL(absolute).href) as Promise<{ default?: unknown }>,
	);
	if (isFailure(loaded)) {
		return failure(new Error(`Cannot load ${path}: ${loaded.error.message}`));
	}
	let script = loaded.data.default;
	if (typeof script !== "function") {
		return failure(
			new Error(
				`${path} must default-export a CI script: export default defineCI(async (ci) => { … })`,
			),
		);
	}
	return success(script as CIScript);
}
