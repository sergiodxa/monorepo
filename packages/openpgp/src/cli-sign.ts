/**
 * The `sdxc-openpgp sign` handler: signs a file with a private key from a file or an
 * environment variable and prints a cleartext signed message, or with `--detach` an armored
 * detached signature, ready to publish beside the file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, EXIT_CODES, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { OPENPGP_COMMANDS } from "./cli-contract.js";
import { oneStdin, readBytes, readSigningKey, readText } from "./cli-input.js";
import { signCleartext, signDetached } from "./sign.js";

export default createCommand(OPENPGP_COMMANDS.sign, async (ctx) => {
	let { keyFile, keyEnv, passphraseFile, passphraseEnv, detach, text, hash } = ctx.flags;
	if (text && !detach) return usage("--text applies only with --detach");
	let file = ctx.arguments.file;
	let stdin = oneStdin([file, keyFile, passphraseFile]);
	if (isFailure(stdin)) return stdin;
	let key = await readSigningKey(
		{ file: keyFile, env: keyEnv },
		{ file: passphraseFile, env: passphraseEnv },
		ctx,
	);
	if (isFailure(key)) return key;

	if (detach) {
		let data = await readBytes(file, ctx);
		if (isFailure(data)) return data;
		let signature = await signDetached(data.data, key.data, { hash, text });
		if (isFailure(signature)) return exit(EXIT_CODES.usage, signature.error.message);
		ctx.stdout(signature.data.armored);
		return success();
	}

	let message = await readText(file, ctx);
	if (isFailure(message)) return message;
	let signed = await signCleartext(message.data, key.data, { hash });
	if (isFailure(signed)) return exit(EXIT_CODES.usage, signed.error.message);
	ctx.stdout(signed.data);
	return success();
});
