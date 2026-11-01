/**
 * The `sdxc-crypto token` handler: prints one `randomToken` so a new secret goes straight into a
 * secret store without passing through argv, a file or shell history.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { CRYPTO_COMMANDS } from "./cli-contract.js";
import { randomToken } from "./random.js";

/** Prints the token, with a newline unless `--no-newline` asks for the bytes alone. */
export default createCommand(CRYPTO_COMMANDS.token, (ctx) => {
	let token = randomToken({ bytes: ctx.flags.bytes, prefix: ctx.flags.prefix });
	ctx.stdout(ctx.flags.newline ? `${token}\n` : token);
	return success();
});
