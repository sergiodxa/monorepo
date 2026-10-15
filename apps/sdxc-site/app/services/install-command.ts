/**
 * Rewrites one authored npm command into the dialect each package manager speaks, so a
 * page carries a single install line and the strip offers the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The dialects on offer, in the order the strip reads. The first one is the fallback. */
export const MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

export type PackageManager = (typeof MANAGERS)[number];

/** The npm verbs that mean "add these packages", which every other manager spells `add`. */
const INSTALL_VERBS = new Set(["install", "i", "add"]);

/** The npm spellings of "as a dev dependency", which every other manager spells `-D`. */
const DEV_FLAGS = new Set(["-D", "--dev", "--save-dev"]);

/** The npm spellings of "install globally", which Yarn spells as its own `global add` verb. */
const GLOBAL_FLAGS = new Set(["-g", "--global"]);

/**
 * Rewrites one authored npm command into each manager's dialect, keeping the authored
 * text verbatim for npm so the source of truth stays the string the page was written
 * with.
 *
 * @param command - The command as authored, such as `npm add @sdxc/http`.
 * @returns One command line per manager.
 * @example installVariants("npm add @sdxc/http").bun // "bun add @sdxc/http"
 */
export function installVariants(command: string): Record<PackageManager, string> {
	let authored = command.trim();
	let [, ...rest] = authored.split(/\s+/);
	let [verb, ...operands] = rest;
	let words = verb !== undefined && INSTALL_VERBS.has(verb) ? ["add", ...operands] : rest;

	let global = words[0] === "add" && words.some((word) => GLOBAL_FLAGS.has(word));
	let variants = {} as Record<PackageManager, string>;
	for (let manager of MANAGERS) {
		if (manager === "npm") variants[manager] = authored;
		else if (manager === "yarn" && global) {
			let packages = words.slice(1).filter((word) => !GLOBAL_FLAGS.has(word));
			variants[manager] = ["yarn", "global", "add", ...packages].join(" ");
		} else {
			variants[manager] = [
				manager,
				...words.map((word) => (DEV_FLAGS.has(word) ? "-D" : GLOBAL_FLAGS.has(word) ? "-g" : word)),
			].join(" ");
		}
	}

	return variants;
}
