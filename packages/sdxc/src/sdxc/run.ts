/**
 * The commands still parsed by hand while the command line moves onto `@sdxc/cli`: each takes
 * the arguments after its name and the streams to write through, and answers its exit code.
 * Every other command runs through `createSDXC()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { make } from "./make/index.js";
import { ui } from "./ui/index.js";

/** Where a hand-parsed command runs and writes; the binary passes the process's own. */
export interface CommandIO {
	cwd: string;
	stdout(text: string): void;
	stderr(text: string): void;
}

/**
 * Runs the hand-parsed command `argv` names and answers its exit code, or `null` when `argv`
 * names a command `createSDXC()` runs.
 *
 * @param argv - The arguments after the binary, as `process.argv.slice(2)` holds them.
 * @param io - The working directory and the two output streams.
 */
export async function run(argv: readonly string[], io: CommandIO): Promise<number | null> {
	if (argv[0] === "make") return make(argv.slice(1), io);
	if (argv[0] === "ui") return ui(argv.slice(1), io);
	return null;
}
