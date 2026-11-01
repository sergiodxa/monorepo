/**
 * The `discover` handler: fetches a target under the library's bounds and prints the endpoint
 * it advertises, so a developer can check a page takes Webmentions before sending one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { WEBMENTION_COMMANDS } from "./cli-contract.js";
import { discover } from "./discover.js";

/**
 * Prints the endpoint and exits 0, exits 1 when the target advertises none or cannot be
 * fetched, and 2 when the target is not a URL. `--json` prints `{ endpoint }`, `null` for none.
 */
export default createCommand(WEBMENTION_COMMANDS.discover, async (ctx) => {
	let target = URL.parse(ctx.arguments.target);
	if (target === null) return exit(2, `The target ${ctx.arguments.target} is not a URL`);

	let found = await discover(target, { userAgent: ctx.flags.userAgent });
	if (isFailure(found)) {
		if (ctx.flags.json) {
			let report = { endpoint: null, error: found.error.message, retryable: found.error.retryable };
			ctx.stdout(`${JSON.stringify(report)}\n`);
			return exit(1);
		}
		return exit(1, found.error.message);
	}

	let endpoint = found.data?.href ?? null;
	if (ctx.flags.json) ctx.stdout(`${JSON.stringify({ endpoint })}\n`);
	if (endpoint === null) {
		return exit(1, ctx.flags.json ? undefined : `${target.href} advertises no Webmention endpoint`);
	}
	if (!ctx.flags.json) ctx.stdout(`${endpoint}\n`);
	return success();
});
