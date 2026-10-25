/**
 * The package manager a project installs with, and the commands it spells. A `packageManager`
 * field decides it, then a lock file, then the package manager that ran the CLI, so `sdxc create`
 * and `sdxc upgrade` print and run the same commands for the same project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isFailure, isSuccess, wrap } from "@sdxc/result";

/** A package manager, with how a project installs, runs an installed binary and runs a script. */
export interface PackageManager {
	name: "bun" | "npm" | "pnpm" | "yarn";
	install: string[];
	/** The command prefix that downloads a package and runs its binary, the package spec appended. */
	dlx: string[];
	/** The command prefix that runs a `package.json` script. */
	run: string[];
}

/** What a project says about its package manager. */
export interface PackageManagerSources {
	/** The `packageManager` field of `package.json`, such as `pnpm@9.0.0`. */
	declared: string | undefined;
	/** The first of `names`, in order, that the project holds as a lock file, or `null`. */
	findLockFile(names: readonly string[]): string | null | Promise<string | null>;
	/** The `npm_config_user_agent` the CLI was started with, such as `bun/1.3.0`. */
	userAgent?: string | undefined;
}

/** The package managers by name, with the commands each one spells. */
const PACKAGE_MANAGERS: Readonly<Record<PackageManager["name"], PackageManager>> = {
	bun: { name: "bun", install: ["bun", "install"], dlx: ["bunx"], run: ["bun", "run"] },
	npm: { name: "npm", install: ["npm", "install"], dlx: ["npx", "--yes"], run: ["npm", "run"] },
	pnpm: {
		name: "pnpm",
		install: ["pnpm", "install"],
		dlx: ["pnpm", "dlx"],
		run: ["pnpm", "run"],
	},
	yarn: {
		name: "yarn",
		install: ["yarn", "install"],
		dlx: ["yarn", "dlx"],
		run: ["yarn", "run"],
	},
};

/** Lock files by the package manager that writes them, in lookup order. */
const LOCK_FILES: ReadonlyArray<readonly [string, PackageManager["name"]]> = [
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["package-lock.json", "npm"],
];

/**
 * The package manager `sources` name: the `packageManager` field, then the first lock file in
 * lookup order, then the user agent, and npm when none of them names one it knows.
 */
export async function packageManager(sources: PackageManagerSources): Promise<PackageManager> {
	let declared = known(sources.declared?.split("@")[0]);
	if (declared !== null) return PACKAGE_MANAGERS[declared];
	let lockFile = await sources.findLockFile(LOCK_FILES.map(([file]) => file));
	let locked = LOCK_FILES.find(([file]) => file === lockFile);
	if (locked !== undefined) return PACKAGE_MANAGERS[locked[1]];
	return PACKAGE_MANAGERS[known(sources.userAgent?.split("/")[0]) ?? "npm"];
}

/**
 * The package manager of the project at `root`: its `package.json` `packageManager` field, then
 * the nearest lock file at or above it. Every command that prints an install reads it here, so
 * they agree on the same project.
 */
export async function projectPackageManager(root: string): Promise<PackageManager> {
	return packageManager({
		declared: await declaredPackageManager(root),
		findLockFile: lockFileAtOrAbove(root),
	});
}

/** The `packageManager` field of the `package.json` at `root`, when it holds a string. */
async function declaredPackageManager(root: string): Promise<string | undefined> {
	let text = await wrap(() => readFile(join(root, "package.json"), "utf8"));
	if (isFailure(text)) return undefined;
	let manifest = wrap(() => JSON.parse(text.data) as unknown);
	if (isFailure(manifest) || typeof manifest.data !== "object" || manifest.data === null) {
		return undefined;
	}
	let declared: unknown = Reflect.get(manifest.data, "packageManager");
	return typeof declared === "string" ? declared : undefined;
}

/**
 * Finds lock files in `root`, then in each directory above it, so a package inside a workspace
 * takes the workspace's lock file and the nearest directory holding one decides.
 */
export function lockFileAtOrAbove(root: string): PackageManagerSources["findLockFile"] {
	return async (names) => {
		let directory = root;
		while (true) {
			for (let name of names) {
				if (isSuccess(await wrap(() => stat(join(directory, name))))) return name;
			}
			let parent = dirname(directory);
			if (parent === directory) return null;
			directory = parent;
		}
	};
}

/**
 * The command that starts `script`, as a person types it: `npm run dev`, or `bun dev` for the
 * package managers that run a script by its name alone.
 */
export function scriptCommand(manager: PackageManager, script: string): string {
	return manager.name === "npm" ? `npm run ${script}` : `${manager.name} ${script}`;
}

/** `name` when it is a package manager this module knows, `null` otherwise. */
function known(name: string | undefined): PackageManager["name"] | null {
	return name === "bun" || name === "npm" || name === "pnpm" || name === "yarn" ? name : null;
}
