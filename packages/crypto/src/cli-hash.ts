/**
 * The `sdxc-crypto hash` handler: prints the SHA-2 digest of a file or of stdin, hex by default
 * so the line compares directly against `sha256sum` output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { CRYPTO_COMMANDS } from "./cli-contract.js";
import { encodeBytes, readPayload } from "./cli-input.js";
import { sha256, sha384, sha512 } from "./hash.js";

/** The digest function behind each `--alg` choice. */
const DIGESTS = { sha256, sha384, sha512 };

/** Prints the digest alone, or `{ algorithm, encoding, digest }` under `--json`. */
export default createCommand(CRYPTO_COMMANDS.hash, async (ctx) => {
	let payload = await readPayload(ctx, ctx.arguments.input);
	if (isFailure(payload)) return payload;
	let digest = await DIGESTS[ctx.flags.alg](payload.data);
	if (isFailure(digest)) return digest;
	let text = encodeBytes(digest.data, ctx.flags.encoding);
	if (ctx.flags.json) {
		ctx.stdout(
			`${JSON.stringify({ algorithm: ctx.flags.alg, encoding: ctx.flags.encoding, digest: text })}\n`,
		);
	} else {
		ctx.stdout(`${text}\n`);
	}
	return success();
});
