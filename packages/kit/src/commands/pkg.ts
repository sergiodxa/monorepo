/**
 * The `sdxc pkg` handler: runs an `@sdxc` package's command line with every token after its
 * name as typed, from the copy the project installs or from npm, so one global `sdxc` reaches
 * every package's command line. A mistyped name gets a suggestion and never runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, ExecError, exit, success } from "@sdxc/cli";
import { isSuccess } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { PACKAGE_COMMAND_LINES } from "../pkg/catalog.js";
import {
	installedBinary,
	lookupPackage,
	onPath,
	packageCommand,
	requestURL,
} from "../pkg/resolve.js";

/**
 * Tokens that ask `sdxc pkg` itself for help when they come first; after a package name they
 * belong to that package's command line.
 */
const HELP_FLAGS = new Set(["--help", "-h", "help"]);

/** The packages with a command line, one per line with what each does, for a bare `sdxc pkg`. */
function listing(): string {
	let names = Object.keys(PACKAGE_COMMAND_LINES);
	let width = Math.max(...names.map((name) => name.length));
	let rows = names.map((name) => `  ${name.padEnd(width)}  ${PACKAGE_COMMAND_LINES[name]}`);
	return [
		"Usage: sdxc pkg <name> [command] [options]",
		"",
		"Run an @sdxc package's command line, from the project's copy or downloaded with bunx or npx.",
		"Everything after <name> goes to the package; `sdxc pkg <name> --help` shows its commands.",
		"",
		"Packages with a command line:",
		...rows,
		"",
	].join("\n");
}

/**
 * Lists the packages when no name is given; exits 2 for a name without a command line, naming
 * the closest one or where to request it; otherwise hands the package's exit code back.
 */
export default createCommand(SDXC_COMMANDS.pkg, {
	middleware: [],
	/** Runs the named package's command line with its output on the terminal. */
	async handler(ctx) {
		let [input, ...args] = ctx.arguments.args;
		if (input === undefined || HELP_FLAGS.has(input)) {
			ctx.stdout(listing());
			return success();
		}
		let found = lookupPackage(input);
		if (found.kind === "without-command-line") {
			return exit(
				2,
				`@sdxc/${found.name} has no command line yet.\nTell us what you'd use it for: ${requestURL(found.name)}`,
			);
		}
		if (found.kind === "unknown") {
			let hint =
				found.suggestion === undefined
					? "Run `sdxc pkg` to list them."
					: `Did you mean \`${["sdxc pkg", found.suggestion, ...args].join(" ")}\`?`;
			return exit(2, `No @sdxc package command line is named "${found.name}". ${hint}`);
		}
		let binary = await installedBinary(ctx.cwd, found.name);
		let bun = await onPath("bun", ctx.env.PATH);
		let ran = await ctx.exec(packageCommand(found.name, args, binary, bun), {
			cwd: ctx.cwd,
			stdio: "inherit",
		});
		if (isSuccess(ran)) return success();
		if (ran.error instanceof ExecError && ran.error.code !== null) return exit(ran.error.code);
		return ran;
	},
});
