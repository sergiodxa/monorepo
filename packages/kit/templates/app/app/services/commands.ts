/**
 * Runs one of the app's own commands from inside another, as typing it would, so a command
 * composed of others (`db prepare`, `db fresh --seed`) behaves exactly like its parts.
 */

import type { AnyCommandContext, CommandResult } from "@sdxc/cli";

import { exit, success } from "@sdxc/cli";

/**
 * Runs `argv` on the app's command line with the calling run's streams, directory and
 * environment, so its output lands where the caller's would. Its failure has been printed
 * already, so the caller fails with the same exit code and no second message.
 *
 * @example let migrated = await runCommand(ctx, ["db", "migrate"]);
 */
export async function runCommand(
	ctx: AnyCommandContext,
	argv: readonly string[],
): Promise<CommandResult> {
	let { cli } = await import("~/app/initializers/cli");
	let code = await cli.run(argv, {
		cwd: ctx.cwd,
		env: ctx.env,
		stdout: { write: ctx.stdout },
		stderr: { write: ctx.stderr },
		signal: ctx.signal,
	});
	return code === 0 ? success() : exit(code);
}
