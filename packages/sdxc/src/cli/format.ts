/**
 * Runs the project's `format` command over the files a command wrote or edited, once per
 * command, so generated code lands in the project's own style. The command is an argument list
 * spawned without a shell, so a path is always one argument whatever characters it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/**
 * Runs `command` in `root` with `paths` appended as arguments, its output passed through to the
 * terminal. Without a command or a path nothing runs. A command that cannot start or exits
 * non-zero is a failure that says the files stay as the CLI wrote them.
 *
 * @param command - The configured `format` value: the program, then its arguments.
 * @param paths - The written and edited files, relative to `root`.
 * @param root - The project root, which the command runs in.
 */
export function runFormat(
	command: readonly string[] | undefined,
	paths: readonly string[],
	root: string,
): Promise<Result<void, Error>> {
	let [program, ...args] = command ?? [];
	if (program === undefined || paths.length === 0) return Promise.resolve(success(undefined));
	let display = [program, ...args].join(" ");
	return new Promise((settle) => {
		let child = spawn(program, [...args, ...paths], { cwd: root, stdio: "inherit", shell: false });
		child.once("error", (error) => {
			settle(failure(new Error(`format command \`${display}\` could not start: ${error.message}`)));
		});
		child.once("close", (code, signal) => {
			if (code === 0) {
				settle(success(undefined));
				return;
			}
			let status = code === null ? `was stopped by ${signal ?? "a signal"}` : `exited with ${code}`;
			settle(
				failure(new Error(`format command \`${display}\` ${status}; the files stay as written`)),
			);
		});
	});
}
