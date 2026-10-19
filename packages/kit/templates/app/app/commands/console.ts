/**
 * `console`: Bun's own REPL with `bootstrap/console.ts` preloaded, so the local database is
 * `db` and the app's models are `models` at the prompt (`await models.post.findMany()`), and
 * top-level `await` works as in a module.
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";

/** Hands the terminal to the REPL until `.exit` or Ctrl+D, from the project's root. */
export default createCommand(commandset.console, async (ctx) => {
	let repl = await ctx.exec(["bun", "--preload", "./bootstrap/console.ts", "--interactive"], {
		cwd: PROJECT_ROOT,
	});
	return isFailure(repl) ? repl : success();
});
