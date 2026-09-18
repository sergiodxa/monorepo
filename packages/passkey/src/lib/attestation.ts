/**
 * Checks the attestation statement a registration carries.
 *
 * Everything verifiable without a trust anchor is verified here, and anything
 * that would need one is refused rather than accepted unchecked, so a statement
 * never reaches a caller as though it had been validated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import { AttestationError } from "../errors.js";

import type { CborValue } from "./cbor.js";
import type { CredentialKey } from "./cose.js";

/** Formats whose statement carries no certificate chain, so it verifies on its own. */
const ANCHORLESS_FORMATS = new Set(["none", "packed"]);

/**
 * Verifies the statement wrapped around a newly minted credential.
 *
 * `none` is the format browsers substitute whenever a relying party asks for no
 * attestation, and its statement must be empty. A `packed` self-attestation is
 * signed by the credential's own key, which proves possession of the private
 * half at enrollment and needs nothing external to check.
 *
 * @param format Value of the attestation object's `fmt` key.
 * @param statement Value of its `attStmt` key.
 * @param authenticatorData Authenticator data the statement signs over.
 * @param clientDataHash SHA-256 of the client data the statement signs over.
 * @param key The credential's own public key.
 * @returns The verified format's name, or why the statement was refused.
 */
export async function verifyAttestation(
	format: CborValue,
	statement: CborValue,
	authenticatorData: Bytes,
	clientDataHash: Bytes,
	key: CredentialKey,
): Promise<Result<string, AttestationError>> {
	if (typeof format !== "string") return failure(new AttestationError("no format named"));
	if (!(statement instanceof Map)) return failure(new AttestationError("statement is not a map"));

	if (!ANCHORLESS_FORMATS.has(format)) {
		return failure(new AttestationError(`format ${format} needs a trust anchor to check`));
	}

	if (format === "none") {
		if (statement.size > 0) return failure(new AttestationError("none carries a statement"));
		return success(format);
	}

	if (statement.has("x5c")) {
		return failure(new AttestationError("certificate chains need a trust anchor to check"));
	}

	let algorithm = statement.get("alg");
	let signature = statement.get("sig");
	if (typeof algorithm !== "number" || !(signature instanceof Uint8Array)) {
		return failure(new AttestationError("statement is missing its signature"));
	}

	if (algorithm !== key.algorithm) {
		return failure(new AttestationError("statement disagrees with the credential algorithm"));
	}

	let signed = concatBytes(authenticatorData, clientDataHash);
	if (!(await key.verify(signature as Bytes, signed))) {
		return failure(new AttestationError("statement signature is invalid"));
	}

	return success(format);
}
