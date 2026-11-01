/**
 * The `sdxc-openpgp keygen` handler: generates an Ed25519 signing key, locks it when a
 * passphrase is given, prints the private key block and, with `--public-out`, writes the
 * certificate to publish. The fingerprint goes to stderr, so stdout stays the key alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCommand, EXIT_CODES, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { OPENPGP_COMMANDS } from "./cli-contract.js";
import { readPassphrase } from "./cli-input.js";
import { generateKey } from "./keys.js";

export default createCommand(OPENPGP_COMMANDS.keygen, async (ctx) => {
	let { userId, keyVersion, publicOut, passphraseFile, passphraseEnv } = ctx.flags;
	let passphrase = await readPassphrase({ file: passphraseFile, env: passphraseEnv }, ctx);
	if (isFailure(passphrase)) return passphrase;
	if (passphrase.data === "") return exit(EXIT_CODES.usage, "The passphrase is empty");

	let generated = await generateKey({ userId, version: keyVersion === "4" ? 4 : 6 });
	if (isFailure(generated)) return exit(EXIT_CODES.usage, generated.error.message);
	let key = generated.data;
	if (passphrase.data !== undefined) {
		let locked = await key.lock(passphrase.data);
		if (isFailure(locked)) return exit(EXIT_CODES.usage, locked.error.message);
		key = locked.data;
	}

	if (publicOut !== undefined) {
		try {
			await writeFile(resolve(ctx.cwd, publicOut), key.publicKey.armor(), "utf8");
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return exit(EXIT_CODES.usage, `Cannot write ${publicOut}: ${reason}`);
		}
	}
	ctx.stdout(key.armor());
	ctx.stderr(`Generated key ${key.fingerprint}\n`);
	return success();
});
