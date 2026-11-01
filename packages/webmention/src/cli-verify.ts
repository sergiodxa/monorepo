/**
 * The `verify` handler: fetches the source as a receiver does and reports whether it links to
 * the target, and the mention a receiver would display, so a sender can check before sending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { WEBMENTION_COMMANDS } from "./cli-contract.js";
import { verify } from "./receiver.js";

/**
 * Exits 0 when the source links to the target, 1 when it answered `410`, does not link, or
 * cannot be fetched, and 2 when either URL is unusable. `--json` prints `{ status }`, with the
 * mention and the URL the source was served from when linked.
 */
export default createCommand(WEBMENTION_COMMANDS.verify, async (ctx) => {
	let source = URL.parse(ctx.arguments.source);
	if (source === null) return exit(2, `The source ${ctx.arguments.source} is not a URL`);
	let target = URL.parse(ctx.arguments.target);
	if (target === null) return exit(2, `The target ${ctx.arguments.target} is not a URL`);

	let outcome = await verify({ source, target }, { userAgent: ctx.flags.userAgent });

	if (isFailure(outcome)) {
		if (!ctx.flags.json) return exit(1, outcome.error.message);
		let report = {
			status: "failed",
			error: outcome.error.message,
			retryable: outcome.error.retryable,
		};
		ctx.stdout(`${JSON.stringify(report)}\n`);
		return exit(1);
	}

	let result = outcome.data;
	if (result.status !== "linked") {
		if (ctx.flags.json) {
			ctx.stdout(`${JSON.stringify({ status: result.status })}\n`);
			return exit(1);
		}
		let reason = result.status === "gone" ? "is gone (410)" : `does not link to ${target.href}`;
		return exit(1, `${source.href} ${reason}`);
	}

	if (ctx.flags.json) {
		let report = { status: "linked", finalUrl: result.finalUrl, mention: result.mention };
		ctx.stdout(`${JSON.stringify(report)}\n`);
		return success();
	}
	let { mention } = result;
	let author = mention.author?.name ?? mention.author?.url;
	ctx.stdout(`Linked: a ${mention.kind}${author ? ` by ${author}` : ""}\n`);
	ctx.stdout(`URL: ${mention.url}\n`);
	if (mention.name !== null) ctx.stdout(`Name: ${mention.name}\n`);
	if (mention.published !== null) ctx.stdout(`Published: ${mention.published.toISOString()}\n`);
	if (mention.content !== null) ctx.stdout(`\n${mention.content.text}\n`);
	return success();
});
