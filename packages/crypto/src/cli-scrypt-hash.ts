/**
 * The `sdxc-crypto scrypt hash` handler: hashes a password from stdin or a masked prompt under
 * the package's current scrypt policy, for seeding a user row or rotating an admin password.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { CRYPTO_COMMANDS } from "./cli-contract.js";
import { readPassword } from "./cli-input.js";
import { password } from "./password.js";

/** Prints the `$scrypt$…` string; a fresh salt makes every run print a different one. */
export default createCommand(CRYPTO_COMMANDS.scrypt.hash, async (ctx) => {
	let secret = await readPassword(ctx, () =>
		ctx.prompt.password({ message: "Password", default: "", name: "password" }),
	);
	if (isFailure(secret)) return secret;
	let hashed = await password.hash(secret.data);
	if (isFailure(hashed)) return hashed;
	ctx.stdout(`${hashed.data}\n`);
	return success();
});
