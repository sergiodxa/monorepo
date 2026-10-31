/**
 * Reads one authored npm install line into the packages it adds and whether they are
 * development dependencies, so a page writes a single command and every package manager's
 * spelling of it is derived from that.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The npm verbs that mean "add these packages". */
const INSTALL_VERBS = new Set(["install", "i", "add"]);

/** The npm spellings of "as a dev dependency". */
const DEV_FLAGS = new Set(["-D", "--dev", "--save-dev"]);

/** An install line read into its parts. */
export interface ParsedInstall {
	packages: string[];
	/** Whether the packages install as development dependencies. */
	dev: boolean;
}

/**
 * Reads an `npm add`/`npm install` line. Any other line — a global install, another
 * verb, another flag, no packages — reads as `null`, and the page prints it verbatim.
 *
 * @param command - The command as authored, such as `npm add -D @sdxc/spec`.
 * @returns The packages and the dev flag, or `null` when the line is printed as written.
 * @example parseInstallCommand("npm add @sdxc/http") // { packages: ["@sdxc/http"], dev: false }
 */
export function parseInstallCommand(command: string): ParsedInstall | null {
	let [tool, verb, ...operands] = command.trim().split(/\s+/);
	if (tool !== "npm" || verb === undefined || !INSTALL_VERBS.has(verb)) return null;

	let dev = operands.some((word) => DEV_FLAGS.has(word));
	let packages = operands.filter((word) => !DEV_FLAGS.has(word));
	if (packages.length === 0 || packages.some((word) => word.startsWith("-"))) return null;

	return { packages, dev };
}
