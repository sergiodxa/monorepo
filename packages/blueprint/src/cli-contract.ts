/**
 * The `sdxc-blueprint` command line as a contract: one program that reads its whole command line
 * itself, because the flags a run takes are the values the named blueprint's stubs read, known
 * only once its stubs are loaded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, commands } from "@sdxc/cli";

/** The program, taking `<blueprint> [values]`, `--list`, `--help` and the run options. */
export const BLUEPRINT_COMMANDS = commands({
	description: "sdxc-blueprint — generate files from the blueprints in .config/blueprint",
	arguments: {
		args: argument.rest({
			valueName: "blueprint values",
			description: "A blueprint's name and its values, or --list",
		}),
	},
});
