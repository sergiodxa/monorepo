/**
 * The `layout` check: the app keeps one folder per kind of code under `app/`, and only entry
 * points sit in `bootstrap/`, which nothing outside it imports. A folder outside the layout
 * gives a file two possible homes, and an import of an entry point drags the whole Worker along.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/** The folders `app/` may hold, one per kind of code. */
export const APP_FOLDERS: ReadonlySet<string> = new Set([
	"commands",
	"emails",
	"http",
	"initializers",
	"jobs",
	"mcp",
	"models",
	"policies",
	"services",
	"test",
]);

/** The folders whose modules must reach `bootstrap/` through nothing. */
const IMPORTING_FOLDERS = ["app", "config", "database", "resources", "routes"];

/**
 * Warns on each folder in `app/` the layout has no kind for, and on each import of `bootstrap/`
 * from outside it. A file the module scanner cannot read is left to the type checker.
 */
export const layoutCheck: Check = {
	name: "layout",
	async run(context): Promise<CheckResult> {
		let entries = await wrap(() => readdir(join(context.root, "app"), { withFileTypes: true }));
		if (isFailure(entries)) return skipped("No app/ folder in the project");
		let findings = entries.data
			.filter((entry) => entry.isDirectory() && !APP_FOLDERS.has(entry.name))
			.map((entry) => entry.name)
			.sort()
			.map((name) => `app/${name}/ is a folder the app layout has no kind for`);
		for (let folder of IMPORTING_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				let references = findModuleReferences(file, source.data);
				if (isFailure(references)) continue;
				for (let { specifier } of references.data) {
					if (reachesBootstrap(specifier, file)) findings.push(`${file} imports ${specifier}`);
				}
			}
		}
		if (findings.length === 0) {
			return passed("app/ holds only the layout's folders and nothing imports bootstrap/");
		}
		return {
			status: "warn",
			message: "The project strays from the app layout",
			findings,
			fix: "Move each file to the folder its kind has (sdxc make <kind> shows where), and import a Durable Object from its own module instead of bootstrap/",
		};
	},
};

/**
 * Whether `specifier`, written in `file`, reaches into `bootstrap/` through the `~/bootstrap`
 * alias or a relative path.
 *
 * @param file - The importing file, relative to the project root.
 */
export function reachesBootstrap(specifier: string, file: string): boolean {
	if (specifier === "~/bootstrap" || specifier.startsWith("~/bootstrap/")) return true;
	if (!specifier.startsWith(".")) return false;
	let target = posix.normalize(posix.join(dirname(file).split("\\").join("/"), specifier));
	return target === "bootstrap" || target.startsWith("bootstrap/");
}
