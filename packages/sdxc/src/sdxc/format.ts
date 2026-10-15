/**
 * Runs the project's `format` command over the files a command wrote or edited, once per
 * command, so generated code lands in the project's own style. The command is an argument list
 * spawned without a shell, so a path is always one argument whatever characters it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { ExecError } from "@sdxc/cli";
import { failure, isFailure, success } from "@sdxc/result";

/**
 * Runs `command` in `root` with `paths` appended as arguments, as a task whose output passes
 * through to the terminal. Without a command or a path nothing runs. A command that cannot start
 * or exits non-zero is a failure that says the files stay as the CLI wrote them.
 *
 * @param ctx - The running command, whose `exec` and `task` run the formatter
 * @param command - The configured `format` value: the program, then its arguments.
 * @param paths - The written and edited files, relative to `root`.
 * @param root - The project root, which the command runs in.
 */
export async function formatFiles(
	ctx: Pick<AnyCommandContext, "exec" | "task">,
	command: readonly string[] | undefined,
	paths: readonly string[],
	root: string,
): Promise<Result<void, Error>> {
	if (command === undefined || command.length === 0 || paths.length === 0) {
		return success(undefined);
	}
	let label = `Formatting ${paths.length === 1 ? "1 file" : `${paths.length} files`}`;
	let ran = await ctx.task(label, (task) =>
		ctx.exec([...command, ...paths], { cwd: root, stdio: "inherit", signal: task.signal }),
	);
	if (!isFailure(ran)) return success(undefined);
	let error = ran.error;
	if (!(error instanceof ExecError)) return failure(error);
	let display = command.join(" ");
	if (error.code !== null) {
		return failure(
			new Error(
				`format command \`${display}\` exited with ${error.code}; the files stay as written`,
			),
		);
	}
	if (error.cause instanceof Error) {
		return failure(
			new Error(`format command \`${display}\` could not start: ${error.cause.message}`),
		);
	}
	return failure(
		new Error(`format command \`${display}\` was stopped by a signal; the files stay as written`),
	);
}

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
