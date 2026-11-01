/**
 * The `sdxc-crypto scrypt verify` handler: checks a password from stdin or a masked prompt
 * against a stored scrypt hash, exiting 1 on a mismatch so a script can branch on the code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { CRYPTO_COMMANDS } from "./cli-contract.js";
import { readPassword } from "./cli-input.js";
import { password } from "./password.js";

/**
 * Prints `valid` or `invalid`, or `{ valid, needsRehash }` under `--json`; a stored value in
 * another format exits 2, since no password could match it.
 */
export default createCommand(CRYPTO_COMMANDS.scrypt.verify, async (ctx) => {
	if (!password.recognizes(ctx.arguments.stored)) {
		return exit(2, "The stored value is not a $scrypt$ hash; quote it in single quotes");
	}
	let secret = await readPassword(ctx, () =>
		ctx.prompt.password({ message: "Password", default: "", name: "password" }),
	);
	if (isFailure(secret)) return secret;
	let valid = await password.verify(ctx.arguments.stored, secret.data);
	if (isFailure(valid)) return exit(2, valid.error.message);
	ctx.stdout(
		ctx.flags.json
			? `${JSON.stringify({ valid: valid.data, needsRehash: password.needsRehash(ctx.arguments.stored) })}\n`
			: `${valid.data ? "valid" : "invalid"}\n`,
	);
	return valid.data ? success() : exit(1);
});
