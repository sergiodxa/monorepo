/**
 * The `expires` handler: a cron or CI gate on one domain's expiry. It exits 0 while the
 * registry's expiration date lies past the window, and 1 when it falls inside it, has passed,
 * or is not published, since an unknown expiry is one an operator has to check by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { client, day, lookupFailed } from "./cli-client.js";
import { RDAP_COMMANDS } from "./cli-contract.js";

/**
 * Looks the domain up and compares its expiry with the end of the window; the line printed
 * says which side of it the date falls on.
 */
export default createCommand(RDAP_COMMANDS.expires, async (ctx) => {
	let looked = await client(ctx.flags).domain(ctx.arguments.domain);
	if (isFailure(looked)) return lookupFailed(looked.error, ctx.flags.json, ctx.stdout);

	let now = Date.now();
	let { name, expiresAt } = looked.data;
	let windowEndsAt = now + ctx.flags.within;
	let expiring = expiresAt === null || expiresAt <= windowEndsAt;

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ domain: name, expiresAt, windowEndsAt, expiring }, null, 2)}\n`);
	} else if (expiresAt === null) {
		ctx.stdout(`${name}: the registry publishes no expiration date\n`);
	} else if (expiresAt <= now) {
		ctx.stdout(`${name} expired on ${day(expiresAt)}\n`);
	} else {
		let side = expiring ? "before" : "after";
		ctx.stdout(
			`${name} expires on ${day(expiresAt)}, ${side} the window ends on ${day(windowEndsAt)}\n`,
		);
	}
	return expiring ? exit(1) : success();
});
