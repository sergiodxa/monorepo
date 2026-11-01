/**
 * The `sdxc-openpgp verify` handler: checks a cleartext signed message, or a file against a
 * detached signature, with a certificate. A bad, missing or foreign signature exits 1 and
 * names the key it claims to come from; input that cannot be read exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, EXIT_CODES, exit, success } from "@sdxc/cli";
import { isFailure, isSuccess } from "@sdxc/result";

import type { InputContext } from "./cli-input.js";
import type { OpenPgpError } from "./errors.js";
import type { PublicKey } from "./keys.js";
import type { VerifiedSignature } from "./sign.js";

import { OPENPGP_COMMANDS } from "./cli-contract.js";
import { armoredOrBinary, oneStdin, readBytes, readCertificate, readText } from "./cli-input.js";
import { readSignatures } from "./inspect.js";
import { verifyCleartext, verifyDetached } from "./sign.js";

/** What a verification ran over, and what the library answered. */
interface Outcome {
	verified: Result<VerifiedSignature, OpenPgpError>;
	/** The signature input, read again to name its issuers when verification fails. */
	signature: string | Uint8Array;
}

/** The library failures that mean the check ran and the signature does not hold. */
const REJECTIONS = new Set(["no-signature", "unknown-signer", "invalid-signature"]);

/**
 * Verifies a detached signature over `file`, or `file` as a cleartext signed message.
 *
 * @param file - The signed file or message.
 * @param signature - The detached signature's path, or `undefined` for a cleartext message.
 * @param certificate - The key to accept signatures from.
 * @param ctx - The run's directory and stdin.
 */
async function check(
	file: string,
	signature: string | undefined,
	certificate: PublicKey,
	ctx: InputContext,
): Promise<Result<Outcome, ExitError>> {
	if (signature === undefined) {
		let message = await readText(file, ctx);
		if (isFailure(message)) return message;
		let verified = await verifyCleartext(message.data, certificate);
		return success({
			verified: isFailure(verified) ? verified : success(verified.data.signature),
			signature: message.data,
		});
	}
	let data = await readBytes(file, ctx);
	if (isFailure(data)) return data;
	let read = await readBytes(signature, ctx);
	if (isFailure(read)) return read;
	let input = armoredOrBinary(read.data);
	return success({
		verified: await verifyDetached(data.data, input, certificate),
		signature: input,
	});
}

/**
 * The issuers a rejected signature names, `null` where it names no Key ID or fingerprint.
 *
 * @param signature - The signature input.
 */
function issuers(
	signature: string | Uint8Array,
): Array<{ keyId: string | null; fingerprint: string | null }> {
	let read = readSignatures(signature);
	if (!isSuccess(read)) return [];
	return read.data.map((details) => ({
		keyId: details.issuerKeyId ?? null,
		fingerprint: details.issuerFingerprint ?? null,
	}));
}

/**
 * The heading a rejection prints under.
 *
 * @param error - The library's failure.
 */
function verdict(error: OpenPgpError): string {
	if (error.code === "unknown-signer") return "Unknown signer";
	if (error.code === "no-signature") return "No signature";
	return "Bad signature";
}

export default createCommand(OPENPGP_COMMANDS.verify, async (ctx) => {
	let { keyFile, signature, json } = ctx.flags;
	let file = ctx.arguments.file;
	let stdin = oneStdin([file, keyFile, signature]);
	if (isFailure(stdin)) return stdin;
	let certificate = await readCertificate(keyFile, ctx);
	if (isFailure(certificate)) return certificate;
	let outcome = await check(file, signature, certificate.data, ctx);
	if (isFailure(outcome)) return outcome;
	let { verified } = outcome.data;

	if (isFailure(verified)) {
		let error = verified.error;
		if (!REJECTIONS.has(error.code)) return exit(EXIT_CODES.usage, error.message);
		let named = issuers(outcome.data.signature);
		if (json) {
			let report = { valid: false, code: error.code, error: error.message, issuers: named };
			ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
			return exit(EXIT_CODES.failure);
		}
		let lines = [`${verdict(error)}: ${error.message}`];
		for (let issuer of named) {
			if (issuer.keyId) lines.push(`Issuer key ID       ${issuer.keyId}`);
			if (issuer.fingerprint) lines.push(`Issuer fingerprint  ${issuer.fingerprint}`);
		}
		return exit(EXIT_CODES.failure, lines.join("\n"));
	}

	let result = verified.data;
	if (json) {
		let report = {
			valid: true,
			signingKey: result.signingKey,
			primaryKey: result.primaryKey,
			userIds: certificate.data.userIds,
			created: result.created.toISOString(),
			hash: result.hash,
			text: result.text,
		};
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		return success();
	}
	let signer = certificate.data.userIds[0] ?? result.primaryKey;
	ctx.stdout(
		[
			`Good signature from ${signer}`,
			`Signing key  ${result.signingKey}`,
			`Primary key  ${result.primaryKey}`,
			`Created      ${result.created.toISOString()}`,
			`Hash         ${result.hash}`,
			"",
		].join("\n"),
	);
	return success();
});
