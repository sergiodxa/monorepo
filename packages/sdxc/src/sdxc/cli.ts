/**
 * The `sdxc` command line: its contract with every handler mapped through `lazy()`, so a run
 * imports only the command it reaches and `--help` imports none. The binary runs it against
 * the process; a test builds its own with a fixture `sdxc` package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CLI } from "@sdxc/cli";

import { createCLI, lazy } from "@sdxc/cli";

import { SDXC_COMMANDS } from "./contract.js";
import { packageRoot } from "./middleware.js";

/** What the binary and the tests vary between runs. */
export interface SDXCOptions {
	/** Printed by `--version`; without one the flag does not exist. */
	version?: string;
	/**
	 * The `sdxc` package commands read templates, stubs, the component registry and the
	 * changelog from.
	 * @default the package this module runs from
	 */
	packageRoot?: string;
}

/**
 * Builds the `sdxc` command line.
 *
 * @example process.exitCode = await createSDXC({ version }).run(process.argv.slice(2));
 */
export function createSDXC(
	options: SDXCOptions = {},
): CLI<typeof SDXC_COMMANDS, readonly [ReturnType<typeof packageRoot>]> {
	let cli = createCLI({
		name: "sdxc",
		version: options.version,
		commands: SDXC_COMMANDS,
		middleware: [packageRoot(options.packageRoot)],
	});
	cli.map(
		SDXC_COMMANDS.create,
		lazy(() => import("./commands/create.js")),
	);
	cli.map(
		SDXC_COMMANDS.init,
		lazy(() => import("./commands/init.js")),
	);
	return cli;
}
