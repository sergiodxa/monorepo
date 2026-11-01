/**
 * The `sdxc-crypto hmac` handler: signs a file or stdin under a key read from a file or a named
 * environment variable, or with `--verify` checks a hex signature in constant time and exits 1
 * on a mismatch, so a script can test a webhook payload by exit code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { CRYPTO_COMMANDS } from "./cli-contract.js";
import { encodeBytes, readPayload, readSecret } from "./cli-input.js";
import { hmac } from "./hmac.js";

/**
 * Prints the MAC, or `valid` / `invalid` under `--verify`; `--json` prints `{ algorithm,
 * encoding, mac }` or `{ algorithm, valid }`.
 */
export default createCommand(CRYPTO_COMMANDS.hmac, async (ctx) => {
	let key = await readSecret(ctx, {
		file: ctx.flags.keyFile,
		env: ctx.flags.keyEnv,
		name: "key",
	});
	if (isFailure(key)) return key;
	if (ctx.flags.keyFile === "-" && (ctx.arguments.input ?? "-") === "-") {
		return exit(2, "Stdin carries the key, so pass the input as a file");
	}
	let payload = await readPayload(ctx, ctx.arguments.input);
	if (isFailure(payload)) return payload;
	let options = { hash: ctx.flags.alg };

	if (ctx.flags.verify !== undefined) {
		let valid = await hmac.verify(key.data, payload.data, ctx.flags.verify, options);
		if (isFailure(valid)) return valid;
		ctx.stdout(
			ctx.flags.json
				? `${JSON.stringify({ algorithm: ctx.flags.alg, valid: valid.data })}\n`
				: `${valid.data ? "valid" : "invalid"}\n`,
		);
		return valid.data ? success() : exit(1);
	}

	let mac = await hmac.sign(key.data, payload.data, options);
	if (isFailure(mac)) return mac;
	let text = encodeBytes(mac.data, ctx.flags.encoding);
	ctx.stdout(
		ctx.flags.json
			? `${JSON.stringify({ algorithm: ctx.flags.alg, encoding: ctx.flags.encoding, mac: text })}\n`
			: `${text}\n`,
	);
	return success();
});
