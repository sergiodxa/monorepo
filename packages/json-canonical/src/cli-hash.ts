/**
 * The `hash` handler: digests a JSON document's canonical UTF-8 bytes with Web Crypto, so two
 * documents that differ only in member order or whitespace print the same digest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSON_CANONICAL_COMMANDS } from "./cli-contract.js";
import { readCanonical } from "./cli-input.js";

/**
 * The digest as unpadded base64url, the form JOSE and URLs carry.
 *
 * @param bytes - The digest
 */
function base64url(bytes: Uint8Array): string {
	let binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * The digest as lowercase hex, two characters per byte.
 *
 * @param bytes - The digest
 */
function hex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default createCommand(
	JSON_CANONICAL_COMMANDS.hash,
	/** Prints the digest on one line, or forwards the input's exit failure untouched. */
	async (ctx) => {
		let canonical = await readCanonical(ctx, ctx.arguments.file);
		if (isFailure(canonical)) return canonical;
		let algorithm = ctx.flags.alg.toUpperCase();
		let digest = new Uint8Array(
			await crypto.subtle.digest(algorithm, new TextEncoder().encode(canonical.data)),
		);
		ctx.stdout(`${ctx.flags.base64url ? base64url(digest) : hex(digest)}\n`);
		return success();
	},
);
