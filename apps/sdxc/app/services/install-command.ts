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

	let variants = {} as Record<PackageManager, string>;
	for (let manager of MANAGERS) {
		variants[manager] =
			manager === "npm"
				? authored
				: [manager, ...words.map((word) => (DEV_FLAGS.has(word) ? "-D" : word))].join(" ");
	}

	return variants;
}
