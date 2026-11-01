/**
 * The `sdxc-jwt keygen` handler: generates a key pair and prints it as the JSON `sign`, `jwks`
 * and `verify --key-file` read, or as PKCS#8 and SPKI PEM for tools outside this package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { JWT_COMMANDS } from "./cli-contract.js";
import { JWK } from "./jwk.js";

export default createCommand(JWT_COMMANDS.keygen, async (ctx) => {
	let pair = await JWK.generateKeyPair(ctx.flags.alg);
	if (ctx.flags.format === "pem") {
		ctx.stdout(`${pair.privateKey.trim()}\n${pair.publicKey.trim()}\n`);
	} else {
		ctx.stdout(`${JSON.stringify(pair, null, 2)}\n`);
	}
	return success();
});
