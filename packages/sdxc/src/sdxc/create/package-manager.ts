/**
 * The package manager a new project's next steps are written for. A template that commits a
 * lockfile or a `packageManager` field decides it; otherwise it is the one that ran the CLI,
 * as `npm_config_user_agent` names it, so `bunx sdxc create` prints `bun install`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TemplateTree } from "./templates.js";

/** A package manager the next steps can be written for. */
export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

/** Lockfiles by the package manager that writes them, checked in this order. */
const LOCKFILES: ReadonlyArray<[string, PackageManager]> = [
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["package-lock.json", "npm"],
];

/**
 * Infers the package manager for `tree`: its lockfile, then its `package.json`'s
 * `packageManager`, then `userAgent`, and `npm` when none of them names one.
 *
 * @param userAgent - The `npm_config_user_agent` the CLI was started with, such as `bun/1.3.0`.
 */
export function inferPackageManager(
	tree: TemplateTree,
	userAgent: string | undefined,
): PackageManager {
	for (let [lockfile, manager] of LOCKFILES) {
		if (tree.files.has(lockfile)) return manager;
	}
	let manifest = tree.files.get("package.json");
	if (manifest !== undefined) {
		let declared = /"packageManager"\s*:\s*"([a-z]+)@/.exec(new TextDecoder().decode(manifest));
		let named = known(declared?.[1]);
		if (named !== null) return named;
	}
	return known(userAgent?.split("/")[0]) ?? "npm";
}

/** The commands that install a project's dependencies and start its `script`. */
export function commandsFor(
	manager: PackageManager,
	script: string,
): { install: string; run: string } {
	let run = manager === "npm" ? `npm run ${script}` : `${manager} ${script}`;
	return { install: `${manager} install`, run };
}

/** `name` when it is a package manager this module knows, `null` otherwise. */
function known(name: string | undefined): PackageManager | null {
	return name === "bun" || name === "npm" || name === "pnpm" || name === "yarn" ? name : null;
}
