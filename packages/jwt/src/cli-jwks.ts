/**
 * The `sdxc-jwt jwks` handler: prints the public key set for a key pair, carrying only the
 * public members, so a static issuer can serve it as `/.well-known/jwks.json`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JWT_COMMANDS } from "./cli-contract.js";
import { readKeyPair } from "./cli-input.js";
import { JWK } from "./jwk.js";

export default createCommand(JWT_COMMANDS.jwks, async (ctx) => {
	let pair = await readKeyPair(ctx.flags, ctx);
	if (isFailure(pair)) return pair;
	ctx.stdout(`${JSON.stringify(JWK.toJSON([pair.data]), null, 2)}\n`);
	return success();
});
