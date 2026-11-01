/**
 * The `sdxc-crypto totp` handler: prints the RFC 6238 code an authenticator app would show for a
 * base32 secret read from a file or a named environment variable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { CRYPTO_COMMANDS } from "./cli-contract.js";
import { readSecret } from "./cli-input.js";
import { totp } from "./totp.js";

/**
 * Prints the code, or `{ code, expiresAt }` under `--json`, where `expiresAt` is the ISO time
 * the code's step ends.
 */
export default createCommand(CRYPTO_COMMANDS.totp, async (ctx) => {
	let secret = await readSecret(ctx, {
		file: ctx.flags.secretFile,
		env: ctx.flags.secretEnv,
		name: "secret",
	});
	if (isFailure(secret)) return secret;
	let at = ctx.flags.at ?? Date.now();
	let code = await totp.code(secret.data, {
		at,
		digits: ctx.flags.digits,
		step: ctx.flags.step,
		algorithm: ctx.flags.algorithm,
	});
	if (isFailure(code)) return code;
	if (ctx.flags.json) {
		let stepMs = ctx.flags.step * 1000;
		let expiresAt = new Date((Math.floor(at / stepMs) + 1) * stepMs).toISOString();
		ctx.stdout(`${JSON.stringify({ code: code.data, expiresAt })}\n`);
	} else {
		ctx.stdout(`${code.data}\n`);
	}
	return success();
});
