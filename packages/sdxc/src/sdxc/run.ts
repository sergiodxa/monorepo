/**
 * The `sdxc` command line as a function of its arguments: it finds the project, dispatches to
 * the command and answers the exit code, writing through the given streams so a test drives it
 * exactly as a terminal does. Exit codes: 0 done, 1 the command failed, 2 a usage error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseArgs } from "node:util";

import { isFailure, wrap } from "@sdxc/result";

import { create } from "./create/index.js";
import { init } from "./init.js";
import { make } from "./make/index.js";
import { findProjectRoot } from "./project.js";
import { ui } from "./ui/index.js";
import { upgrade } from "./upgrade/index.js";

/** Where the CLI runs and writes; the binary passes the process's own. */
export interface CommandIO {
	cwd: string;
	stdout(text: string): void;
	stderr(text: string): void;
}

/** What `sdxc --help` and every usage error print. */
export const USAGE = [
	"Usage: sdxc <command> [options]",
	"",
	"Commands:",
	"  create      Write a new project from a built-in template or a GitHub repository",
	"  init        Write .config/sdxc.jsonc with every default spelled out",
	"  make        Write a controller, job, model or other file where the app layout puts it",
	"  ui          Copy @sdxc/ui components into the project and keep imports on the copies",
	"  upgrade     Move to another sdxc release and print the prompt for the code",
	"",
	"Options:",
	"  --dry-run   Print what the command would write and change nothing",
	"  -h, --help  Show this message",
	"",
].join("\n");

/**
 * Runs the command `argv` names and answers its exit code.
 *
 * @param argv - The arguments after the binary, as `process.argv.slice(2)` holds them.
 * @param io - The working directory and the two output streams.
 */
export async function run(argv: readonly string[], io: CommandIO): Promise<number> {
	if (argv[0] === "upgrade") return upgrade(argv.slice(1), io);
	if (argv[0] === "create") return create(argv.slice(1), io);
	if (argv[0] === "make") return make(argv.slice(1), io);
	if (argv[0] === "ui") return ui(argv.slice(1), io);
	let args = wrap(() =>
		parseArgs({
			args: [...argv],
			allowPositionals: true,
			options: {
				"dry-run": { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		}),
	);
	if (isFailure(args)) {
		io.stderr(`${args.error.message}\n\n${USAGE}`);
		return 2;
	}
	let [command, ...rest] = args.data.positionals;
	if (args.data.values.help === true) {
		io.stdout(USAGE);
		return 0;
	}
	if (command === undefined) {
		io.stderr(USAGE);
		return 2;
	}
	if (command !== "init") {
		io.stderr(`Unknown command: ${command}\n\n${USAGE}`);
		return 2;
	}
	if (rest.length > 0) {
		io.stderr(`sdxc init takes no arguments\n\n${USAGE}`);
		return 2;
	}
	let root = await findProjectRoot(io.cwd);
	if (isFailure(root)) {
		io.stderr(`${root.error.message}\n`);
		return 1;
	}
	let outcome = await init(root.data, { dryRun: args.data.values["dry-run"] === true });
	if (isFailure(outcome)) {
		io.stderr(`${outcome.error.message}\n`);
		return 1;
	}
	if (outcome.data.written) io.stdout(`Wrote ${outcome.data.path}\n`);
	else io.stdout(`Would write ${outcome.data.path}:\n\n${outcome.data.content}`);
	return 0;
}
