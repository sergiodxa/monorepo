/**
 * The install commands `sdxc doctor` prints as fixes, spelled for the project's package manager:
 * each pins an exact version and keeps a package in the dependency section that lists it, so
 * running the fix changes only the versions the check flagged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PackageManager } from "../package-manager.js";
import type { Manifest } from "../upgrade/project.js";

/** How each package manager adds an exact version, and the flag that keeps it a dev dependency. */
const EXACT_ADD: Record<PackageManager["name"], { add: string[]; dev: string }> = {
	bun: { add: ["bun", "add", "--exact"], dev: "--dev" },
	npm: { add: ["npm", "install", "--save-exact"], dev: "--save-dev" },
	pnpm: { add: ["pnpm", "add", "--save-exact"], dev: "--save-dev" },
	yarn: { add: ["yarn", "add", "--exact"], dev: "--dev" },
};

/**
 * The command that pins each package to its version: one for the packages in `dependencies`
 * and one for those in `devDependencies`, joined with `&&` when both are needed.
 *
 * @param versions - The exact version to pin, by package name
 */
export function exactInstallCommand(
	manager: PackageManager,
	manifest: Manifest,
	versions: ReadonlyMap<string, string>,
): string {
	let spelling = EXACT_ADD[manager.name];
	let runtime: string[] = [];
	let development: string[] = [];
	for (let [name, version] of versions) {
		let target = manifest.devDependencies?.[name] === undefined ? runtime : development;
		target.push(`${name}@${version}`);
	}
	let commands: string[] = [];
	if (runtime.length > 0) commands.push([...spelling.add, ...runtime].join(" "));
	if (development.length > 0) {
		commands.push([...spelling.add, spelling.dev, ...development].join(" "));
	}
	return commands.join(" && ");
}
