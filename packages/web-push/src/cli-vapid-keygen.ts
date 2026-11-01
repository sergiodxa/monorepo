/**
 * The `vapid keygen` handler: one fresh P-256 pair from `WebPush.generateKeys`, printed as the
 * two environment lines a deployment stores, or as the `{ publicKey, privateKey }` JSON that
 * `send --keys-file` reads back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { WEB_PUSH_COMMANDS } from "./cli-contract.js";

import { WebPush } from "./index.js";

/**
 * Prints a new pair. The private half reaches stdout only, so redirect it into a secret store
 * or a file outside version control.
 */
export default createCommand(WEB_PUSH_COMMANDS.vapid.keygen, async (ctx) => {
	let keys = await WebPush.generateKeys();
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(keys, null, 2)}\n`);
	} else {
		ctx.stdout(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
	}
	return success();
});
