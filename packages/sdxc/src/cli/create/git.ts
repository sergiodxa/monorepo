/**
 * The `git` steps `sdxc create` may take: checking `git` is on the `PATH` and running
 * `git init` in the new project. It never commits, so the first commit is the user's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** The two things `create` asks of git, replaceable so a test can stand in for either. */
export interface Git {
	/** Whether a `git` executable answers on the `PATH`. */
	available(): Promise<boolean>;
	/** Runs `git init` in `directory`; a non-zero exit is the failure. */
	init(directory: string): Promise<Result<void, Error>>;
}

/** The `git` on the `PATH`, run without a shell and with its output discarded. */
export const SYSTEM_GIT: Git = {
	async available() {
		return (await exec(["--version"], process.cwd())) === 0;
	},
	async init(directory) {
		let code = await exec(["init", "--quiet"], directory);
		return code === 0
			? success(undefined)
			: failure(new Error(`git init exited with ${code ?? "an error"} in ${directory}`));
	},
};

/** Runs `git` with `args` in `cwd`, answering its exit code, or `null` when it cannot start. */
function exec(args: string[], cwd: string): Promise<number | null> {
	return new Promise((settle) => {
		let child = spawn("git", args, { cwd, stdio: "ignore", shell: false });
		child.once("error", () => settle(null));
		child.once("close", (code) => settle(code));
	});
}
