/**
 * The folder layout every app follows: what may sit at an app's root, under `app/` and under
 * `bootstrap/`, and the rule that nothing imports an entry point. The guard in
 * `app-layout.test.ts` holds each converted app to it, so a new file has exactly one home.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dirname, join, relative } from "node:path";

import type { CodemodError } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure, success } from "@sdxc/result";

/**
 * Apps already moved onto the layout. An app joins this list in the commit that converts it,
 * and from then on the guard keeps it there.
 */
export const CONVERTED_APPS = [
	"demo",
	"books",
	"sdxc-site",
	"blog",
	"r3-auth",
	"uptime",
	"reader",
	"auth-saas",
];

/**
 * Folders an app's root may hold, besides dot-folders, installed dependencies and build output.
 * `public/` holds the static files Cloudflare serves as they are.
 */
export const APP_ROOT_FOLDERS = new Set([
	"app",
	"bootstrap",
	"config",
	"database",
	"docs",
	"public",
	"resources",
	"routes",
	"scripts",
	"spec",
]);

/** Folders `app/` may hold, one per kind of code. */
export const APP_FOLDERS = new Set([
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

/** What `bootstrap/` may hold: the Worker, browser and command-line entry points. */
export const BOOTSTRAP_ENTRIES = new Set(["browser.ts", "cli.ts", "worker.ts"]);

/** Root-level folders the layout check skips: dependencies, build output, local state. */
export function isIgnoredRootFolder(name: string): boolean {
	return name.startsWith(".") || name === "node_modules" || name === "dist";
}

/** Whether a `bootstrap/` entry is allowed, counting an entry point's own test beside it. */
export function isBootstrapEntry(name: string): boolean {
	if (BOOTSTRAP_ENTRIES.has(name)) return true;
	return /^(worker|browser|cli)\.(workers\.)?test\.tsx?$/.test(name);
}

/**
 * Every static and dynamic import specifier in a module's source, read by a scanner that
 * leaves comments, strings and JSX text alone. A file that cannot be scanned is the failure.
 */
export function importSpecifiers(filename: string, source: string): Result<string[], CodemodError> {
	let references = findModuleReferences(filename, source);
	if (isFailure(references)) return references;
	return success(references.data.map((reference) => reference.specifier));
}

/**
 * Whether a specifier written in `file` reaches into the app's `bootstrap/` folder, through
 * the `~/bootstrap` alias or a relative path.
 *
 * @param specifier The import specifier as written.
 * @param file The importing file, relative to the app's root.
 */
export function reachesBootstrap(specifier: string, file: string): boolean {
	if (specifier === "~/bootstrap" || specifier.startsWith("~/bootstrap/")) return true;
	if (!specifier.startsWith(".")) return false;

	let target = relative(".", join(dirname(file), specifier));
	return target === "bootstrap" || target.startsWith("bootstrap/");
}
