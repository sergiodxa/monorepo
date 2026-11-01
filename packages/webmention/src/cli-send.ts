/**
 * The `send` handler: discovers the target's endpoint and POSTs the pair to it, printing what
 * the endpoint answered, so a mention can be sent or re-sent by hand after publishing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { WEBMENTION_COMMANDS } from "./cli-contract.js";
import { send } from "./sender.js";

import { WebmentionSendError } from "./index.js";

/**
 * Exits 0 when the endpoint answered 2xx, 1 when the target advertises no endpoint, the
 * endpoint refused or nothing answered, and 2 when either URL is unusable. `--json` prints
 * `{ sent, endpoint, status, location }`, or `{ sent: false, error }` with the refusal's details.
 */
export default createCommand(WEBMENTION_COMMANDS.send, async (ctx) => {
	let source = URL.parse(ctx.arguments.source);
	if (source === null) return exit(2, `The source ${ctx.arguments.source} is not a URL`);
	let target = URL.parse(ctx.arguments.target);
	if (target === null) return exit(2, `The target ${ctx.arguments.target} is not a URL`);

	let delivery = await send({ source, target }, { userAgent: ctx.flags.userAgent });

	if (isFailure(delivery)) {
		let error = delivery.error;
		if (!ctx.flags.json) return exit(1, error.message);
		let report =
			error instanceof WebmentionSendError
				? { sent: false, error: error.message, status: error.status }
				: { sent: false, error: error.message, retryable: error.retryable };
		ctx.stdout(`${JSON.stringify(report)}\n`);
		return exit(1);
	}

	if (delivery.data.status === "no-endpoint") {
		if (!ctx.flags.json) return exit(1, `${target.href} advertises no Webmention endpoint`);
		ctx.stdout(`${JSON.stringify({ sent: false, endpoint: null })}\n`);
		return exit(1);
	}

	let { endpoint, code, location } = delivery.data;
	if (ctx.flags.json) {
		let report = { sent: true, endpoint: endpoint.href, status: code, location };
		ctx.stdout(`${JSON.stringify(report)}\n`);
		return success();
	}
	ctx.stdout(`Sent to ${endpoint.href}: ${code}\n`);
	if (location !== null) ctx.stdout(`Status: ${location}\n`);
	return success();
});
